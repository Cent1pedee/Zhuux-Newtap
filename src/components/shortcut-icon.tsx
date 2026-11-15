"use client";

import { useEffect, useState } from "react";
import type { Shortcut } from "@/config/site";
import { useConfig } from "@/lib/config-store";
import { faviconUrl } from "@/lib/favicon";
import { useStoredImage } from "@/lib/use-stored-image";

/**
 * 图标降级链：用户自定义 > 站点 favicon > 首字母
 *
 * 早期顺序是「自定义 > 首字母」，favicon 排在最末且要过白名单 ——
 * 结果一排图标全是首字母方块，用户要的是「每个站点用自己的图标」。
 * 现在：
 *   1. iconKind==="image"  —— 用户上传/填写了图片，永远优先（用户意志 > 自动）
 *   2. iconKind==="emoji"  —— 用户显式挑的 emoji，同样优先
 *   3. 站点 /favicon.ico    —— 默认（icons.autoFetch=true），失败自动降级
 *   4. 首字母               —— 最终兜底（内网地址、无 favicon 的站点）
 *
 * 视觉上只有一种「片」：
 *   中性片（白 / 暗色主题的 #2b2f38）+ 图形。
 *   favicon 直接落在片上；没有 favicon 的站点用「品牌色字形」顶上，
 *   而不是整块刷成品牌色 —— 参考站的应用抽屉里，所有图标都躺在同一色号的
 *   方块里，靠图形本身区分，一片彩色底会把整排切成「色块拼贴」。
 * Dock（42px / 12px 圆角）与快捷网格（52px / 14px 圆角）只是同一枚片的两个尺寸。
 */

/** 品牌色字形：往前景色里掺，暗色主题下自动提亮，浅色主题下自动压深 */
function glyphColor(bg: string): string {
  return `color-mix(in srgb, ${bg} 55%, var(--fg))`;
}

export function ShortcutIcon({
  item,
  size = 40,
  variant = "dock",
}: {
  item: Shortcut;
  size?: number;
  /**
   * dock：底部 Dock 与设置列表里的 42px 片（12px 圆角）。
   * tile：首页快捷网格里的 52px 片（14px 圆角）。
   */
  variant?: "dock" | "tile";
}) {
  const { config, ready } = useConfig();
  const [imageFailed, setImageFailed] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);
  const [faviconLoaded, setFaviconLoaded] = useState(false);

  // 换了图标或链接就重新给一次机会（否则一次失败会永久钉死成首字母）
  useEffect(() => {
    setImageFailed(false);
    setFaviconFailed(false);
    setFaviconLoaded(false);
  }, [item.iconValue, item.iconKind, item.url]);

  const letter = (item.title || "?").trim().charAt(0).toUpperCase() || "?";
  const bg = item.color ?? "var(--accent)";
  /**
   * 自定义图片现在存 IndexedDB，配置里是 `idb:` 引用（历史配置仍是 dataURL，直接用）。
   * 引用还没解析出来时 `resolvedImage` 为 null，先按后面的阶梯降级，
   * 解析完成后自动切到图片 —— 不会出现破图图标。
   */
  const resolvedImage = useStoredImage(item.iconKind === "image" ? item.iconValue : "");
  const customEmoji = item.iconKind === "emoji" && item.iconValue !== "";
  /*
   * 必须等配置就绪再发请求：ConfigProvider 首帧给的是默认值（autoFetch=true），
   * 若这时就渲染 <img>，用户明明关掉了图标抓取，刷新时仍会白跑一轮 favicon 请求。
   */
  const remote =
    ready && config.icons.autoFetch ? faviconUrl(item.url, Math.max(32, Math.round(size * 2))) : "";

  const isTile = variant === "tile";
  const plateClass = `shortcut-plate ${isTile ? "shortcut-tile-icon" : "shortcut-dock-icon"}`;
  const plate = { width: size, height: size };

  // 1) 自定义图片：铺满整片，图片本身就是图标
  if (resolvedImage && item.iconKind === "image" && !imageFailed) {
    return (
      <span className={`${plateClass} overflow-hidden`} style={plate}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolvedImage}
          alt=""
          width={size}
          height={size}
          className="size-full object-cover"
          onError={() => setImageFailed(true)}
          referrerPolicy="no-referrer"
        />
      </span>
    );
  }

  // 2) 自定义 emoji：中性片 + emoji 字形（emoji 自带颜色，不再叠品牌底）
  if (customEmoji) {
    return (
      <span
        className={`${plateClass} leading-none`}
        style={{ ...plate, fontSize: size * 0.48 }}
        aria-hidden="true"
      >
        {item.iconValue}
      </span>
    );
  }

  // 3) 站点 favicon：中性片 + 图形；加载期间先显示首字母，避免空白方块
  if (remote && !faviconFailed) {
    return (
      <span className={plateClass} style={plate}>
        {!faviconLoaded ? (
          <span
            className="shortcut-tile-letter"
            style={{ color: glyphColor(bg), fontSize: size * 0.4 }}
            aria-hidden="true"
          >
            {letter}
          </span>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={remote}
          alt=""
          width={Math.round(size * 0.54)}
          height={Math.round(size * 0.54)}
          className="shortcut-icon-img"
          data-loaded={faviconLoaded ? "true" : "false"}
          onLoad={() => setFaviconLoaded(true)}
          onError={() => setFaviconFailed(true)}
          referrerPolicy="no-referrer"
          loading="lazy"
          data-testid="icon-favicon"
        />
      </span>
    );
  }

  // 4) 首字母：中性片 + 品牌色字形（与 emoji 同一套片）
  return (
    <span
      className={`${plateClass} font-semibold`}
      style={{ ...plate, color: glyphColor(bg), fontSize: size * 0.42 }}
      aria-hidden="true"
      data-testid="icon-fallback"
    >
      {letter}
    </span>
  );
}
