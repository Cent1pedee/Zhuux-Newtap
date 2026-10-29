"use client";

import { motion } from "motion/react";
import { EASE_OUT_CUBIC } from "@/lib/motion";

/** Magic UI · Blur In：模糊 + 位移 + 淡入，用于标题与强调文案 */
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
    <motion.span
      className={className}
      initial={{ opacity: 0, filter: reduce ? "blur(0px)" : "blur(10px)", y: reduce ? 0 : 8 }}
      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      transition={{ duration: reduce ? 0 : duration, delay: reduce ? 0 : delay, ease: EASE_OUT_CUBIC }}
    >
      {children}
    </motion.span>
  );
}
