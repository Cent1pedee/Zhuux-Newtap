"use client";

import { Input } from "@/components/ui/input";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { activeEngine, orderedEngines } from "@/config/defaults";
import { asDirectUrl, commandSuggestions, parseCommand, resolveCommandUrl, resolveSearchUrl } from "@/lib/commands";
import { useConfig, useReducedMotionPref } from "@/lib/config-store";
import { EASE_OUT_CUBIC, ENTRANCE_DELAY, fadeUp } from "@/lib/motion";
import { fetchSuggestions } from "@/lib/services";
import {
  clearSearchHistory,
  loadSearchHistory,
  pushSearchHistory,
  removeSearchHistory,
  subscribeSearchHistory,
} from "@/lib/search-history";
import { useToast } from "@/components/ui/toast";
import { EngineBadge } from "@/components/engine-glyph";

type Suggestion = { id: string; text: string; kind: "suggest" | "command" | "direct" | "history" };

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
  const [history, setHistory] = useState<string[]>([]);

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
    };
  }, [query, config.suggest.enabled, config.privacy.whitelist, engine.suggestUrl, engine.id, focused]);

  // 搜索历史：独立存储，跨标签页/命令面板清除时同步刷新
  useEffect(() => {
    setHistory(loadSearchHistory());
    return subscribeSearchHistory(() => setHistory(loadSearchHistory()));
  }, []);

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
  // 输入为空且聚焦时才展示历史；一旦开始输入就交给建议列表
  const historyOpen = focused && query.trim() === "" && history.length > 0;

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
      } else if (override?.kind === "history") {
        // 历史里可能存着域名或关键词，按输入框同样的规则判定
        target = asDirectUrl(override.text) ?? resolveSearchUrl(engine.searchUrl, override.text);
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

      // 只记「真的发生了一次搜索/直达」的输入：指令与网址不入历史
      const remember = override?.kind === "history" ? override.text : input;
      if (remember) setHistory(pushSearchHistory(remember));

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
      } else if (historyOpen) {
        event.preventDefault();
        inputRef.current?.blur();
      }
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const picked = activeIndex >= 0 ? suggestions[activeIndex] : undefined;
      execute(query, picked);
    }
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
        {/*
          胶囊本身不做缩放/位移动画：参考站的三态变化全在
          背景色 / 阴影 / 文字色上（250ms 同一条缓动），
          尺寸一动，聚焦时整行会轻微抖动，反而破坏「一颗胶囊在变色」的观感。
        */}
        {/*
          胶囊不再 overflow:hidden：引擎菜单是它的子节点，
          一旦裁切，下拉列表会被 44px 高的胶囊整个切掉（点了像没反应）。
          内部没有需要裁切的内容 —— 扫光早已移除，圆角靠自身背景维持。
        */}
        <div
          className="search-panel relative flex items-center"
          data-focused={focusedMode || engineMenuOpen ? "true" : "false"}
          data-empty={query.length === 0 ? "true" : "false"}
          data-testid="search-shell"
          onMouseDown={(event) => {
            /*
             * 未聚焦时左右两枚图标是隐藏的（opacity:0 + pointer-events:none），
             * 胶囊两端会变成死区。点在空白处就直接把焦点交给输入框，
             * 不需要用户精准点到中间那条文字。
             */
            if (event.target === event.currentTarget) {
              event.preventDefault();
              inputRef.current?.focus();
            }
          }}
        >
          {/*
            引擎按钮：点一下弹菜单，由用户自己选，不再「点一下换一个」。
            循环切换看着省一次点击，实际上没法预判下一次是哪个引擎 ——
            想找百度得先猜几步。菜单一次列全，当前项带勾。
          */}
          <div className="relative shrink-0">
            <button
              ref={engineBtnRef}
              type="button"
              onClick={() => setEngineMenuOpen((v) => !v)}
              onContextMenu={(e) => {
                e.preventDefault();
                setEngineMenuOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape" && engineMenuOpen) {
                  e.preventDefault();
                  setEngineMenuOpen(false);
                }
              }}
              aria-label={`当前搜索引擎 ${engine.name}，点击选择其他引擎`}
              title="选择搜索引擎"
              aria-haspopup="menu"
              aria-expanded={engineMenuOpen}
              aria-controls={engineMenuOpen ? "engine-menu" : undefined}
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
                  size={28}
                  url={engine.homeUrl}
                  autoFetch={ready && config.icons.autoFetch}
                />
              </motion.span>
            </button>

            <AnimatePresence>
              {engineMenuOpen ? (
                <motion.div
                  ref={menuRef}
                  id="engine-menu"
                  role="menu"
                  aria-label="选择搜索引擎"
                  data-testid="engine-menu"
                  className="engine-menu glass-strong absolute left-0 top-[calc(100%+8px)] z-30 w-52 overflow-hidden rounded-xl p-1"
                  initial={{ opacity: 0, y: reduce ? 0 : -6, scale: reduce ? 1 : 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: reduce ? 0 : -4, scale: reduce ? 1 : 0.98 }}
                  transition={{ duration: reduce ? 0 : 0.16 }}
                  onKeyDown={(e) => {
                    // 菜单里按 Esc 收起并把焦点还给按钮（不留在已卸载的节点上）
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setEngineMenuOpen(false);
                      engineBtnRef.current?.focus();
                    }
                  }}
                >
                  {engines.map((e) => {
                    const active = e.id === config.engineId;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={active}
                        onClick={() => selectEngine(e.id)}
                        data-testid={`engine-option-${e.id}`}
                        className={`engine-menu-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors ${
                          active ? "text-[var(--fg)]" : "text-[var(--fg-muted)]"
                        }`}
                      >
                        <EngineBadge id={e.id} size={22} url={e.homeUrl} autoFetch={ready && config.icons.autoFetch} />
                        <span className="flex-1 truncate">{e.name}</span>
                        {active ? <CheckIcon /> : null}
                      </button>
                    );
                  })}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <Input
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
            /*
             * 占位符不能再写成「在 Google 搜索，或输入 / 使用快捷指令」——
             * 320px 屏上输入框内宽只有约 196px，那串文字会被硬切在「使」字中间，
             * 看起来像排版坏了。引擎是谁已经由左侧 favicon 和 aria-label 交代，
             * 这里只留最短的可用提示（完整说明放 title）。
             */
            placeholder="搜索"
            title="输入关键词搜索；输入 / 使用快捷指令；输入网址直接打开"
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
            /*
             * 交回胶囊自己的排版：高度占满、左右留白由 CSS 给，
             * 并且要抹掉 shadcn Input 自带的描边与 focus ring ——
             * 那圈 ring 画在输入框上，会在胶囊内部多出一层方框。
             */
            className="search-input min-w-0 flex-1 border-0 bg-transparent shadow-none outline-none focus-visible:ring-0"
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
              className="search-clear grid size-6 shrink-0 place-items-center rounded-full transition-colors duration-150"
            >
              <CloseIcon />
            </button>
          ) : null}

          {/*
            搜索键：参考站里它只是胶囊右侧一格灰色图标，
            没有实心色块、没有柔光晕 —— 整条胶囊的视觉重心交回给文字。
            指针压上去只降一点不透明度，与左侧引擎徽标同一套反馈。
          */}
          <motion.button
            type="submit"
            aria-label="搜索"
            title="搜索（在新标签页打开；空输入可直接进入引擎官网）"
            data-testid="search-submit"
            whileTap={reduce ? undefined : { scale: 0.92 }}
            transition={{ duration: 0.16, ease: EASE_OUT_CUBIC }}
            className="search-submit shrink-0"
          >
            <SearchIcon />
          </motion.button>
        </div>

        {/* 建议 / 指令列表
            不再 overflow-hidden：移动端软键盘弹起后列表要能内部滚动，
            限高与滚动策略见 globals.css 的 .search-suggestions */}
        <AnimatePresence>
          {openList ? (
            <motion.ul
              id="search-suggestions"
              role="listbox"
              aria-label="搜索建议与快捷指令"
              data-testid="suggestions"
              className="search-suggestions glass-strong absolute inset-x-0 top-[calc(100%+2px)] z-20 mt-1 rounded-xl p-1"
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
                  className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] transition-colors ${
                    index === activeIndex ? "bg-[var(--hover-bg)] text-[var(--fg)]" : "text-[var(--fg-muted)]"
                  }`}
                >
                  <span className="shrink-0 text-[var(--fg-subtle)]" aria-hidden="true">
                    {item.kind === "command" ? <CommandIcon /> : item.kind === "direct" ? <LinkIcon /> : <SearchIcon />}
                  </span>
                  <span className="flex-1 truncate">{item.text}</span>
                  {index === activeIndex ? <span className="text-[11px] text-[var(--fg-subtle)]">Enter</span> : null}
                </li>
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>

        {/* 最近搜索：只在输入为空时出现，与建议列表互斥 */}
        <AnimatePresence>
          {historyOpen ? (
            <motion.div
              data-testid="search-history"
              className="search-suggestions glass-strong absolute inset-x-0 top-[calc(100%+2px)] z-20 mt-1 rounded-xl p-1"
              initial={{ opacity: 0, y: reduce ? 0 : -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduce ? 0 : -4 }}
              transition={{ duration: reduce ? 0 : 0.15 }}
            >
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-[11px] text-[var(--fg-subtle)]">最近搜索</span>
                <button
                  type="button"
                  data-testid="search-history-clear"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setHistory(clearSearchHistory())}
                  className="rounded-[var(--radius-xs)] px-1 text-[11px] text-[var(--fg-subtle)] transition-colors hover:text-[var(--fg)]"
                >
                  清除
                </button>
              </div>
              <ul role="list" className="m-0 list-none p-0">
                {history.map((text) => (
                  <li key={text} className="group flex items-center rounded-lg hover:bg-[var(--hover-bg)]">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setQuery(text);
                        execute(text);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-[12px] text-[var(--fg-muted)]"
                    >
                      <span className="shrink-0 text-[var(--fg-subtle)]" aria-hidden="true">
                        <HistoryIcon />
                      </span>
                      <span className="truncate">{text}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`删除历史 ${text}`}
                      data-testid="search-history-remove"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setHistory(removeSearchHistory(text))}
                      className="mr-1 grid size-6 shrink-0 place-items-center rounded-[var(--radius-xs)] text-[var(--fg-subtle)] opacity-0 transition-opacity hover:text-[var(--fg)] group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <CloseIcon />
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
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

function HistoryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 4.5v4h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4.4l2.8 1.8" strokeLinecap="round" strokeLinejoin="round" />
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
