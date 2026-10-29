"use client";

import { useEffect, useState } from "react";
import type { Shortcut } from "@/config/site";
import { useConfig } from "@/lib/config-store";
import { faviconUrl } from "@/lib/favicon";

/**
 * 图标降级链（v2）：用户自定义 > 站点 favicon > 首字母
 *
 * 早期顺序是「自定义 > 首字母」，favicon 排在最末且要过白名单 ——
 * 结果一排图标全是首字母方块，用户要的是「每个站点用自己的图标」。
 * 现在：
 *   1. iconKind==="image"  —— 用户上传/填写了图片，永远优先（用户意志 > 自动）
 *   2. iconKind==="emoji"  —— 用户显式挑的 emoji，同样优先
 *   3. 站点 /favicon.ico    —— 默认（icons.autoFetch=true），失败自动降级
 *   4. 首字母               —— 最终兜底（内网地址、无 favicon 的站点）
 *
 * 外观统一走 `tileStyle()`：favicon 有白底圆片、emoji 与字母是品牌色实心片，
 * 两者都套同样的投影与内高光，一排看过去才是同一套图标。
 *
 * 形状统一成「正圆」：Dock 那颗胶囊的圆角是 999px，图标却是 12px 圆角方块时，
 * 一排方块塞进一颗大胶囊里，两种圆角语言互相打架。全部正圆后，
 * 胶囊 + 圆图标 + 悬停时那圈圆形柔光才对得上。
 */
function tileShadow(): string {
  return "inset 0 1px 0 rgba(255,255,255,0.28), inset 0 0 0 1px rgba(255,255,255,0.10), 0 2px 6px -1px rgba(0,0,0,0.35)";
}

function tileStyle(bg: string, size: number): React.CSSProperties {
  return {
    width: size,
    height: size,
    background: `linear-gradient(160deg, color-mix(in srgb, ${bg} 88%, #ffffff 12%), ${bg} 58%, color-mix(in srgb, ${bg} 82%, #000000 18%))`,
    boxShadow: tileShadow(),
  };
}

/**
 * favicon 圆片：白底托住彩色图形。
 * 纯白会和旁边那些品牌色实心片（首字母 / Emoji）拉出两套质感，
 * 所以掺一成左右的自有品牌色 —— 远看是同一排圆片，近看仍能认出各自的主色。
 */
function faviconPlateStyle(bg: string, size: number): React.CSSProperties {
  return {
    width: size,
    height: size,
    background: `linear-gradient(170deg, color-mix(in srgb, ${bg} 8%, #ffffff), color-mix(in srgb, ${bg} 16%, #f4f6fa))`,
    boxShadow: tileShadow(),
  };
}

export function ShortcutIcon({ item, size = 40 }: { item: Shortcut; size?: number }) {
  const { config, ready } = useConfig();
  const [imageFailed, setImageFailed] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);

  // 换了图标或链接就重新给一次机会（否则一次失败会永久钉死成首字母）
  useEffect(() => {
    setImageFailed(false);
    setFaviconFailed(false);
  }, [item.iconValue, item.iconKind, item.url]);

  const letter = (item.title || "?").trim().charAt(0).toUpperCase() || "?";
  const bg = item.color ?? "var(--accent)";
  const customImage = item.iconKind === "image" && item.iconValue !== "";
  const customEmoji = item.iconKind === "emoji" && item.iconValue !== "";
  /*
   * 必须等配置就绪再发请求：ConfigProvider 首帧给的是默认值（autoFetch=true），
   * 若这时就渲染 <img>，用户明明关掉了图标抓取，刷新时仍会白跑一轮 favicon 请求。
   */
  const remote =
    ready && config.icons.autoFetch ? faviconUrl(item.url, Math.max(32, Math.round(size * 2))) : "";

  // 1) 用户自定义图片
  if (customImage && !imageFailed) {
    return (
      <span className="grid shrink-0 place-items-center overflow-hidden rounded-full" style={tileStyle(bg, size)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.iconValue}
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

  // 2) 用户自定义 emoji（与字母共用品牌色实心片，只把字形换掉）
  if (customEmoji) {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-full leading-none"
        style={{ ...tileStyle(bg, size), fontSize: size * 0.6 }}
        aria-hidden="true"
      >
        {item.iconValue}
      </span>
    );
  }

  // 3) 站点自带 favicon（默认路径；失败则落到首字母）
  if (remote && !faviconFailed) {
    return (
      <span
        className="grid shrink-0 place-items-center overflow-hidden rounded-full"
        style={faviconPlateStyle(bg, size)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={remote}
          alt=""
          width={size}
          height={size}
          className="size-full object-contain p-[15%]"
          onError={() => setFaviconFailed(true)}
          referrerPolicy="no-referrer"
          loading="lazy"
          data-testid="icon-favicon"
        />
      </span>
    );
  }

  // 4) 首字母占位（内网站点 / 无 favicon / 用户关掉了自动抓取）
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ ...tileStyle(bg, size), fontSize: size * 0.42 }}
      aria-hidden="true"
      data-testid="icon-fallback"
    >
      {letter}
    </span>
  );
}
