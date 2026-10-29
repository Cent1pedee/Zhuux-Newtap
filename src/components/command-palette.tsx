"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ENGINES } from "@/config/site";
import { orderedEngines } from "@/config/defaults";
import { useConfig, useReducedMotionPref } from "@/lib/config-store";
import { EASE_OUT_CUBIC } from "@/lib/motion";
import { resolveSearchUrl } from "@/lib/commands";
import { useToast } from "@/components/ui/primitives";

type Item =
  | { id: string; kind: "search"; label: string; hint: string; run: () => void }
  | { id: string; kind: "shortcut"; label: string; hint: string; run: () => void }
  | { id: string; kind: "theme"; label: string; hint: string; run: () => void }
  | { id: string; kind: "background"; label: string; hint: string; run: () => void }
  | { id: string; kind: "engine"; label: string; hint: string; run: () => void }
  | { id: string; kind: "action"; label: string; hint: string; run: () => void };

const KIND_LABEL: Record<Item["kind"], string> = {
  search: "搜索",
  shortcut: "快捷跳转",
  theme: "主题",
  background: "背景",
  engine: "引擎",
  action: "操作",
};

export function CommandPalette({
  open,
  onOpenChange,
  onOpenSettings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
}) {
  const { config, set, update } = useConfig();
  const reduce = useReducedMotionPref();
  const { push } = useToast();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // Cmd/Ctrl+K 唤起
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // 打开时：记录焦点、锁定滚动、聚焦输入
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    setQuery("");
    setActive(0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      restoreRef.current?.focus?.();
    };
  }, [open, onOpenChange]);

  const items = useMemo<Item[]>(() => {
    const list: Item[] = [];
    const q = query.trim();
    const engine = orderedEngines(config).find((e) => e.id === config.engineId) ?? ENGINES[0];

    if (q) {
      list.push({
        id: "search-web",
        kind: "search",
        label: `在 ${engine.name} 搜索「${q}」`,
        hint: "Enter",
        run: () => {
          window.location.href = resolveSearchUrl(engine.searchUrl, q);
        },
      });
    }

    // 命令类条目始终参与（有查询词时按标签过滤），且排在快捷项之前，
    // 否则默认 12 个快捷项会把「主题 / 背景 / 设置」挤出列表
    {
      const commands: Item[] = [
        {
          id: "theme-toggle",
          kind: "theme",
          label: config.theme.mode === "dark" ? "切换到亮色主题" : "切换到暗色主题",
          hint: "外观",
          run: () => update("theme", { mode: config.theme.mode === "dark" ? "light" : "dark" }),
        },
        {
          id: "theme-system",
          kind: "theme",
          label: "主题跟随系统",
          hint: "外观",
          run: () => update("theme", { mode: "system" }),
        },
        {
          id: "background-toggle",
          kind: "background",
          label: config.background.source === "edge" ? "关闭每日壁纸" : "开启每日壁纸",
          hint: "背景",
          run: () =>
            update("background", { source: config.background.source === "edge" ? "none" : "edge" }),
        },
        {
          id: "background-offset",
          kind: "background",
          label: `每日壁纸回溯到 ${(config.background.offset + 1) % 8} 天前`,
          hint: "背景",
          run: () => update("background", { offset: (config.background.offset + 1) % 8 }),
        },
        {
          id: "open-settings",
          kind: "action",
          label: "打开设置",
          hint: "设置",
          run: () => onOpenSettings(),
        },
        {
          id: "focus-search",
          kind: "action",
          label: "聚焦搜索框",
          hint: "搜索",
          run: () => {
            document.querySelector<HTMLInputElement>('[data-testid="search-input"]')?.focus();
          },
        },
      ];
      for (const item of commands) {
        if (q && !`${item.label} ${item.hint}`.toLowerCase().includes(q.toLowerCase())) continue;
        list.push(item);
      }
    }

    for (const group of config.groups) {
      for (const item of group.items) {
        if (q && !`${item.title} ${item.url} ${group.name}`.toLowerCase().includes(q.toLowerCase())) continue;
        list.push({
          id: `sc-${item.id}`,
          kind: "shortcut",
          label: item.title,
          hint: "快捷跳转",
          run: () => window.open(item.url, "_blank", "noopener,noreferrer"),
        });
      }
    }

    if (q) {
      for (const e of orderedEngines(config)) {
        if (!e.name.toLowerCase().includes(q.toLowerCase())) continue;
        list.push({
          id: `engine-${e.id}`,
          kind: "engine",
          label: `切换到 ${e.name}`,
          hint: "引擎",
          run: () => set("engineId", e.id),
        });
      }
    }

    return list.slice(0, 14);
  }, [query, config, update, set, onOpenSettings]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  // 保证选中项可见
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const runItem = useCallback(
    (item: Item | undefined) => {
      if (!item) return;
      onOpenChange(false);
      // 延迟执行，避免与关闭动画抢焦点
      window.setTimeout(() => item.run(), 60);
      push(`${KIND_LABEL[item.kind]}：${item.label}`, "info");
    },
    [onOpenChange, push],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (items.length ? (i + 1) % items.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      runItem(items[active]);
    } else if (event.key === "Tab") {
      event.preventDefault();
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.16 }}
          data-testid="palette"
        >
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
            onClick={() => onOpenChange(false)}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="命令面板"
            className="glass-strong relative z-10 w-full max-w-lg overflow-hidden rounded-2xl"
            initial={{ opacity: 0, scale: reduce ? 1 : 0.96, y: reduce ? 0 : 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: reduce ? 1 : 0.97, y: reduce ? 0 : 4 }}
            transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT_CUBIC }}
          >
            <div className="flex items-center gap-2 border-b border-[var(--glass-border)] px-3 py-2.5">
              <span className="text-[var(--fg-subtle)]" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" strokeLinecap="round" />
                </svg>
              </span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="搜索或跳转…（快捷项 / 主题 / 背景 / 设置）"
                aria-label="命令面板输入"
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-list"
                aria-activedescendant={items[active] ? `palette-item-${active}` : undefined}
                data-testid="palette-input"
                className="h-8 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-[var(--fg-subtle)]"
              />
            </div>

            <ul
              ref={listRef}
              id="palette-list"
              role="listbox"
              aria-label="命令面板结果"
              className="thin-scroll max-h-[46vh] overflow-y-auto p-1.5"
            >
              {items.length === 0 ? (
                <li className="px-3 py-6 text-center text-[12px] text-[var(--fg-subtle)]" data-testid="palette-empty">
                  没有匹配项
                </li>
              ) : (
                items.map((item, index) => (
                  <li
                    key={item.id}
                    id={`palette-item-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={index === active}
                    data-testid={`palette-item-${index}`}
                    onMouseEnter={() => setActive(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => runItem(item)}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] transition-colors ${
                      index === active ? "bg-[var(--hover-bg)] text-[var(--fg)]" : "text-[var(--fg-muted)]"
                    }`}
                  >
                    <span className="w-14 shrink-0 text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">
                      {KIND_LABEL[item.kind]}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <span className="shrink-0 text-[10px] text-[var(--fg-subtle)]">{item.hint}</span>
                  </li>
                ))
              )}
            </ul>

          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
