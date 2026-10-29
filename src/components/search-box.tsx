"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { activeEngine, orderedEngines } from "@/config/defaults";
import { asDirectUrl, commandSuggestions, parseCommand, resolveCommandUrl, resolveSearchUrl } from "@/lib/commands";
import { useConfig, useReducedMotionPref } from "@/lib/config-store";
import { EASE_OUT_CUBIC, ENTRANCE_DELAY, fadeUp } from "@/lib/motion";
import { fetchSuggestions } from "@/lib/services";
import { useToast } from "@/components/ui/primitives";
import { Spotlight } from "@/components/magicui/spotlight";
import { EngineBadge } from "@/components/engine-glyph";

type Suggestion = { id: string; text: string; kind: "suggest" | "command" | "direct" };

export function SearchBox() {
  const { config, ready, set } = useConfig();
  const reduce = useReducedMotionPref();
  const { push } = useToast();

  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [remoteSuggestions, setRemoteSuggestions] = useState<string[]>([]);
  const [engineMenuOpen, setEngineMenuOpen] = useState(false);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [focusedMode, setFocusedMode] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const engineBtnRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const suggestSeq = useRef(0);

  const engines = useMemo(() => orderedEngines(config), [config]);
  const engine = useMemo(() => activeEngine(config), [config]);

  const commandHit = useMemo(() => parseCommand(query, config.quickCommands), [query, config.quickCommands]);
  const directUrl = useMemo(() => (commandHit ? null : asDirectUrl(query)), [query, commandHit]);
  const cmdHints = useMemo(
    () => (directUrl || commandHit ? [] : commandSuggestions(query, config.quickCommands)),
    [query, config.quickCommands, directUrl, commandHit],
  );

  // 搜索建议（P1，默认关闭；仅请求当前引擎 suggest，白名单强校验）
  useEffect(() => {
    if (!config.suggest.enabled || !focused) {
      setRemoteSuggestions([]);
      setLoadingSuggest(false);
      return;
    }
    const keyword = query.trim();
    if (!keyword || keyword.startsWith("/") || !engine.suggestUrl) {
      setRemoteSuggestions([]);
      return;
    }
    const seq = (suggestSeq.current += 1);
    setLoadingSuggest(true);
    const timer = window.setTimeout(() => {
      fetchSuggestions(engine.id, keyword, config.privacy.whitelist, engine.suggestUrl)
        .then((list) => {
          if (suggestSeq.current !== seq) return;
          setRemoteSuggestions(list);
        })
        .catch(() => {
          if (suggestSeq.current !== seq) return;
          setRemoteSuggestions([]);
        })
        .finally(() => {
          if (suggestSeq.current === seq) setLoadingSuggest(false);
        });
    }, 220);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(timer);
    };
  }, [query, config.suggest.enabled, config.privacy.whitelist, engine.suggestUrl, engine.id, focused]);

  const suggestions: Suggestion[] = useMemo(() => {
    const list: Suggestion[] = [];
    if (commandHit) {
      list.push({
        id: "cmd-hit",
        kind: "command",
        text: commandHit.query
          ? `${commandHit.command.key} ${commandHit.command.label} · 搜索「${commandHit.query}」`
          : `${commandHit.command.key} ${commandHit.command.label} · 打开站点`,
      });
      return list;
    }
    if (directUrl) {
      list.push({ id: "direct", kind: "direct", text: `打开网址 ${directUrl}` });
      return list;
    }
    for (const c of cmdHints) {
      list.push({ id: `hint-${c.id}`, kind: "command", text: `${c.key}  ${c.label}` });
    }
    for (const [i, text] of remoteSuggestions.entries()) {
      list.push({ id: `sug-${i}`, kind: "suggest", text });
    }
    return list.slice(0, 9);
  }, [commandHit, directUrl, cmdHints, remoteSuggestions]);

  const openList = focused && suggestions.length > 0;

  useEffect(() => {
    setActiveIndex(-1);
  }, [query, openList]);

  // 点击外部关闭引擎菜单
  useEffect(() => {
    if (!engineMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || engineBtnRef.current?.contains(target)) return;
      setEngineMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [engineMenuOpen]);

  /**
   * 提交（Enter / 点搜索按钮 / 点建议项）一律在新标签页打开 ——
   * 起始页是「出发点」，把自己导航走就等于关掉了这个出发点。
   *
   * 输入为空时不是拒绝，而是打开当前引擎的官网（Bing → bing.com）：
   * 用户很可能正想「直接去那个站点」，空输入 + 回车是最直觉的路径。
   */
  const execute = useCallback(
    (rawInput: string, override?: Suggestion) => {
      const input = rawInput.trim();
      if (!input && !override) {
        window.open(engine.homeUrl, "_blank", "noopener,noreferrer");
        push(`已在新标签打开 ${engine.name}`, "info");
        inputRef.current?.focus();
        return;
      }

      let target: string | null = null;

      if (override?.kind === "command" && commandHit) {
        target = resolveCommandUrl(commandHit);
      } else if (override?.kind === "command") {
        // 从指令提示里点选：填入指令，不直接跳转
        const hint = cmdHints.find((c) => `hint-${c.id}` === override.id);
        if (hint) {
          setQuery(`${hint.key} `);
          inputRef.current?.focus();
          return;
        }
      } else if (override?.kind === "direct") {
        target = directUrl;
      } else if (override?.kind === "suggest") {
        target = resolveSearchUrl(engine.searchUrl, override.text);
      } else {
        const hit = parseCommand(input, config.quickCommands);
        if (hit) {
          target = resolveCommandUrl(hit);
        } else {
          const url = asDirectUrl(input);
          target = url ?? resolveSearchUrl(engine.searchUrl, input);
        }
      }

      if (!target) return;

      // 隐私：跳转前不附加任何参数；新标签打开一律带 noopener,noreferrer
      window.open(target, "_blank", "noopener,noreferrer");
    },
    [commandHit, cmdHints, directUrl, engine.searchUrl, engine.homeUrl, engine.name, config.quickCommands, push],
  );

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    execute(query);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;

    if (event.key === "ArrowDown" && openList) {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
      return;
    }
    if (event.key === "ArrowUp" && openList) {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
      return;
    }
    if (event.key === "Escape") {
      if (openList) {
        event.preventDefault();
        setQuery("");
        setActiveIndex(-1);
      }
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const picked = activeIndex >= 0 ? suggestions[activeIndex] : undefined;
      execute(query, picked);
    }
  };

  const cycleEngine = () => {
    if (engines.length <= 1) {
      push("仅有一个引擎，请在设置中添加", "info");
      return;
    }
    const idx = engines.findIndex((e) => e.id === config.engineId);
    const next = engines[(idx + 1) % engines.length];
    set("engineId", next.id);
    push(`已切换到 ${next.name}`, "success");
  };

  const selectEngine = (id: string) => {
    set("engineId", id);
    setEngineMenuOpen(false);
    push(`当前引擎：${engines.find((e) => e.id === id)?.name ?? ""}`, "success");
    inputRef.current?.focus();
  };

  return (
    <motion.div
      variants={fadeUp(reduce, 16)}
      initial="hidden"
      animate="show"
      transition={{ delay: reduce ? 0 : ENTRANCE_DELAY.search }}
      data-entrance="search"
      className="relative z-30 w-full"
    >
      <form
        ref={formRef}
        role="search"
        action={engine.formAction}
        method="get"
        onSubmit={onSubmit}
        className="relative"
        aria-label="搜索引擎"
        data-testid="search-form"
      >
        <motion.div
          className="search-panel relative flex items-center gap-1.5 overflow-hidden pl-1.5 pr-1.5"
          data-focused={focusedMode ? "true" : "false"}
          animate={{ scale: focusedMode && !reduce ? 1.012 : 1 }}
          transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT_CUBIC }}
          data-testid="search-shell"
        >
          {/* Magic UI Spotlight：鼠标跟随光斑（PRD 8.4） */}
          {reduce ? null : <Spotlight size={260} opacity={0.22} />}
          {/* 引擎切换按钮：点击循环切换（PRD 4.1） */}
          <div className="relative shrink-0">
            <button
              ref={engineBtnRef}
              type="button"
              onClick={cycleEngine}
              onContextMenu={(e) => {
                e.preventDefault();
                setEngineMenuOpen((v) => !v);
              }}
              aria-label={`当前引擎 ${engine.name}，点击切换，右键选择引擎`}
              aria-haspopup="menu"
              aria-expanded={engineMenuOpen}
              data-testid="engine-button"
              className="engine-btn"
            >
              <motion.span
                key={engine.id}
                initial={{ rotate: reduce ? 0 : -90, scale: reduce ? 1 : 0.7, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT_CUBIC }}
                aria-hidden="true"
                className="grid place-items-center"
              >
                <EngineBadge
                  id={engine.id}
                  size={34}
                  url={engine.homeUrl}
                  autoFetch={ready && config.icons.autoFetch}
                />
              </motion.span>
            </button>

            <AnimatePresence>
              {engineMenuOpen ? (
                <motion.div
                  ref={menuRef}
                  role="menu"
                  aria-label="选择搜索引擎"
                  data-testid="engine-menu"
                  className="glass-strong absolute left-0 top-11 z-30 w-48 overflow-hidden rounded-xl p-1"
                  initial={{ opacity: 0, y: reduce ? 0 : -6, scale: reduce ? 1 : 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: reduce ? 0 : -4, scale: reduce ? 1 : 0.98 }}
                  transition={{ duration: reduce ? 0 : 0.16 }}
                >
                  {engines.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={e.id === config.engineId}
                      onClick={() => selectEngine(e.id)}
                      data-testid={`engine-option-${e.id}`}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-[var(--hover-bg)] ${
                        e.id === config.engineId ? "text-[var(--fg)]" : "text-[var(--fg-muted)]"
                      }`}
                    >
                      <EngineBadge id={e.id} size={20} url={e.homeUrl} autoFetch={ready && config.icons.autoFetch} />
                      <span className="flex-1 truncate">{e.name}</span>
                      {e.id === config.engineId ? <CheckIcon /> : null}
                    </button>
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            name={engine.param}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => {
              setFocused(true);
              setFocusedMode(true);
            }}
            onBlur={() => {
              window.setTimeout(() => {
                setFocused(false);
                setFocusedMode(false);
              }, 120);
            }}
            placeholder={`在 ${engine.name} 搜索，或输入 / 使用快捷指令`}
            aria-label="搜索关键词"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={openList}
            aria-controls="search-suggestions"
            aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={512}
            data-testid="search-input"
            className="search-input h-12 min-w-0 flex-1 bg-transparent text-[15px] text-[var(--fg)] outline-none placeholder:text-[var(--fg-subtle)]"
          />

          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="清空搜索框"
              data-testid="search-clear"
              className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-xs)] text-[var(--fg-subtle)] transition-colors duration-[var(--dur-fast)] hover:bg-[var(--hover-bg)] hover:text-[var(--fg)]"
            >
              <CloseIcon />
            </button>
          ) : null}

          {/*
            搜索按钮：改成与左侧引擎徽标同尺寸的正圆。
            原来是 Magic UI ShimmerButton 的 icon 形态 —— 它本体是圆角方块，
            和左边那颗圆徽标放在一个胶囊里，一圆一方怎么调都别扭。
            这里换成纯圆 + 强调色实心 + 一层同色柔光晕，
            hover 时圆圈轻微放大、光晕加深，按下回弹。
          */}
          <motion.button
            type="submit"
            aria-label="搜索"
            title="搜索（在新标签页打开；空输入可直接进入引擎官网）"
            data-testid="search-submit"
            whileHover={reduce ? undefined : { scale: 1.06 }}
            whileTap={reduce ? undefined : { scale: 0.94 }}
            transition={{ duration: 0.16, ease: EASE_OUT_CUBIC }}
            className="search-submit shrink-0"
          >
            <SearchIcon />
          </motion.button>
        </motion.div>

        {/* 建议 / 指令列表 */}
        <AnimatePresence>
          {openList ? (
            <motion.ul
              id="search-suggestions"
              role="listbox"
              aria-label="搜索建议与快捷指令"
              data-testid="suggestions"
              className="glass-strong absolute inset-x-0 top-[calc(100%+2px)] z-20 mt-1 overflow-hidden rounded-xl p-1"
              initial={{ opacity: 0, y: reduce ? 0 : -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduce ? 0 : -4 }}
              transition={{ duration: reduce ? 0 : 0.15 }}
            >
              {suggestions.map((item, index) => (
                <li
                  key={item.id}
                  id={`suggestion-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  data-testid={`suggestion-${index}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execute(query, item)}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] transition-colors ${
                    index === activeIndex ? "bg-[var(--hover-bg)] text-[var(--fg)]" : "text-[var(--fg-muted)]"
                  }`}
                >
                  <span className="shrink-0 text-[var(--fg-subtle)]" aria-hidden="true">
                    {item.kind === "command" ? <CommandIcon /> : item.kind === "direct" ? <LinkIcon /> : <SearchIcon />}
                  </span>
                  <span className="flex-1 truncate">{item.text}</span>
                  {index === activeIndex ? <span className="text-[10px] text-[var(--fg-subtle)]">Enter</span> : null}
                </li>
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      </form>

      {/* 屏幕阅读器状态：建议数量 / 加载 */}
      <span className="sr-only" aria-live="polite">
        {loadingSuggest ? "正在获取搜索建议" : openList ? `${suggestions.length} 条建议` : ""}
      </span>
      <span className="sr-only" data-testid="engine-name">
        {engine.name}
      </span>
    </motion.div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="m20 6-11 11-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CommandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m4 17 6-6-6-6M12 19h8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" strokeLinecap="round" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" strokeLinecap="round" />
    </svg>
  );
}
