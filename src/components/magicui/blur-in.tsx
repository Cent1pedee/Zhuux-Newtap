"use client";

/* 包装官方 blur-fade，保留 BlurIn 的 props 与 span DOM。
   入场只做 y 位移 + 淡入，ease 沿用 EASE_OUT_CUBIC。 */
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
      /* 官方写死 exit="hidden"；props 末尾展开可覆盖，避免卸载时多一段淡出。 */
      exit={undefined}
      variant={{
        hidden: { opacity: 0, y: reduce ? 0 : 4 },
        visible: { opacity: 1, y: 0 },
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
