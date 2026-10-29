import type { Transition, Variants } from "motion/react";

/**
 * 统一动效变体（PRD 8.5）
 * 全部只动 transform / opacity / filter；reduced-motion 时由调用方传入 reduce=true，
 * 变体自动降级为 0 时长静态呈现。
 */

export const EASE_OUT_CUBIC = [0.215, 0.61, 0.355, 1] as const;

export const SPRING_SOFT: Transition = { type: "spring", stiffness: 380, damping: 30, mass: 0.9 };

export function dur(ms: number, reduce: boolean): number {
  return reduce ? 0 : ms / 1000;
}

export function fadeUp(reduce: boolean, distance = 12): Variants {
  return {
    hidden: { opacity: 0, y: reduce ? 0 : distance },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: dur(220, reduce), ease: EASE_OUT_CUBIC },
    },
  };
}

export function fadeIn(reduce: boolean): Variants {
  return {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: dur(200, reduce), ease: EASE_OUT_CUBIC } },
  };
}

export function scaleIn(reduce: boolean): Variants {
  return {
    hidden: { opacity: 0, scale: reduce ? 1 : 0.96 },
    show: { opacity: 1, scale: 1, transition: { duration: dur(200, reduce), ease: EASE_OUT_CUBIC } },
  };
}

/** 快捷项入场：stagger 30-50ms，scale 0.9→1 + fade up */
export function gridItem(reduce: boolean): Variants {
  return {
    hidden: { opacity: 0, y: reduce ? 0 : 8, scale: reduce ? 1 : 0.9 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: dur(200, reduce), ease: EASE_OUT_CUBIC },
    },
    exit: {
      opacity: 0,
      scale: reduce ? 1 : 0.9,
      transition: { duration: dur(150, reduce), ease: EASE_OUT_CUBIC },
    },
  };
}

export function staggerContainer(reduce: boolean, stagger = 0.04, delay = 0): Variants {
  return {
    hidden: {},
    show: {
      transition: { staggerChildren: reduce ? 0 : stagger, delayChildren: reduce ? 0 : delay },
    },
  };
}

/** 首屏序列延迟（PRD 8.4）：壁纸 0 → 时钟 150 → 搜索 300 → 网格 450 → 一言 600 */
export const ENTRANCE_DELAY = {
  clock: 0.15,
  search: 0.3,
  grid: 0.45,
  quote: 0.6,
} as const;
