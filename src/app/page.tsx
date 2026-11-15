"use client";

import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Clock } from "@/components/clock";
import { CommandPalette } from "@/components/command-palette";
import { DailyQuote } from "@/components/daily-quote";
import { useAnimatedThemeToggle } from "@/components/magicui/animated-theme-toggler";
import { NotePad } from "@/components/note-pad";
import { SearchBox } from "@/components/search-box";
import { ShortcutDock } from "@/components/shortcut-dock";
import { ShortcutGrid } from "@/components/shortcut-grid";
import { ShortcutHelp } from "@/components/shortcut-help";
import { Wallpaper } from "@/components/wallpaper";
import { Weather } from "@/components/weather";
import { WidgetBoundary } from "@/components/widget-boundary";
import { useConfig, useReducedMotionPref } from "@/lib/config-store";
import type { SettingsTab } from "@/components/settings-panel";
import { EASE_OUT_CUBIC } from "@/lib/motion";

/**
 * 设置面板按需加载（PRD 6.1：动态 import 压 TBT 与首屏体积）。
 * 它体量最大且只在点击设置后出现；命令面板因持有全局 ⌘K 监听，保持常驻挂载。
 */
const SettingsPanel = dynamic(() => import("@/components/settings-panel").then((m) => m.SettingsPanel), {
  ssr: false,
});

/**
 * 二级菜单只在「点时间 → 点齿轮」之后才可能出现。
 * 它带着 Radix DropdownMenu，按需加载能把首屏 JS 压回去；
 * 展开态下齿轮晚一个 chunk 出现，不影响交互。
 */
const SettingsMenu = dynamic(() => import("@/components/settings-menu").then((m) => m.SettingsMenu), {
  ssr: false,
});

/**
 * 顶栏动作按钮（仅经典布局使用）。
 */
function BarButton({
  label,
  onClick,
  testId,
  children,
  hint,
}: {
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  testId: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={hint ? `${label}（${hint}）` : label}
      data-testid={testId}
      whileHover={{ y: -1 }}
      whileTap={{ y: 0, scale: 0.97 }}
      transition={{ duration: 0.16, ease: EASE_OUT_CUBIC }}
      className="bar-action"
    >
      {children}
    </motion.button>
  );
}

const IconSun = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" strokeLinecap="round" />
  </svg>
);

const IconMoon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M20 14.5A8.2 8.2 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" strokeLinejoin="round" />
  </svg>
);

const IconSettings = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.7 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15.1 4.7a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.1a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" strokeLinejoin="round" />
  </svg>
);

const IconCommand = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3Z" strokeLinejoin="round" />
  </svg>
);

const IconGrid = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
  </svg>
);

