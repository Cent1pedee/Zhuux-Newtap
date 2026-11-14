import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * shadcn/ui 标准工具函数：合并条件类名并消解 Tailwind 冲突。
 * 兼容层把项目原有的裸类名字符串交给它，再叠加官方组件的默认样式，
 * 后者冲突时以前者为准（twMerge 后写覆盖），保证视觉不变。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
