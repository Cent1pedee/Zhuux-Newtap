/**
 * Magic UI 官方组件源码（由 `shadcn view @magicui/blur-fade` 拉取）。
 * 仅做两处最小扩展，官方默认行为（as="div"）不变：
 *  1. `as` 允许渲染 span —— 本项目调用点外层是 motion.span，div 会被浏览器重写 DOM；
 *  2. `variant` 类型放宽为 Variants —— 便于适配层传入 filter/opacity 精确复现原动画。
 * 其余（useInView、AnimatePresence、variants 合成、filter 过渡判定）全部保持官方实现。
 */
"use client"

import { useRef } from "react"
import {
  AnimatePresence,
  motion,
  useInView,
  type MotionProps,
  type UseInViewOptions,
  type Variants,
} from "motion/react"

type MarginType = UseInViewOptions["margin"]

interface BlurFadeProps extends MotionProps {
  children: React.ReactNode
  className?: string
  /** 项目适配：官方固定渲染 div；本项目调用点外层是 motion.span，需要 span 才不破坏 DOM 结构 */
  as?: "div" | "span"
  /** 项目适配：放宽为 Variants，允许传入 filter / opacity 精确复现原有动画 */
  variant?: Variants
  duration?: number
  delay?: number
  offset?: number
  direction?: "up" | "down" | "left" | "right"
  inView?: boolean
  inViewMargin?: MarginType
  blur?: string
}

const getFilter = (v: Variants[string]) =>
  typeof v === "function" ? undefined : v.filter

export function BlurFade({
  children,
  className,
  as = "div",
  variant,
  duration = 0.4,
  delay = 0,
  offset = 6,
  direction = "down",
  inView = false,
  inViewMargin = "-50px",
  blur = "6px",
  ...props
}: BlurFadeProps) {
  const ref = useRef(null)
  const MotionTag = as === "span" ? motion.span : motion.div
  const inViewResult = useInView(ref, { once: true, margin: inViewMargin })
  const isInView = !inView || inViewResult
  const defaultVariants: Variants = {
    hidden: {
      [direction === "left" || direction === "right" ? "x" : "y"]:
        direction === "right" || direction === "down" ? -offset : offset,
      opacity: 0,
      filter: `blur(${blur})`,
    },
    visible: {
      [direction === "left" || direction === "right" ? "x" : "y"]: 0,
      opacity: 1,
      filter: `blur(0px)`,
    },
  }
  const combinedVariants = variant ?? defaultVariants

  const hiddenFilter = getFilter(combinedVariants.hidden)
  const visibleFilter = getFilter(combinedVariants.visible)

  const shouldTransitionFilter =
    hiddenFilter != null &&
    visibleFilter != null &&
    hiddenFilter !== visibleFilter

  return (
    <AnimatePresence>
      <MotionTag
        ref={ref}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        exit="hidden"
        variants={combinedVariants}
        transition={{
          delay: 0.04 + delay,
          duration,
          ease: "easeOut",
          ...(shouldTransitionFilter ? { filter: { duration } } : {}),
        }}
        className={className}
        {...props}
      >
        {children}
      </MotionTag>
    </AnimatePresence>
  )
}
