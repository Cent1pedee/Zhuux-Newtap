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
import { Wallpaper } from "@/components/wallpaper";
import { Weather } from "@/components/weather";
import { useConfig, useReducedMotionPref } from "@/lib/config-store";
import { EASE_OUT_CUBIC } from "@/lib/motion";

/**
 * 设置面板按需加载（PRD 6.1：动态 import 压 TBT 与首屏体积）。
 * 它体量最大且只在点击设置后出现；命令面板因持有全局 ⌘K 监听，保持常驻挂载。
 */
const SettingsPanel = dynamic(() => import("@/components/settings-panel").then((m) => m.SettingsPanel), {
  ssr: false,
});

/**
 * 顶栏动作按钮。
 * 三个入口收进一个整体胶囊（.bar-dock），按钮本身是圆形（.bar-action），
 * 悬停时底部浮出强调色辉光、并有一道斜向高光扫过 —— Magic UI Shimmer 的极简版。
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

export default function Home() {
  const { config, update } = useConfig();
  const reduce = useReducedMotionPref();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // 设置面板一旦打开过就保持挂载，保留退出动画
  const [settingsMounted, setSettingsMounted] = useState(false);
  useEffect(() => {
    if (settingsOpen) setSettingsMounted(true);
  }, [settingsOpen]);

  // 一屏自适应：内容高于可用高度时整体等比缩小，而不是让页面滚动（PRD 3.2）
  const mainRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [fitScale, setFitScale] = useState(1);

  const measure = useCallback(() => {
    const main = mainRef.current;
    const content = contentRef.current;
    if (!main || !content) return;
    // 可用高度要扣掉 main 自身的上下内边距，否则内容会被 padding 顶出可视区
    const cs = window.getComputedStyle(main);
    const available = main.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    // 用 offsetHeight（不受 zoom 影响）拿内容的「自然高度」，再与可用高度比；
    // 留 2px 余量吸收亚像素取整，否则缩放后仍会多出 1px 触发滚动条
    const needed = content.offsetHeight + 2;
    if (needed <= 0 || available <= 0) return;
    // 只在真的放不下时缩放；下限 0.6 是「再小就难以阅读」的阈值，到不了才由内部滚动兜底。
    // 额外留 2px 与 0.4% 的余量：zoom 的渲染取整会让实际高度比理论值多出 1-2px，
    // 不留余量时底部会差 1px 触发滚动条（1280×600 上必现）。
    const next = needed > available ? Math.max(0.6, ((available - 2) / needed) * 0.996) : 1;
    setFitScale((prev) => (Math.abs(prev - next) < 0.004 ? prev : next));
  }, []);

  useEffect(() => {
    measure();
    // 缩放本身会改变内容尺寸，等两帧再量一次让 ResizeObserver 收敛（首帧量到的是未缩放高度）
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
  }, [measure, config]);

  // 主题跟随系统时，按系统偏好解析实际明暗（用于切换按钮图标）
  const [systemLight, setSystemLight] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => setSystemLight(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const isLight = config.theme.mode === "light" || (config.theme.mode === "system" && systemLight);
  const scaled = fitScale < 0.999;
  const quoteVisible = config.quote.show;
  const noteVisible = config.note.enabled;
  const weatherVisible = config.weather.enabled;
  // 天气与便签各自独立成卡：不再套进同一块 Bento 玻璃板。
  // 两者都是「次级信息」，但彼此无关，锁在一个框里只会让整块看起来像
  // 一个与内容无关的装饰容器。各自成卡后，谁被关掉都不影响另一个的排版。
  const noteCardVisible = noteVisible;
  const weatherCardVisible = weatherVisible;

  // 主题切换走 View Transitions 圆形扩散（Magic UI Animated Theme Toggler）
  const { toggle: toggleThemeAnimated } = useAnimatedThemeToggle();
  const toggleTheme = (event?: React.MouseEvent<HTMLButtonElement>) => {
    const origin = event ? { x: event.clientX, y: event.clientY } : undefined;
    toggleThemeAnimated(isLight, () => update("theme", { mode: isLight ? "dark" : "light" }), origin);
  };

  return (
    <>
      <Wallpaper />

      <div className="app-shell relative z-10">
        {/* ---------------------------- 顶栏 ---------------------------- */}
        {/*
          顶栏左侧留给天气：它是一个「环境读数」，不是页面内容，
          压在主列里会打断「时钟 → 搜索 → 便签」这条主轴；
          固定在左上角既不抢视线，又始终在余光里。
        */}
        <header className="flex shrink-0 items-center gap-2 px-4 py-3 sm:px-6">
          <h1 className="sr-only">起始页</h1>
          <AnimatePresence initial={false}>
            {weatherCardVisible ? (
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
                <Weather />
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
            <BarButton label="打开设置" onClick={() => setSettingsOpen(true)} testId="settings-trigger">
              <IconSettings />
            </BarButton>
          </div>
        </header>

        {/* ---------------------------- 主体 ---------------------------- */}
        <main
          id="main"
          ref={mainRef}
          tabIndex={-1}
          data-fit-scale={scaled ? fitScale.toFixed(3) : "1"}
          className={`no-scrollbar flex min-h-0 flex-1 flex-col items-center px-4 pb-2 pt-1 sm:px-6 ${
            scaled ? "overflow-hidden" : "overflow-y-auto"
          }`}
        >
          {/*
            居中用 m-auto 而非 justify-center：内容超出视口时前者不会裁掉顶部。
            放不下时按 fitScale 等比缩小，保证「一屏呈现、页面不滚动」；
            缩到下限仍不够，才由 main 内部滚动兜底。
          */}
          <div
            ref={contentRef}
            className="my-auto w-full"
            style={{
              maxWidth: "var(--content-width)",
              // 用 zoom 而不是 transform:scale —— zoom 会真实改变布局尺寸，
              // main 的 scrollHeight 随之收敛，居中与「无滚动」才都成立
              zoom: scaled ? fitScale : undefined,
            }}
          >
            {/*
              一屏竖向舞台（对齐青柠起始页的层次）：
                时钟 → 搜索框 → 天气卡 → 便签卡。
              每个模块都是独立的一张，谁也不套在谁的框里 ——
              早先它们是同一块 Bento 玻璃板里的两个格子，用户一眼就觉得
              「被锁在一个框内」。拆成两张自己的卡之后，关掉任意一个都不会
              在版面上留下别人的空盒子。
            */}
            <div className="stage">
              {/* 时钟：无容器、直接压在大背景上，只靠字号与光 */}
              <div className="w-full">
                <Clock />
              </div>

              {/* 搜索框：独立的白色胶囊 */}
              <div className="w-full">
                <SearchBox />
              </div>

              {/* 便签卡：同样独立成卡 */}
              <AnimatePresence initial={false}>
                {noteCardVisible ? (
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
                    <NotePad />
                  </motion.div>
                ) : null}
              </AnimatePresence>

            </div>
          </div>
        </main>

        {/*
          每日一言：单独一条固定在「主体」与「底部 Dock」之间。
          放在 <main> 外面而不是舞台末尾 —— 这样无论中间内容多少，
          它始终贴着 Dock 上方那一带，不会因为内容变高/变矮而漂到中间去。
          这也是参考站的位置：引言几乎贴着底部胶囊。
        */}
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
              <DailyQuote />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ---------------------------- 底部 Dock ---------------------------- */}
        {/*
          快捷跳转沉到页面底部，做成一颗悬浮的玻璃胶囊（对齐青柠起始页）：
          图标本身没有卡片、没有分组标题，整排被这一颗胶囊托住。
        */}
        <div className="dock-shell shrink-0">
          <div className="dock-pill">
            <ShortcutDock />
          </div>
        </div>

        {/* ---------------------------- 页脚 ---------------------------- */}
        <footer className="flex shrink-0 items-center justify-center gap-2 px-4 pb-3 text-[10.5px] text-[var(--fg-subtle)] sm:px-6">
          <span data-testid="privacy-note">壁纸仅向白名单域名取图 · 数据只存本机</span>
        </footer>
      </div>

      {/* ---------------------------- 浮层 ---------------------------- */}
      {settingsMounted ? (
        <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      ) : null}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onOpenSettings={() => {
          setPaletteOpen(false);
          window.setTimeout(() => setSettingsOpen(true), 80);
        }}
      />

    </>
  );
}
