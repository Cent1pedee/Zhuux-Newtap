"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useConfig, useReducedMotionPref } from "@/lib/config-store";
import { Button, ConfirmDialog, Modal, useToast } from "@/components/ui/primitives";
import { useSettingsController } from "@/components/settings/controller";
import { AboutTab } from "@/components/settings/about-tab";
import { AppearanceTab } from "@/components/settings/appearance-tab";
import { BackgroundTab } from "@/components/settings/background-tab";
import { ModulesTab } from "@/components/settings/modules-tab";
import { PrivacyTab } from "@/components/settings/privacy-tab";
import { SearchTab } from "@/components/settings/search-tab";
import { ShortcutsTab } from "@/components/settings/shortcuts-tab";
import { IconGrid, IconImage, IconInfo, IconLayers, IconPalette, IconSearch, IconShield } from "@/components/settings/tab-icons";

/**
 * 设置面板的壳。
 *
 * 职责只剩三件：分类导航、内容区的进出动画、两个二次确认。
 * 具体每个页签长什么样在自己文件里（settings/*-tab.tsx），
 * 草稿状态与副作用在 settings/controller.ts —— 这样切页签不会丢草稿，
 * 新增页签也只需要动 TABS 一处。
 */

type Tab = "search" | "appearance" | "shortcuts" | "modules" | "background" | "privacy" | "about";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "search", label: "搜索引擎", icon: <IconSearch /> },
  { id: "appearance", label: "外观", icon: <IconPalette /> },
  { id: "shortcuts", label: "快捷跳转", icon: <IconGrid /> },
  { id: "modules", label: "模块", icon: <IconLayers /> },
  { id: "background", label: "背景", icon: <IconImage /> },
  { id: "privacy", label: "隐私与数据", icon: <IconShield /> },
  { id: "about", label: "关于", icon: <IconInfo /> },
];

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { reset } = useConfig();
  const reduce = useReducedMotionPref();
  const { push } = useToast();
  const s = useSettingsController();

  const [tab, setTab] = useState<Tab>("appearance");
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="设置"
        description="所有配置只保存在本机 localStorage。接口请求只走白名单（壁纸 / 一言 / 天气）；站点图标会向对应域名取一次 favicon，可在「隐私与数据」关闭。"
        size="lg"
        reduceMotion={reduce}
        fixedHeight
        bodyClassName="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-5"
        footer={
          <>
            <Button onClick={() => setConfirmReset(true)} variant="ghost" testId="settings-reset">
              恢复出厂
            </Button>
            <Button onClick={onClose} variant="primary" testId="settings-done">
              完成
            </Button>
          </>
        }
      >
        <div className="flex min-h-0 w-full flex-1 flex-col gap-3 sm:flex-row sm:gap-4">
          {/*
            分类导航。
            早先用 `boxShadow: inset 2px 0 0 var(--accent)` 画左侧强调条 —— 那是一条
            画在按钮内部的线，和 padding 完全脱钩：文字一长、字号一换，线就贴着左边缘
            漂出去，移动端横排时更是整条错位（用户说的「设置里的按钮有偏移」）。
            改成「一颗真正会滑动的胶囊底」：active 项由 layoutId 共享一层圆角底，
            切换页签时它从旧位置滑到新位置，视觉上是一条连贯的动线，而不再是一根
            对不准的边线。
          */}
          <nav aria-label="设置分类" className="settings-nav">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-current={active ? "page" : undefined}
                  data-testid={`settings-tab-${t.id}`}
                  className={`settings-tab ${active ? "settings-tab--active" : ""}`}
                >
                  {active ? (
                    <motion.span
                      layoutId={reduce ? undefined : "settings-tab-pill"}
                      className="settings-tab-pill"
                      aria-hidden="true"
                      transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
                    />
                  ) : null}
                  <span className="settings-tab-icon" aria-hidden="true">
                    {t.icon}
                  </span>
                  <span className="whitespace-nowrap">{t.label}</span>
                </button>
              );
            })}
          </nav>

          {/* 右侧内容区：只有这里滚动，面板本身不撑破视口 */}
          <div className="thin-scroll min-w-0 flex-1 overflow-y-auto pr-0.5" data-testid="settings-content">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduce ? 0 : -6 }}
                transition={{ duration: reduce ? 0 : 0.18, ease: [0.215, 0.61, 0.355, 1] }}
              >
                {tab === "search" ? <SearchTab s={s} /> : null}
                {tab === "appearance" ? <AppearanceTab s={s} /> : null}
                {tab === "shortcuts" ? <ShortcutsTab /> : null}
                {tab === "modules" ? <ModulesTab s={s} /> : null}
                {tab === "background" ? <BackgroundTab s={s} /> : null}
                {tab === "privacy" ? <PrivacyTab s={s} onClear={() => setConfirmClear(true)} /> : null}
                {tab === "about" ? <AboutTab s={s} /> : null}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmReset}
        title="恢复出厂设置"
        description="将重置全部配置（引擎、快捷项、主题、背景等）为默认值，不影响其他站点数据。"
        confirmText="恢复"
        danger
        reduceMotion={reduce}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          reset();
          setConfirmReset(false);
          push("已恢复出厂设置", "success");
        }}
      />

      <ConfirmDialog
        open={confirmClear}
        title="清除全部本地数据"
        description="将清空 localStorage 配置与 IndexedDB 图片缓存，并重置为出厂状态。此操作不可撤销。"
        confirmText="清除"
        danger
        reduceMotion={reduce}
        onCancel={() => setConfirmClear(false)}
        onConfirm={async () => {
          // 先清空持久层，再重置内存配置：reset 会触发写回，顺序反过来会把刚清掉的 key 又写回去
          const { clearAllData } = await import("@/lib/storage");
          await clearAllData();
          reset();
          setConfirmClear(false);
          push("本地数据已清空", "success");
        }}
      />
    </>
  );
}
