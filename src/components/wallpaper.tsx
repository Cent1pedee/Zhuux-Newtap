"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FALLBACK_GRADIENT } from "@/config/site";
import { useConfig, useReducedMotionPref } from "@/lib/config-store";
import { fetchEdgeWallpaper, fetchUserImage, type EdgeWallpaper } from "@/lib/services";
import { cacheGet, cachePut, imageCacheKey } from "@/lib/storage";
import { useStoredImage } from "@/lib/use-stored-image";

/** 聚焦模式下的额外模糊量（px），类 macOS Spotlight */
const FOCUS_BLUR = 16;

/** 每日壁纸元数据的缓存键（带上偏移天数，切换「往前第几天」不互相覆盖） */
function edgeCacheKey(offset: number): string {
  return `edge-meta:v1:${offset}`;
}

/**
 * 壁纸遮罩。
 *
 * 只负责「曝光」，而且**与主题完全无关**：
 * 背景层（图片 / 纯色兜底 / 暗角 / 这层薄纱）在亮暗两套主题下是同一张图，
 * 主题切换时它一个像素都不该重画。明暗的差别交给组件自己：
 * 搜索胶囊、Dock、设置面板、卡片按 `data-theme` 换材质。
 *
 * 恒定压暗也是刻意的：壁纸是每日一图，明暗完全随机，而照片上的文字
 * （时间 / 日期 / 名称 / 一言）统一用白色 + 暗投影，背景就必须稳定偏暗。
 */
function scrimBackground(dim: number): string {
  const d = Math.min(100, Math.max(0, dim)) / 100;
  const base = 0.05 + d * 0.7;
  return `rgba(4, 7, 14, ${base.toFixed(2)})`;
}

/**
 * 背景层。
 *
 * 默认使用 Edge（Bing）每日壁纸：元数据取自 bing.biturl.top（有 CORS 头，
 * 走 safeFetch 的白名单校验），图片本体是 bing.com 的 th?id= 直链，由 <img>
 * 加载。用户可以叠加一张自定义图片（优先级更高）；
 * 任何一步失败都回落到纯渐变，页面永远有底，不会出现白屏。
 */
export function Wallpaper({ blurred = false }: { blurred?: boolean } = {}) {
  const { config, ready } = useConfig();
  const reduce = useReducedMotionPref();
  const { background, wallpaper } = config;

  const [focus, setFocus] = useState(false);
  const [failed, setFailed] = useState(false);
  const [daily, setDaily] = useState<EdgeWallpaper | null>(null);
  const [cachedSrc, setCachedSrc] = useState<string | null>(null);
  /** 图片是否已完整解码 —— 未解码前不透明度保持 0，避免「加载一半先画一半」 */
  const [decoded, setDecoded] = useState(false);
  const seq = useRef(0);
  const layerRef = useRef<HTMLDivElement | null>(null);

  /*
   * 本地上传的图存在 IndexedDB，配置里只留 `idb:` 引用；远程地址与历史 dataURL 直接用。
   * 引用解析期间（一次 IndexedDB 读）这里是空串，先露出每日壁纸 —— 比白屏好。
   */
  const customValue = wallpaper.source === "none" ? "" : wallpaper.value;
  const customSrc = useStoredImage(customValue) ?? "";
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
        // 网络不可用：保留上一次的成功结果（daily 不动），从没成功过则由渐变兜底
        if (ticket !== seq.current) return;
      }
    })();
  }, [ready, edgeEnabled, background.offset, config.privacy.whitelist]);

  // 自定义图片：优先 IndexedDB 缓存，避免重复下载
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setCachedSrc(null);
    if (!customSrc) return;
    /*
     * dataURL（本地上传）已经随配置存在 localStorage 里，再写一份进 IndexedDB
     * 等于同一张图存两遍；而 `wallpaper:${dataURL}` 这种把整串 base64 当键的写法，
     * 还会让每次渲染都拼一次 10MB 级字符串。这两件事一起改掉。
     */
    if (customSrc.startsWith("data:")) return;
    const key = imageCacheKey(customSrc);
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
          // 走统一网络层：omit credentials / no-referrer / 超时 / 8MB 流式上限。
          // 不再用裸 fetch —— 原实现既没超时也没体积上限，一张大图能把内存和
          // IndexedDB 配额一起吃掉，失败后还不带 referrer 策略。
          const blob = await fetchUserImage(customSrc);
          if (cancelled) return;
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

  /**
   * 视差：鼠标位置 → 两个 CSS 变量，交给合成层的 translate3d 处理。
   *
   * 刻意不写进 state：pointermove 每秒能来上百次，setState 会让整个壁纸层
   * （含 <img> 的 Motion 属性）重算。这里只在 rAF 里改两条自定义属性，
   * 主线程零渲染、零布局，位移本身由合成器完成。
   * 触摸/无精确指针的设备直接跳过。
   */
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || reduce) return;
    if (typeof window.matchMedia === "function" && !window.matchMedia("(pointer: fine)").matches) return;

    let raf = 0;
    let px = 0;
    let py = 0;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      px = (event.clientX / window.innerWidth - 0.5) * 2;
      py = (event.clientY / window.innerHeight - 0.5) * 2;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        layer.style.setProperty("--wall-px", px.toFixed(3));
        layer.style.setProperty("--wall-py", py.toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduce]);

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
  /*
   * 点击时间进入展开态时，壁纸额外高斯模糊一档：
   * 18px 足以把细节压成色块、让快捷方块与文字浮起来，又保留照片的明暗与色调。
   * 这是交互态，不写入配置；用户设的 background.blur 始终叠加在最外层。
   */
  const revealBlur = blurred ? 18 : 0;
  const blur = Math.max(0, background.blur) + (focus ? FOCUS_BLUR : 0) + revealBlur;
  const brightness = blurred ? 0.82 : focus ? 0.72 : 1;
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
      ref={layerRef}
      className="wallpaper-layer"
      aria-hidden="true"
      data-testid="wallpaper"
      data-bg-source={sourceTag}
      data-bg-date={daily?.date ?? ""}
      data-blurred={blurred ? "true" : "false"}
    >
      {/* 每日壁纸 / 自定义图片：交叉淡入 + Ken Burns 缓慢缩放 */}
      <AnimatePresence initial={false} mode="sync">
        {!failed && src ? (
          <motion.img
            key={src}
            src={src}
            alt=""
            className="wallpaper-media"
            data-kenburns={background.kenBurns && !reduce ? "true" : "false"}
            /*
             * 只有 opacity 交给 Motion（一次 0.7s 淡入）。
             * scale 改由 CSS @keyframes 做（合成线程，主线程零样式重算），
             * filter 交给 .wallpaper-media 的 CSS transition —— 原来这两项都由
             * Motion 逐帧写内联样式，实测空闲状态就有 60 次/秒样式重算、
             * 32ms/s 主线程开销，聚焦搜索框时再多 47ms。
             */
            initial={{ opacity: 0 }}
            animate={{ opacity: decoded ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 0.7, ease: [0.215, 0.61, 0.355, 1] } }}
            style={{ filter: `blur(${blur}px) brightness(${brightness})` }}
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

      {/* 暗角：四角压暗、中心留亮，让视线落在内容列上（可在「背景」里关闭） */}
      {background.vignette ? (
        <div className="wallpaper-vignette" data-testid="wallpaper-vignette" />
      ) : null}

      {/* 遮罩层：两个主题完全同一层，不参与主题切换 */}
      <div className="wallpaper-scrim" style={{ background: scrimBackground(background.dim) }} />
    </div>
  );
}
