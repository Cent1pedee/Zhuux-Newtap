"use client";

import { useEffect } from "react";
import { useConfig, useReducedMotionPref } from "@/lib/config-store";
import { contrastRatio, hexToRgb } from "@/lib/color";

/**
 * 把配置写进 <html> 的 data-* 与 CSS 变量（PRD 5.1 / 8.2）
 * - data-theme：亮/暗（跟随系统时由 matchMedia 决定）
 * - --accent：强调色，同时派生 --accent-soft / --accent-glow
 * - data-motion：reduce 时全局禁用动画（globals.css 有对应规则）
 */
export function ThemeSync() {
  const { config, ready } = useConfig();
  const reduce = useReducedMotionPref();
  const mode = config.theme.mode;

  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const resolved =
        mode === "system"
          ? window.matchMedia("(prefers-color-scheme: light)").matches
            ? "light"
            : "dark"
          : mode;
      root.dataset.theme = resolved;
      root.style.colorScheme = resolved;
    };

    apply();
    if (mode !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement;
    const accent = config.theme.accent;
    const rgb = hexToRgb(accent);
    root.style.setProperty("--accent", accent);
    if (rgb) {
      root.style.setProperty("--accent-rgb", `${rgb.r} ${rgb.g} ${rgb.b}`);
    }
  }, [config.theme.accent]);

  useEffect(() => {
    const root = document.documentElement;
    if (reduce) root.dataset.motion = "reduce";
    else delete root.dataset.motion;
  }, [reduce]);

  // 主题切换后校验对比度，不达标时仅提示（不阻断用户选择）
  useEffect(() => {
    if (!ready) return;
    const theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const ratio = contrastRatio(
      config.theme.accent,
      theme === "light" ? "#ffffff" : "#0a0d14",
    );
    document.documentElement.dataset.accentContrast = ratio.toFixed(2);
  }, [config.theme.accent, ready]);

  return null;
}