export default function Home() {
  const { config, update } = useConfig();
  const reduce = useReducedMotionPref();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // null = 沿用面板上次停留的页签；指定值来自快捷设置 / 命令面板的深链
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // 设置面板一旦打开过就保持挂载，保留退出动画
  const [settingsMounted, setSettingsMounted] = useState(false);
  // 打开设置前记下触发它的按钮：关闭弹窗后焦点要回到原处
  const [settingsReturnFocus, setSettingsReturnFocus] = useState<HTMLElement | null>(null);
  // 点击时间后的「展开态」：壁纸高斯模糊，快捷方块与右上设置入口浮现
  const [revealed, setRevealed] = useState(false);
  // 右上角齿轮先出二级菜单，选完分类才打开完整设置
  const [menuOpen, setMenuOpen] = useState(false);
  const settingsTriggerRef = useRef<HTMLButtonElement | null>(null);

  const simple = config.home.simple;

  useEffect(() => {
    if (settingsOpen) setSettingsMounted(true);
  }, [settingsOpen]);

  // 切回经典布局 / 收起展开态时，菜单一并关闭
  useEffect(() => {
    if (!simple) setRevealed(false);
    if (!revealed) setMenuOpen(false);
  }, [simple, revealed]);

  const openSettings = useCallback((tab?: SettingsTab, trigger?: HTMLElement | null) => {
    // 显式传入触发按钮：鼠标点击在部分浏览器里不会自动聚焦按钮，
    // 只读 document.activeElement 会把焦点还给页面上一次停留的位置。
    setSettingsReturnFocus(trigger ?? (document.activeElement as HTMLElement | null));
    setSettingsTab(tab ?? null);
    setSettingsOpen(true);
  }, []);

  /*
   * 展开态下 Esc 收起。弹窗打开时 Esc 只关弹窗 —— 用 React 状态判断，
   * 而不是查 DOM：Radix 的 Esc 可能是捕获阶段，等这里跑到时弹窗已经关了，
   * 查 DOM 会把展开态一起收掉，焦点也无处可回。
   * 监听放在捕获阶段，确保比 Radix 更早读到「弹窗曾经开着」。
   */
  const overlayOpenRef = useRef(false);
  overlayOpenRef.current = settingsOpen || paletteOpen || helpOpen || menuOpen;

  useEffect(() => {
    if (!revealed) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (overlayOpenRef.current) return;
      setRevealed(false);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [revealed]);

  // 一屏自适应（仅经典布局）：内容高于可用高度时整体等比缩小
  const mainRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [fitScale, setFitScale] = useState(1);
  const [zoomSupported, setZoomSupported] = useState(true);

  useEffect(() => {
    try {
      setZoomSupported(CSS.supports("zoom", "0.9"));
    } catch {
      setZoomSupported("zoom" in document.documentElement.style);
    }
  }, []);

  const measure = useCallback(() => {
    const main = mainRef.current;
    const content = contentRef.current;
    if (!main || !content) return;
    const cs = window.getComputedStyle(main);
    const available = main.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const needed = content.offsetHeight + 2;
    if (needed <= 0 || available <= 0) return;
    const next = needed > available ? Math.max(0.6, ((available - 2) / needed) * 0.996) : 1;
    setFitScale((prev) => (Math.abs(prev - next) < 0.004 ? prev : next));
  }, []);

  useEffect(() => {
    // 简洁布局内容固定，不做缩放；面板展开也不该把页面缩掉
    if (simple) {
      setFitScale(1);
      return;
    }
    measure();
    const raf = requestAnimationFrame(() => requestAnimationFrame(measure));
    const ro = new ResizeObserver(() => measure());
    if (mainRef.current) ro.observe(mainRef.current);
    if (contentRef.current) ro.observe(contentRef.current);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, config, simple]);

  const [systemLight, setSystemLight] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => setSystemLight(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const isLight = config.theme.mode === "light" || (config.theme.mode === "system" && systemLight);
  const scaled = fitScale < 0.999 && zoomSupported;
  const weatherVisible = config.weather.enabled;
  const noteVisible = config.note.enabled;
  const quoteVisible = config.quote.show;

  const { toggle: toggleThemeAnimated } = useAnimatedThemeToggle();
  const toggleTheme = (event?: React.MouseEvent<HTMLButtonElement>) => {
    const origin = event ? { x: event.clientX, y: event.clientY } : undefined;
    toggleThemeAnimated(isLight, () => update("theme", { mode: isLight ? "dark" : "light" }), origin);
  };

  const dock = (
    <div className="dock-shell">
      <div className="dock-pill">
        <WidgetBoundary label="快捷跳转">
          <ShortcutDock />
        </WidgetBoundary>
      </div>
    </div>
  );

  return (
    <>
      <Wallpaper blurred={revealed} />

      <div
        className="app-shell relative z-10"
        data-layout={simple ? "simple" : "classic"}
        data-revealed={revealed ? "true" : "false"}
      >
        {simple ? (
          /*
           * 简洁首页的默认态：时间 / 搜索 / 一言 / Dock。
           * 点时间进入展开态 —— 壁纸高斯模糊，快捷方块与右上设置入口浮现；
           * 点设置打开完整弹窗，Esc 先关弹窗、再收起展开态。
           */
          <>
            {/*
             * 一层只压暗中段的柔光：壁纸四角保持锐利，时间 / 搜索所在的中轴
             * 略微压暗，白色小字才不会陷进照片的高频细节里。
             * z-index:-1 让它待在 app-shell 的层叠上下文最底部、壁纸之上。
             */}
            <div className="home-scrim" aria-hidden="true" />

            <AnimatePresence initial={false}>
              {revealed ? (
                <SettingsMenu
                  key="settings-menu"
                  open={menuOpen}
                  onOpenChange={setMenuOpen}
                  onSelect={(tab) => {
                    setMenuOpen(false);
                    openSettings(tab, settingsTriggerRef.current);
                  }}
                  trigger={
                    <motion.button
                      ref={settingsTriggerRef}
                      type="button"
                      aria-label="打开设置菜单"
                      title="设置"
                      data-testid="settings-trigger"
                      className="home-settings"
                      initial={{ opacity: 0, scale: reduce ? 1 : 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={reduce ? undefined : { scale: 1.06 }}
                      whileTap={reduce ? undefined : { scale: 0.94 }}
                      transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT_CUBIC }}
                    >
                      <IconSettings />
                    </motion.button>
                  }
                />
              ) : null}
            </AnimatePresence>

            <main id="main" tabIndex={-1} className="home-main">
              <div className="home-center">
                <div className="home-clock">
                  {config.clock.show ? (
                    <Clock onActivate={() => setRevealed((value) => !value)} active={revealed} />
                  ) : (
                    /* 时钟被关掉时，保留一个等价的入口，避免快捷方块彻底失去触发点 */
                    <button
                      type="button"
                      onClick={() => setRevealed((value) => !value)}
                      aria-expanded={revealed}
                      aria-controls={revealed ? "home-reveal" : undefined}
                      className="home-reveal-trigger"
                      title="显示快捷网站与设置"
                    >
                      <IconGrid />
                      快捷网站
                    </button>
                  )}
                </div>
                <div className="home-search">
                  <SearchBox />
                </div>
                <AnimatePresence initial={false}>
                  {revealed ? (
                    /*
                     * 高度从 0 长到 auto：主列是「auto 外边距居中」的，
                     * 展开区每长高一像素，时钟与搜索就被重新居中、平滑上移 ——
                     * 不需要给时钟写任何 transform，也就不会出现「点一下自己往上跳」。
                     */
                    <motion.div
                      key="home-reveal"
                      id="home-reveal"
                      className="home-reveal"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        height: { duration: reduce ? 0 : 0.52, ease: EASE_OUT_CUBIC },
                        opacity: { duration: reduce ? 0 : 0.3, ease: "easeOut" },
                      }}
                    >
                      <div className="home-reveal-inner">
                        <WidgetBoundary label="快捷跳转">
                          <ShortcutGrid onManage={() => openSettings("shortcuts")} />
                        </WidgetBoundary>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </main>

            {quoteVisible ? (
              <div className="home-quote" data-testid="quote-slot">
                <WidgetBoundary label="每日一言">
                  <DailyQuote />
                </WidgetBoundary>
              </div>
            ) : null}

            {dock}
          </>
        ) : (
          /* ---------------------------- 经典布局 ---------------------------- */
          <>
            <header className="flex shrink-0 items-center gap-2 px-4 py-3 sm:px-6">
              <h1 className="sr-only">起始页</h1>
              <AnimatePresence initial={false}>
                {weatherVisible ? (
                  <motion.div
                    key="weather"
                    layout={!reduce}
                    initial={{ opacity: 0, x: reduce ? 0 : -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: reduce ? 1 : 0.96, transition: { duration: 0.18 } }}
                    transition={{ duration: reduce ? 0 : 0.32, ease: EASE_OUT_CUBIC }}
                    className="weather-slot"
                    data-testid="weather-card"
                  >
                    <WidgetBoundary label="天气">
                      <Weather />
                    </WidgetBoundary>
                  </motion.div>
                ) : null}
              </AnimatePresence>
              <div className="bar-dock ml-auto">
                <BarButton
                  label={isLight ? "切换到暗色主题" : "切换到亮色主题"}
                  hint="设置里可改为跟随系统"
                  onClick={toggleTheme}
                  testId="theme-toggle"
                >
                  {isLight ? <IconMoon /> : <IconSun />}
                </BarButton>
                <BarButton label="打开命令面板" hint="⌘K" onClick={() => setPaletteOpen(true)} testId="palette-trigger">
                  <IconCommand />
                </BarButton>
                <SettingsMenu
                  open={menuOpen}
                  onOpenChange={setMenuOpen}
                  onSelect={(tab) => {
                    setMenuOpen(false);
                    openSettings(tab, settingsTriggerRef.current);
                  }}
                  trigger={
                    <motion.button
                      ref={settingsTriggerRef}
                      type="button"
                      aria-label="打开设置"
                      title="打开设置"
                      data-testid="settings-trigger"
                      whileHover={{ y: -1 }}
                      whileTap={{ y: 0, scale: 0.97 }}
                      transition={{ duration: 0.16, ease: EASE_OUT_CUBIC }}
                      className="bar-action"
                    >
                      <IconSettings />
                    </motion.button>
                  }
                />
              </div>
            </header>

            <main
              id="main"
              ref={mainRef}
              tabIndex={-1}
              data-fit-scale={scaled ? fitScale.toFixed(3) : "1"}
              className="no-scrollbar flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 pb-2 pt-1 sm:px-6"
            >
              <div
                ref={contentRef}
                className="my-auto w-full"
                style={{
                  maxWidth: "var(--content-width)",
                  zoom: scaled ? fitScale : undefined,
                }}
              >
                <div className="stage">
                  <div className="w-full">
                    <Clock />
                  </div>
                  <div className="w-full">
                    <SearchBox />
                  </div>
                  <AnimatePresence initial={false}>
                    {noteVisible ? (
                      <motion.div
                        key="note"
                        layout={!reduce}
                        initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: reduce ? 1 : 0.97, transition: { duration: 0.18 } }}
                        transition={{ duration: reduce ? 0 : 0.3, ease: EASE_OUT_CUBIC }}
                        whileHover={reduce ? undefined : { y: -2 }}
                        className="card-panel w-full"
                        data-testid="note-card-panel"
                      >
                        <WidgetBoundary label="便签">
                          <NotePad />
                        </WidgetBoundary>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </main>

            <AnimatePresence initial={false}>
              {quoteVisible ? (
                <motion.div
                  key="quote"
                  initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: reduce ? 1 : 0.97, transition: { duration: 0.16 } }}
                  transition={{ duration: reduce ? 0 : 0.3, ease: EASE_OUT_CUBIC }}
                  className="quote-shell shrink-0"
                  data-testid="quote-slot"
                >
                  <WidgetBoundary label="每日一言">
                    <DailyQuote />
                  </WidgetBoundary>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {dock}

            <footer className="flex shrink-0 items-center justify-center gap-2 px-4 pb-3 text-[11px] text-[var(--fg-subtle)] sm:px-6">
              <span data-testid="privacy-note">壁纸仅向白名单域名取图 · 数据只存本机</span>
            </footer>
          </>
        )}

        {/* ---------------------------- 浮层 ---------------------------- */}
        {settingsMounted ? (
          <WidgetBoundary label="设置" silent>
            <SettingsPanel
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              initialTab={settingsTab ?? undefined}
              returnFocusTo={settingsReturnFocus}
            />
          </WidgetBoundary>
        ) : null}
        <WidgetBoundary label="命令面板" silent>
          <CommandPalette
            open={paletteOpen}
            onOpenChange={setPaletteOpen}
            onOpenSettings={openSettings}
            onOpenHelp={() => setHelpOpen(true)}
          />
        </WidgetBoundary>

        <ShortcutHelp open={helpOpen} onOpen={() => setHelpOpen(true)} onClose={() => setHelpOpen(false)} />
      </div>
    </>
  );
}
