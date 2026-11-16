"use client";

import { memo, useEffect, useState } from "react";
import type { Shortcut } from "@/config/site";
import { useConfig } from "@/lib/config-store";
import { useFaviconChain } from "@/lib/use-favicon";
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
 * 视觉上**只有一枚片**：
 *   旧版是「暗色中性片 + 品牌色小字」，favicon 抓到的站点却是彩色 logo，
 *   没抓到的只剩一颗半透明字母 —— 13 个格子读起来像两套完全不同的图标，
 *   黑色 logo（MDN）还会直接消失在深色片里。
 *   新版统一成浅色 squircle：
 *     · 相对圆角 28%，Dock(42px) 与网格(52px) 共用同一比例；
 *     · 顶部高光 + 底部柔和渐变 + 一圈内描边，三个来源的图标都躺在同一材质上；
 *     · 字形颜色统一压深、字号 / 字重 / 位置固定，不出现彩虹字；
 *     · favicon 保留站点自己的颜色（用户明确要求），片底只负责托住它 ——
 *       一整条去色的灰阶图标会丢掉站点辨识度，也让界面显得没精神。
 *   用户在设置里自定义的图片 / emoji 仍完整保留，只是套上同一枚片。
 *
 * 字母 / Emoji 一律用同一档墨色；颜色只留给 favicon 与 Emoji 本身。
 */

/**
 * 纯展示组件：Dock / 网格 / 设置列表里同一份数据会被渲染多份，
 * 上层任何状态变化（hover、展开、输入）都不该让它重新走一遍图标降级链。
 * props 都是原始值或稳定引用，memo 的默认浅比较足够。
 */
export const ShortcutIcon = memo(function ShortcutIcon({
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

  // 换了图标或链接就重新给一次机会（否则一次失败会永久钉死成首字母）
  useEffect(() => {
    setImageFailed(false);
  }, [item.iconValue, item.iconKind, item.url]);

  const letter = (item.title || "?").trim().charAt(0).toUpperCase() || "?";
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
  const favicon = useFaviconChain(item.url, ready && config.icons.autoFetch);

  const isTile = variant === "tile";
  const plateClass = `shortcut-plate ${isTile ? "shortcut-tile-icon" : "shortcut-dock-icon"}`;
  /**
   * 尺寸走 CSS 变量，默认值仍是调用方传的 size：
   * 移动端 Dock 要在「不新增第二个组件 / 不读视口宽度」的前提下整体缩一号，
   * 只改 `.shortcut-item { --tile-size: 38px }` 就够了。
   * 字形与内边距都用 calc 跟着变量走，否则缩了片、字号还停在 42px 的比例上。
   */
  const sizeValue = `var(--tile-size, ${size}px)`;
  const plate = { width: sizeValue, height: sizeValue } as React.CSSProperties;
  const glyphSize = `calc(${sizeValue} * 0.42)`;
  const emojiSize = `calc(${sizeValue} * 0.46)`;

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
        <span className="shortcut-plate-glyph" style={{ fontSize: emojiSize }}>
          {item.iconValue}
        </span>
      </span>
    );
  }

  /*
   * 3) 站点 favicon：浅片 + 站点原色图标；加载期间先显示首字母，避免空白方块。
   *    候选链的解析结果按站点 URL 缓存在 useFaviconChain 里 —— 排序、切布局、
   *    重开设置导致的重新挂载会直接复用上一次的地址，不会退回 .ico 或字母。
   */
  if (favicon.src) {
    return (
      <span className={plateClass} style={plate}>
        {!favicon.loaded ? (
          <span
            className="shortcut-plate-glyph shortcut-tile-letter"
            style={{ fontSize: glyphSize }}
            aria-hidden="true"
          >
            {letter}
          </span>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={favicon.src}
          alt=""
          width={Math.round(size * 0.6)}
          height={Math.round(size * 0.6)}
          className="shortcut-icon-img"
          data-loaded={favicon.loaded ? "true" : "false"}
          onLoad={favicon.onLoad}
          onError={favicon.onError}
          referrerPolicy="no-referrer"
          loading="lazy"
          data-testid="icon-favicon"
        />
      </span>
    );
  }

  // 4) 首字母：与 favicon / Emoji 同一枚浅片，字形用统一墨色
  return (
    <span className={plateClass} style={plate} aria-hidden="true" data-testid="icon-fallback">
      <span className="shortcut-plate-glyph" style={{ fontSize: glyphSize }}>
        {letter}
      </span>
    </span>
  );
});
