import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** 合并 className，冲突项由 twMerge 以后写为准。 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
