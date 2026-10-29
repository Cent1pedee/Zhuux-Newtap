"use client";

import { AnimatePresence, motion } from "motion/react";
import { EASE_OUT_CUBIC } from "@/lib/motion";

/**
 * Magic UI · Animated Digits
 *
 * 数字变化时的「模糊上浮」过渡。
 *
 * 为什么不用翻牌：早期实现是每位数套一个 overflow-hidden 的小卡片、
 * 数字在里面上下滚动（机械翻页钟的样式）。它把连续的数字切成一格格的
 * 小方块，字号一大就像贴了标签，和整体的玻璃质感完全不搭。
 *
 * 这里改成 Magic UI 的做法 —— 不做盒子、不裁切，只让新数字从下方
 * 8% 处带轻微模糊淡入、旧数字向上淡出。视觉上像数字「化开又聚拢」，
 * 与渐变文字融为一体。
 */
export function AnimatedDigits({
  value,
  animate = true,
  className = "",
}: {
  value: string;
  animate?: boolean;
  className?: string;
}) {
  if (!animate) {
    return <span className={className}>{value}</span>;
  }
  return (
    <span className={`relative inline-block ${className}`} style={{ minWidth: "0.62em" }}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          className="inline-block"
          initial={{ opacity: 0, y: "0.1em", filter: "blur(6px)" }}
          animate={{ opacity: 1, y: "0em", filter: "blur(0px)" }}
          exit={{ opacity: 0, y: "-0.1em", filter: "blur(6px)" }}
          transition={{ duration: 0.3, ease: EASE_OUT_CUBIC }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
