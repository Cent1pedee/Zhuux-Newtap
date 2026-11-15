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
 * 视觉上**只有一枚片**，且片的材质与品牌色只做很轻的关联：
 *   旧版是「暗色中性片 + 品牌色小字」，favicon 抓到的站点却是彩色 logo，
 *   没抓到的只剩一颗半透明字母 —— 13 个格子读起来像两套完全不同的图标，
 *   黑色 logo（MDN）还会直接消失在深色片里。
 *   新版统一成微微带品牌色倾向的浅色 squircle：
 *     · 相对圆角 28%，Dock(42px) 与网格(52px) 共用同一比例；
 *     · 顶部高光 + 底部柔和渐变 + 一圈内描边，三个来源的图标都躺在同一材质上；
 *     · 字形颜色按品牌色统一压深、字号 / 字重 / 位置固定，
 *       不再出现「一个蓝 Z、一个绿语、一个红微」的彩虹字；
 *     · favicon 落在同一枚浅片上，深色标识不再需要滤镜硬描白边。
 *   用户在设置里自定义的图片 / emoji 仍完整保留，只是套上同一枚片。
 */

/**
 * 品牌色字形：统一压到「深而有彩」的一档。
 * 直接用品牌色会让 #FB7299 / #00B96B 在浅片上几乎读不出来，
 * 直接用中性黑又失去品牌辨识；掺 28% 深色后所有站点亮度接近、仍能认出颜色。
 */
function glyphColor(bg: string): string {
  return `color-mix(in srgb, ${bg} 72%, #101828)`;
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
  const plate = { width: size, height: size, ["--tile" as string]: bg };

  // 1) 自定义图片：铺满整片，图片本身就是图标
  if (resolvedImage && item.iconKind === "image" && !imageFailed) {
    return (
      <span className={`${plateClass} shortcut-plate--image`} style={plate}>
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
      <span className={`${plateClass} leading-none`} style={plate} aria-hidden="true">
        <span className="shortcut-plate-glyph" style={{ fontSize: size * 0.46 }}>
          {item.iconValue}
        </span>
      </span>
    );
  }

  // 3) 站点 favicon：中性片 + 图形；加载期间先显示首字母，避免空白方块
  if (remote && !faviconFailed) {
    return (
      <span className={plateClass} style={plate}>
        {!faviconLoaded ? (
          <span
            className="shortcut-plate-glyph shortcut-tile-letter"
            style={{ color: glyphColor(bg), fontSize: size * 0.42 }}
            aria-hidden="true"
          >
            {letter}
          </span>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={remote}
          alt=""
          width={Math.round(size * 0.6)}
          height={Math.round(size * 0.6)}
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
    <span className={plateClass} style={plate} aria-hidden="true" data-testid="icon-fallback">
      <span
        className="shortcut-plate-glyph"
        style={{ color: glyphColor(bg), fontSize: size * 0.42 }}
      >
        {letter}
      </span>
    </span>
  );
}
