"use client";

import { useEffect, useState } from "react";
import { faviconUrl } from "@/lib/favicon";

/**
 * 搜索引擎图标。
 *
 * 默认取站点自己的 favicon（用户要求：显示真实标识，不要自造的「G / b / 百」）；
 * 拿不到时退回内置的内联 SVG 品牌标识 —— 离线、内网、站点改版都不会露出空白方块。
 *
 * 为什么仍然保留内联 SVG 兜底：
 * 1. favicon 是 16/32px 的小图，浏览器放大会发虚，某些站点甚至只给一个纯色方块；
 * 2. 首次加载必然有一次网络往返，兜底能让徽标立刻成形，不会闪一下再补图；
 * 3. 断网场景（本地起始页的常见用法）整排引擎不能全是空白。
 *
 * 每个图标都在 24×24 视口里绘制，外圈交给调用方的圆形容器。
 */

export type EngineGlyphId = "google" | "bing" | "baidu";

export function EngineGlyph({ id, size = 18 }: { id: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true } as const;

  if (id === "google") {
    // Google「G」：四色分段 + 右侧那道横向缺口是这家标识的关键特征
    return (
      <svg {...common}>
        <path
          fill="#4285F4"
          d="M21.6 12.23c0-.79-.07-1.54-.2-2.27H12v4.3h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.99-4.3 2.99-7.55Z"
        />
        <path
          fill="#34A853"
          d="M12 22c2.7 0 4.96-.9 6.61-2.42l-3.23-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.58A10 10 0 0 0 12 22Z"
        />
        <path
          fill="#FBBC05"
          d="M6.41 13.92a6 6 0 0 1 0-3.84V7.5H3.07a10 10 0 0 0 0 9l3.34-2.58Z"
        />
        <path
          fill="#EA4335"
          d="M12 6.04c1.47 0 2.79.5 3.83 1.5l2.86-2.86C16.95 3.02 14.7 2 12 2A10 10 0 0 0 3.07 7.5l3.34 2.58C7.2 7.8 9.4 6.04 12 6.04Z"
        />
      </svg>
    );
  }

  if (id === "bing") {
    // Bing：左侧那道折角是它的识别点，用两段路径拼出「b」的骨架
    return (
      <svg {...common}>
        <path fill="#008373" d="M5 2.5v14.7l4.05 2.3V9.1l3.2 1.6 6.75-3.2-6.75-3.1v11.5l4.05 2.3 4.7-2.4-8.7-4.4V2.5H5Z" />
        <path fill="#00A99D" d="m13 9.1 6.75-3.2-6.75-3.1v6.3Z" opacity="0.55" />
      </svg>
    );
  }

  // 百度：「百」字的极简切口造型 —— 上部弧 + 横 + 下方开口框
  return (
    <svg {...common}>
      <path
        fill="#2932E1"
        d="M12 2.6c-1.9 0-3.4 1.5-3.4 3.4 0 1.4.8 2.6 2 3.1l-.1 1.9H5.2v2.3h5v1.6H6.9c-.8 0-1.4.6-1.4 1.4v3.1c0 .8.6 1.4 1.4 1.4h10.2c.8 0 1.4-.6 1.4-1.4v-3.1c0-.8-.6-1.4-1.4-1.4h-4.3v-1.6h5v-2.3h-5.3l-.1-1.9c1.2-.5 2-1.7 2-3.1 0-1.9-1.5-3.4-3.4-3.4Zm0 2.2c.7 0 1.2.5 1.2 1.2S12.7 7.2 12 7.2s-1.2-.5-1.2-1.2.5-1.2 1.2-1.2Zm-2.6 12h5.2v2.1H9.4v-2.1Z"
      />
    </svg>
  );
}

/**
 * 引擎图标底：白色圆片 + 一层极淡内描边与投影。
 *
 * 传了 `url` 且站点可抓 favicon 就显示真实图标，否则用内联品牌标识兜底。
 * 右侧圆形搜索按钮与它是「白圆里一个图形」的统一语言。
 */
export function EngineBadge({
  id,
  size = 34,
  url,
  autoFetch = false,
}: {
  id: string;
  size?: number;
  url?: string;
  autoFetch?: boolean;
}) {
  const remote = autoFetch && url ? faviconUrl(url, Math.max(32, Math.round(size * 2))) : "";
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [remote]);

  const glyph = Math.round(size * 0.56);
  return (
    <span
      className="engine-badge"
      style={{ width: size, height: size }}
      data-testid="engine-badge"
      data-engine={id}
      data-icon={remote && !failed ? "favicon" : "glyph"}
    >
      {remote && !failed ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={remote}
          alt=""
          width={size}
          height={size}
          className="size-full object-contain p-[22%]"
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      ) : (
        <EngineGlyph id={id} size={glyph} />
      )}
    </span>
  );
}
