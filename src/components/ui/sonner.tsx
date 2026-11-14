"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/**
 * shadcn/ui 官方 Toaster，仅改一处：去掉 `next-themes`。
 *
 * 官方版用 `useTheme()` 读 next-themes 的上下文，但本项目主题的唯一数据源是
 * ConfigProvider（亮/暗/跟随系统三态 + 持久化），再引入第二份 theme state 会违背
 * 单一数据源。且所有 toast 都在兼容层走 `toast.custom()` 自绘气泡，sonner 内置卡片的
 * 那组 --normal-* / --popover 变量用不上，因此这里固定 theme="system"。
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      {...props}
    />
  )
}

export { Toaster }
