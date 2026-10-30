"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createDefaultConfig } from "@/config/defaults";
import type { AppConfig } from "@/config/types";
import { CONFIG_KEY, loadConfig, saveConfig } from "@/lib/storage";

type ConfigContextValue = {
  config: AppConfig;
  /** 是否已完成客户端读取（SSR 首帧为默认配置，避免 hydration 不匹配） */
  ready: boolean;
  /** 浅合并更新某个分区 */
  update: <K extends keyof AppConfig>(key: K, patch: Partial<AppConfig[K]>) => void;
  /** 直接设置某个顶层字段 */
  set: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void;
  /** 直接替换整份配置（导入用） */
  replace: (next: AppConfig) => void;
  /** 重置为出厂配置 */
  reset: () => void;
};

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(() => createDefaultConfig());
  const [ready, setReady] = useState(false);
  const mounted = useRef(false);
  /**
   * 本次变更是否来自「别的标签页」。
   * 是的话就不要回写 —— 否则两个标签会互相触发 storage 事件，
   * 虽然值相同浏览器不会真的广播，但白白多一次 stringify + 写盘。
   */
  const external = useRef(false);

  // 首帧后读取本地配置
  useEffect(() => {
    const loaded = loadConfig();
    setConfig(loaded);
    setReady(true);
    mounted.current = true;
  }, []);

  /**
   * 跨标签页同步。
   *
   * 历史问题：两个标签同时打开时，A 改设置、B 还是旧配置；
   * B 再改任何一项，会用自己那份旧配置把 A 的改动整体覆盖掉 —— 最后写入者通吃，
   * 且用户完全看不出发生了什么。storage 事件只在**其他**标签页触发，正好用来对齐。
   * 冲突策略仍是「后写覆盖」，但至少两边看到的是同一份数据。
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (event: StorageEvent) => {
      // 别的键（比如壁纸缓存）与本次无关
      if (event.key !== null && event.key !== CONFIG_KEY) return;
      external.current = true;
      // newValue === null 表示配置被清空（一键清除 / 恢复出厂在另一个标签触发）
      setConfig(event.newValue === null ? createDefaultConfig() : loadConfig());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // 配置变化写回（ready 之前不写，防止用默认值覆盖用户数据）
  useEffect(() => {
    if (!ready) return;
    if (external.current) {
      external.current = false;
      return;
    }
    saveConfig(config);
  }, [config, ready]);

  const update = useCallback(<K extends keyof AppConfig>(key: K, patch: Partial<AppConfig[K]>) => {
    setConfig((prev) => {
      const current = prev[key];
      if (current && typeof current === "object" && !Array.isArray(current)) {
        return { ...prev, [key]: { ...current, ...patch } };
      }
      return { ...prev, [key]: patch as AppConfig[K] };
    });
  }, []);

  const replace = useCallback((next: AppConfig) => setConfig(next), []);

  const set = useCallback(<K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setConfig(createDefaultConfig()), []);

  const value = useMemo<ConfigContextValue>(
    () => ({ config, ready, update, set, replace, reset }),
    [config, ready, update, set, replace, reset],
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig 必须在 ConfigProvider 内使用");
  return ctx;
}

/**
 * 读取「是否减少动效」：用户显式设置优先，否则跟随系统。
 * 初始值同步读 matchMedia（而非先 false 再在 effect 里纠正），
 * 否则首帧会按「不减少」的时长起动画，系统偏好为 reduce 时仍会闪一下。
 */
export function useReducedMotionPref(): boolean {
  const { config } = useConfig();
  const [systemReduce, setSystemReduce] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setSystemReduce(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (config.a11y.reducedMotion === null) return systemReduce;
  return config.a11y.reducedMotion;
}
