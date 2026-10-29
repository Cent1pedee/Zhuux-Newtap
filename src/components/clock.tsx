"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useConfig, useReducedMotionPref } from "@/lib/config-store";
import { clockParts, dateLabelOf, greetingAt, greetingKeyAt } from "@/lib/greeting";
import { EASE_OUT_CUBIC, ENTRANCE_DELAY, fadeUp } from "@/lib/motion";
import { AnimatedDigits } from "@/components/magicui/animated-digits";
import { BlurIn } from "@/components/magicui/blur-in";

/**
 * 时钟。
 *
 * 关键约束：数字用**纯实心色**（--fg）渲染，不再使用 background-clip:text 的
 * 渐变文字。历史 bug：`.gradient-text` 把 color 和 -webkit-text-fill-color 都
 * 设成 transparent，只靠背景渐变着色；在某些环境（Safari / 部分 Chromium 变体）
 * background-clip:text 不生效，文字就彻底不可见 —— 用户反馈「时钟不显示」。
 * 现在改用实心色 + 柔和投影保证任意壁纸上都可读。
 */
export function Clock() {
  const { config, ready } = useConfig();
  const reduce = useReducedMotionPref();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const parts = now ? clockParts(now) : null;
  const dateLabel = now ? dateLabelOf(now) : "";
  const greeting = now ? greetingAt(now, config.greeting.custom) : "";
  const greetKey = now ? greetingKeyAt(now) : "early";

  const timeText = useMemo(() => {
    if (!parts) return "--:--";
    return config.clock.showSeconds ? `${parts.hh}:${parts.mm}:${parts.ss}` : `${parts.hh}:${parts.mm}`;
  }, [parts, config.clock.showSeconds]);

  if (!config.clock.show) return null;

  return (
    <motion.section
      aria-label="当前时间与问候"
      data-entrance="clock"
      className="flex flex-col items-center text-center"
      variants={fadeUp(reduce, 14)}
      initial="hidden"
      animate="show"
      transition={{ delay: reduce || !ready ? 0 : ENTRANCE_DELAY.clock }}
    >
      <div
        className="clock-digits select-none text-[var(--fg)]"
        /* 视口高度也参与决定字号：矮屏（600~700 高）自动收小，避免把网格挤出首屏 */
        style={{ fontSize: "clamp(46px, min(10vw, 12vh), 104px)" }}
        data-testid="clock"
        aria-live="off"
      >
        {parts ? (
          <span className="flex items-baseline justify-center">
            {/*
              数字变化时只有「模糊 + 上浮」的轻过渡（Magic UI Animated Digits），
              不再有逐位翻牌 —— 翻牌会把连续数字切成贴片，字号一大就显脏。
            */}
            <AnimatedDigits value={parts.hh} animate={!reduce} />
            <span className="mx-[0.04em] opacity-60">:</span>
            <AnimatedDigits value={parts.mm} animate={!reduce} />
            {config.clock.showSeconds ? (
              /*
                秒：0.56em / 75% 不透明度。早期用 0.42em + 60%，几乎看不见，
                用户以为「开了显示秒但没生效」。现在明显偏大一档，一眼就能注意到。
              */
              <span
                className="ml-[0.14em] tabular-nums text-[0.56em] font-semibold opacity-75"
                data-testid="clock-seconds"
              >
                <AnimatedDigits value={parts.ss} animate={!reduce} />
              </span>
            ) : null}
          </span>
        ) : (
          // SSR 首帧占位：固定宽高避免 CLS
          <span className="inline-block" style={{ minWidth: "3.2em" }}>
            &nbsp;
          </span>
        )}
      </div>

      {/* 屏幕阅读器读取完整时间，避免逐字播报 */}
      <span className="sr-only" aria-live="polite">
        {now ? `现在是 ${now.getHours()} 点 ${now.getMinutes()} 分，${greeting}，${dateLabel}` : ""}
      </span>

      {/*
        问候语与日期改为**上下两行**，各自独立居中。
        历史观感问题：原来两者并排在一个 flex 行里，整行居中但两段文字本身长度差
        很大（「下午好」3 字 vs「周三 · 10月28日」9 字），视觉重心被拉偏，
        看起来像「没居中、往右飘」。分行后每行都独占一行、各自 text-align:center，
        中轴与上方时钟严格对齐。
      */}
      <div className="mt-3 flex flex-col items-center gap-1" data-testid="clock-meta">
        {config.greeting.show ? (
          <div className="flex min-h-[24px] items-center justify-center">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={greetKey + greeting}
                className="text-[15px] font-medium tracking-wide text-[var(--fg)] opacity-90"
                initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduce ? 0 : -6 }}
                transition={{ duration: reduce ? 0 : 0.25, ease: EASE_OUT_CUBIC }}
                data-testid="greeting"
              >
                {/* Magic UI BlurIn：问候语切换时轻微模糊淡入（PRD 8.4 标题类动效） */}
                <BlurIn reduce={reduce} duration={0.32} delay={0}>
                  {greeting}
                </BlurIn>
              </motion.span>
            </AnimatePresence>
          </div>
        ) : null}
        <span
          className="block min-h-[20px] text-center text-[13px] tabular-nums tracking-wide text-[var(--fg-muted)]"
          data-testid="date-label"
        >
          {dateLabel || "\u00a0"}
        </span>
      </div>
      <span className="sr-only" data-testid="clock-text">
        {timeText}
      </span>
    </motion.section>
  );
}
