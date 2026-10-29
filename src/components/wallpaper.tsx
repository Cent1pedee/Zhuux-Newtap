"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FALLBACK_GRADIENT } from "@/config/site";
import { useConfig, useReducedMotionPref } from "@/lib/config-store";
import { fetchEdgeWallpaper, type EdgeWallpaper } from "@/lib/services";
import { cacheGet, cachePut } from "@/lib/storage";

/** 聚焦模式下的额外模糊量（px），类 macOS Spotlight */
const FOCUS_BLUR = 16;

/** 每日壁纸元数据的缓存键（带上偏移天数，切换「往前第几天」不互相覆盖） */
function edgeCacheKey(offset: number): string {
  return `edge-meta:v1:${offset}`;
}

/**
 * 背景层。
 *
 * 默认使用 Edge（Bing）每日壁纸：元数据取自 bing.biturl.top（有 CORS 头，
 * 走 safeFetch 的白名单校验），图片本体是 bing.com 的 th?id= 直链，由 <img>
 * 加载。用户可以叠加一张自定义图片（优先级更高）；
 * 任何一步失败都回落到纯渐变，页面永远有底，不会出现白屏。
 */
export function Wallpaper() {
  const { config, ready } = useConfig();
  const reduce = useReducedMotionPref();
  const { background, wallpaper, theme } = config;

  const [focus, setFocus] = useState(false);
  const [failed, setFailed] = useState(false);
  const [daily, setDaily] = useState<EdgeWallpaper | null>(null);
  const [cachedSrc, setCachedSrc] = useState<string | null>(null);
  /** 图片是否已完整解码 —— 未解码前不透明度保持 0，避免「加载一半先画一半」 */
  const [decoded, setDecoded] = useState(false);
  const seq = useRef(0);

  // 亮色主题判定（跟随系统时按 matchMedia 解析），用于切换暗化层的色调
  const [systemLight, setSystemLight] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => setSystemLight(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const isLight = theme.mode === "light" || (theme.mode === "system" && systemLight);

  const customSrc = wallpaper.source === "none" ? "" : wallpaper.value;
  const edgeEnabled = background.source === "edge";

  /**
   * 拉取每日壁纸元数据：先读 IndexedDB 缓存（同一天不重复请求），
   * 再走 safeFetch。8s 超时，失败静默回落到渐变。
   */
  useEffect(() => {
    // 首帧的 config 是出厂默认值（localStorage 还没读进来）。
    // 不等 ready 就直接请求，用户明明关掉了每日壁纸也会先打一次第三方请求，
    // 「默认零第三方请求」的承诺就破了。
    if (!ready) return;
    if (!edgeEnabled) {
      setDaily(null);
      return;
    }
    const ticket = ++seq.current;
    setFailed(false);

    void (async () => {
      const key = edgeCacheKey(background.offset);
      const cached = await cacheGet(key);
      if (ticket !== seq.current) return;
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as EdgeWallpaper;
          if (parsed && typeof parsed.url === "string" && parsed.url) {
            setDaily(parsed);
            return;
          }
        } catch {
          /* 缓存损坏，继续走网络 */
        }
      }
      try {
        const next = await fetchEdgeWallpaper(config.privacy.whitelist, background.offset);
        if (ticket !== seq.current) return;
        setDaily(next);
        void cachePut(key, JSON.stringify(next));
      } catch {
        if (ticket !== seq.current) return;
        // 网络不可用：若已有上一次的成功结果就保留，否则由 onError 走渐变兜底
        setDaily((prev) => prev);
      }
    })();
  }, [ready, edgeEnabled, background.offset, config.privacy.whitelist]);

  // 自定义图片：优先 IndexedDB 缓存，避免重复下载
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setCachedSrc(null);
    if (!customSrc) return;
    const key = `wallpaper:${customSrc}`;
    void (async () => {
      const cached = await cacheGet(key);
      if (cancelled) return;
      if (cached) {
        setCachedSrc(cached);
        return;
      }
      // 仅 http(s) 远程地址才做网络缓存；dataURL 直接使用
      if (/^https?:\/\//i.test(customSrc)) {
        try {
          const res = await fetch(customSrc, { mode: "cors", credentials: "omit" });
          if (!res.ok) throw new Error(String(res.status));
          const blob = await res.blob();
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = typeof reader.result === "string" ? reader.result : null;
            if (!dataUrl || cancelled) return;
            setCachedSrc(dataUrl);
            void cachePut(key, dataUrl);
          };
          reader.readAsDataURL(blob);
        } catch {
          /* 失败时直接用原地址，仍 404 则由 onError 降级 */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customSrc]);

  // 聚焦模式：监听页面内输入焦点（搜索框 / 命令面板）
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      if (el.matches("input, textarea, [contenteditable='true']")) setFocus(true);
    };
    const onFocusOut = () => setFocus(false);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  const src = customSrc ? (cachedSrc ?? customSrc) : (daily?.url ?? "");
  const blur = Math.max(0, background.blur) + (focus ? FOCUS_BLUR : 0);
  const brightness = focus ? 0.72 : 1;
  const sourceTag = customSrc ? "custom" : daily ? "edge" : "none";

  const onImageError = useCallback(() => setFailed(true), []);

  /**
   * 预解码，而不是让 <img> 边下边画。
   *
   * 之前直接把 <img> 交给浏览器渐进渲染：大图（1920×1080 的 Bing 壁纸）
   * 会先画出上半截、再补下半截，中间那零点几秒正好被 0.6s 的淡入放大，
   * 看起来就是「切成两半」的割裂感。现在先用 Image() 完整下载并 decode()，
   * 解码完成才把图层的不透明度推到 1 —— 用户要么看不到图，要么看到完整的图。
   * 期间底下那层渐变兜底一直在，不会出现白屏。
   */
  useEffect(() => {
    setDecoded(false);
    if (!src || failed) return;
    let cancelled = false;
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    const done = () => {
      if (!cancelled) setDecoded(true);
    };
    const fail = () => {
      if (!cancelled) setFailed(true);
    };
    if (typeof img.decode === "function") {
      img.decode().then(done).catch(() => {
        // decode() 对某些格式/来源会拒绝，但不代表图片不可用；
        // 退回 load 事件判断，避免把能显示的图误判成失败。
        if (img.complete && img.naturalWidth > 0) done();
        else fail();
      });
    } else {
      img.onload = done;
      img.onerror = fail;
    }
    return () => {
      cancelled = true;
    };
  }, [src, failed]);

  return (
    <div
      className="wallpaper-layer"
      aria-hidden="true"
      data-testid="wallpaper"
      data-bg-source={sourceTag}
      data-bg-date={daily?.date ?? ""}
    >
      {/* 每日壁纸 / 自定义图片：交叉淡入 + Ken Burns 缓慢缩放 */}
      <AnimatePresence initial={false} mode="sync">
        {!failed && src ? (
          <motion.img
            key={src}
            src={src}
            alt=""
            className="wallpaper-media"
            initial={{ opacity: 0, scale: background.kenBurns && !reduce ? 1.06 : 1 }}
            animate={{
              // 未解码完成前保持全透明：宁可多等几十毫秒，也不要半张图
              opacity: decoded ? 1 : 0,
              scale: decoded ? 1 : background.kenBurns && !reduce ? 1.06 : 1,
              filter: `blur(${blur}px) brightness(${brightness})`,
            }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: 0.7, ease: [0.215, 0.61, 0.355, 1] },
              scale: { duration: 12, ease: "linear" },
              filter: { duration: 0.25 },
            }}
            onError={onImageError}
            data-testid="wallpaper-image"
            data-decoded={decoded ? "true" : "false"}
          />
        ) : null}
      </AnimatePresence>

      {/* 降级：无壁纸 / 加载失败时的纯渐变，页面仍完整可用（PRD 4.5） */}
      {failed || !src ? (
        <div
          className="absolute inset-0"
          style={{ background: FALLBACK_GRADIENT }}
          data-testid="wallpaper-fallback"
        />
      ) : null}

      {/* 暗化层：亮色主题改为白色柔光罩，保证深色文字在任意背景上都有对比度（PRD 5.1 / 6.2 AA） */}
      <div
        className="wallpaper-scrim"
        data-theme-scrim={isLight ? "light" : "dark"}
        style={
          isLight
            ? { background: `rgba(248, 250, 253, ${(0.3 + (background.dim / 100) * 0.45).toFixed(2)})` }
            : { background: `rgba(0,0,0,${(background.dim / 100).toFixed(2)})` }
        }
      />
    </div>
  );
}
