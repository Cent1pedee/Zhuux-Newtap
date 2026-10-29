"use client";

import { motion } from "motion/react";
import { SPRING_SOFT } from "@/lib/motion";

/**
 * Magic UI · Bento Grid
 *
 * 与官方 Bento 一致的做法：**整块板 + 板内分区**，而不是一堆各自带边框的卡片。
 * - 外层 `.bento-grid` 提供唯一的玻璃底与圆角，板内模块不再叠第二层玻璃，
 *   所以页面上只有一层轮廓，视觉上是一个整体容器（此前每张卡各有一圈 1px 亮边，
 *   叠在背景上显得很脏，而且只有搜索栏下面那一行像「盒子」）。
 * - 每个 `BentoCard` 参与布局动画：模块显隐、跨度变化、窗口缩放时，
 *   格子用弹簧平滑移动到新位置，而不是瞬移 —— 这是「丝滑」的来源。
 * - 入场错峰交给各模块自己的 `variants`（它们带 data-entrance，reduced-motion
 *   测试依赖这些节点），这里不重复做透明度动画，避免叠两层淡入。
 * - `md` 以下一律单列，避免窄屏被挤压。
 */
export function BentoGrid({
  children,
  className = "",
  reduce = false,
}: {
  children: React.ReactNode;
  className?: string;
  reduce?: boolean;
}) {
  return (
    <motion.div
      layout={!reduce}
      transition={reduce ? { duration: 0 } : SPRING_SOFT}
      className={`bento-grid ${className}`}
      data-testid="bento-grid"
    >
      {children}
    </motion.div>
  );
}

/** 12 列体系下的常用跨度，避免各组件里写魔法数字 */
export type BentoSpan = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 12;

export function BentoCard({
  children,
  span = 12,
  className = "",
  testId,
  ariaLabel,
  reduce = false,
  exit = false,
}: {
  children: React.ReactNode;
  /** md 以上占 12 列中的几列 */
  span?: BentoSpan;
  className?: string;
  testId?: string;
  ariaLabel?: string;
  reduce?: boolean;
  /** 放在 <AnimatePresence> 里时传 true，让移除的格子淡出而不是瞬间消失 */
  exit?: boolean;
}) {
  return (
    <motion.div
      layout={!reduce}
      exit={exit && !reduce ? { opacity: 0, scale: 0.96, transition: { duration: 0.18 } } : undefined}
      transition={reduce ? { duration: 0 } : SPRING_SOFT}
      className={`bento-cell bento-cell--span-${span} ${className}`}
      data-testid={testId}
      data-span={span}
      aria-label={ariaLabel}
    >
      {children}
    </motion.div>
  );
}
