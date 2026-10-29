"use client";

import { motion } from "motion/react";
import { EASE_OUT_CUBIC } from "@/lib/motion";

/**
 * Magic UI · Shimmer Button
 * 底色渐变 + 一条斜向高光沿按钮扫过；hover 抬升、active 回落。
 * 用 span 承载高光，不改变按钮语义，可直接替换原生 button。
 *
 * variant:
 *  - glass  半透明玻璃底（默认，用于次要操作）
 *  - accent 品牌色实心（用于主操作 / 提交）
 * shape:
 *  - pill   胶囊（默认）
 *  - icon   正方形图标按钮（保持与输入框一致的圆角阶梯）
 */
export function ShimmerButton({
  children,
  onClick,
  type = "button",
  disabled = false,
  reduce = false,
  ariaLabel,
  testId,
  className = "",
  size = "md",
  variant = "glass",
  shape = "pill",
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  reduce?: boolean;
  ariaLabel?: string;
  testId?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "glass" | "accent";
  shape?: "pill" | "icon";
  title?: string;
}) {
  const sizes =
    shape === "icon"
      ? ""
      : {
          sm: "px-2.5 py-1.5 text-[12px] rounded-[9px]",
          md: "px-3.5 py-2 text-[13px] rounded-[10px]",
          lg: "px-5 py-2.5 text-[14px] rounded-[12px]",
        }[size];

  const variantClass =
    variant === "accent" ? "shimmer-button--accent" : "";
  const shapeClass = shape === "icon" ? "shimmer-button--icon" : "";

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      data-testid={testId}
      whileHover={reduce || disabled ? undefined : { y: -1 }}
      whileTap={reduce || disabled ? undefined : { y: 0, scale: 0.985 }}
      transition={{ duration: 0.16, ease: EASE_OUT_CUBIC }}
      className={`shimmer-button relative isolate inline-flex items-center justify-center gap-1.5 overflow-hidden font-medium disabled:cursor-not-allowed disabled:opacity-45 ${variantClass} ${shapeClass} ${sizes} ${className}`}
    >
      {reduce ? null : <span className="shimmer-sweep" aria-hidden="true" />}
      <span className="relative z-10 inline-flex items-center justify-center gap-1.5">{children}</span>
    </motion.button>
  );
}
