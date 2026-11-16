"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { faviconCandidates } from "@/lib/favicon";

/**
 * 逐个尝试候选 favicon，并把「这个站点最后落到了哪一条」记在模块级缓存里。
 *
 * `<img>` 没有「换源重试」能力，这里用 onError 推到下一个候选：
 *   favicon.ico → apple-touch-icon.png → favicon.svg，全部失败回退首字母。
 *
 * 为什么需要模块级缓存（2026-11 修复）：
 *   在设置里拖动排序时，图标所在的子树会被 React 重新挂载/重跑副作用。
 *   如果每次挂载都从第一条候选重新探测，用户会看到图标先退回字母（或退回
 *   分辨率更低的 .ico），再慢慢补回原来的图标 —— 也就是「调整顺序后 icon 错乱」。
 *   缓存把「已解析到的地址 + 是否已加载成功」按站点 URL 记下来，
 *   重新挂载时直接从上次的结果继续：已经在用的图标不闪、不重试。
 *
 * 缓存键是「页面 URL」而不是组件实例：同一站点在 Dock / 网格 / 设置列表里
 * 同时出现三份图标，三者共享同一份解析结果，不会各自探测出一套不同答案。
 */

type ChainState = {
  /** 当前正在尝试的候选地址；空串表示没有可用候选 */
  href: string;
  /** 当前这张图是否已经 load 成功（成功后才把字母让位给图片） */
  loaded: boolean;
  /** 候选全部试完 —— 调用方应稳定显示首字母，重新挂载也不要再探测 */
  done: boolean;
};

const MEMORY_LIMIT = 160;
const memory = new Map<string, ChainState>();

function recall(pageUrl: string): ChainState | null {
  return memory.get(pageUrl) ?? null;
}

function remember(pageUrl: string, state: ChainState) {
  if (!pageUrl) return;
  // 简单的 LRU：超上限先丢最早的一条，起始页最多也就几十个站点
  if (!memory.has(pageUrl) && memory.size >= MEMORY_LIMIT) {
    const oldest = memory.keys().next().value;
    if (oldest) memory.delete(oldest);
  }
  memory.set(pageUrl, state);
}

/** 由缓存 + 当前候选表推导初始状态；缓存里的地址必须仍然在候选表里 */
function deriveState(candidates: string[], pageUrl: string): ChainState {
  const saved = recall(pageUrl);
  if (!saved) return { href: candidates[0] ?? "", loaded: false, done: candidates.length === 0 };
  if (saved.done) return { href: "", loaded: false, done: true };
  if (saved.href && candidates.includes(saved.href)) {
    return { href: saved.href, loaded: saved.loaded, done: false };
  }
  return { href: candidates[0] ?? "", loaded: false, done: candidates.length === 0 };
}

export function useFaviconChain(pageUrl: string, enabled: boolean) {
  const candidates = useMemo(() => (enabled ? faviconCandidates(pageUrl) : []), [pageUrl, enabled]);
  /**
   * url / 开关的稳定指纹。state 与它绑在一起：
   * 换站点的那一帧如果还按旧 state 渲染，会短暂露出上一个站点的图标，
   * 甚至把旧图标的解析进度记到新站点名下。
   */
  const key = `${enabled ? "1" : "0"}|${pageUrl}`;

  const [entry, setEntry] = useState<{ key: string; state: ChainState }>(() => ({
    key,
    state: deriveState(candidates, pageUrl),
  }));

  /** 渲染值：指纹不匹配时现场推导，保证这一帧就是新站点的正确候选 */
  const state = entry.key === key ? entry.state : deriveState(candidates, pageUrl);
  const stateRef = useRef(state);
  stateRef.current = state;

  // 指纹变化后把推导结果落回 state，后续的 load/error 才有正确的推进起点
  useEffect(() => {
    if (entry.key === key) return;
    setEntry({ key, state: deriveState(candidates, pageUrl) });
  }, [entry.key, key, candidates, pageUrl]);

  // 每次落定都写回缓存：下一个挂载的实例（排序、切布局、重开设置）直接复用
  useEffect(() => {
    if (!enabled || !pageUrl || entry.key !== key) return;
    remember(pageUrl, entry.state);
  }, [enabled, key, pageUrl, entry]);

  const update = useCallback(
    (fn: (prev: ChainState) => ChainState) => {
      setEntry((prev) => ({
        key,
        state: fn(prev.key === key ? prev.state : deriveState(candidates, pageUrl)),
      }));
    },
    [key, candidates, pageUrl],
  );

  return {
    src: state.href,
    loaded: state.loaded,
    /** 候选全部试完：调用方应渲染兜底字形 */
    exhausted: state.done,
    onLoad: (event: React.SyntheticEvent<HTMLImageElement>) => {
      // 迟到的旧请求（src 已经被换掉）不能把新候选标成已加载
      if (event.currentTarget.getAttribute("src") !== stateRef.current.href) return;
      if (!stateRef.current.href) return;
      update((prev) => (prev.loaded ? prev : { ...prev, loaded: true }));
    },
    onError: (event: React.SyntheticEvent<HTMLImageElement>) => {
      if (event.currentTarget.getAttribute("src") !== stateRef.current.href) return;
      const index = candidates.indexOf(stateRef.current.href);
      const next = index >= 0 ? candidates[index + 1] : undefined;
      update(() =>
        next ? { href: next, loaded: false, done: false } : { href: "", loaded: false, done: true },
      );
    },
  };
}
