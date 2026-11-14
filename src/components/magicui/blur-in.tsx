"use client";

/**
 * Magic UI · Blur In（适配层）
 *
 * 内部委托 magicui 官方 `blur-fade`（见 blur-fade.official.tsx），对外保持原有
 * 导出名、props 与 DOM（仍是 motion.span），调用点零改动。
 *
 * 官方默认的 variants（blur 6px / offset 6 / easeOut / delay+0.04s）与本项目
 * 既有动画不同，这里通过 `variant` + `transition` 精确复现替换前的参数：
 * blur 10px、y 8、EASE_OUT_CUBIC、原样 delay/duration；reduce 时退化为瞬时无动画。
 */
import { EASE_OUT_CUBIC } from "@/lib/motion";
import { BlurFade } from "./blur-fade.official";

export function BlurIn({
  children,
  delay = 0,
  reduce = false,
  className = "",
  duration = 0.5,
}: {
  children: React.ReactNode;
  delay?: number;
  reduce?: boolean;
  className?: string;
  duration?: number;
}) {
  return (
    <BlurFade
      as="span"
      className={className}
      inView={false}
      /* 官方组件内部写死 exit="hidden"，会在问候语卸载时多播一段淡出；
         项目的 BlurIn 原本没有退出动画。props 在官方 JSX 末尾展开，这里覆盖掉它，
         保持原有的进出场时序（AnimatePresence 本身不产生 DOM，静态结构不受影响）。 */
      exit={undefined}
      variant={{
        hidden: { opacity: 0, y: reduce ? 0 : 8, filter: reduce ? "blur(0px)" : "blur(10px)" },
        visible: { opacity: 1, y: 0, filter: "blur(0px)" },
      }}
      transition={{
        duration: reduce ? 0 : duration,
        delay: reduce ? 0 : delay,
        ease: EASE_OUT_CUBIC,
      }}
    >
      {children}
    </BlurFade>
  );
}
