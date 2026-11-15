"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useConfig, useReducedMotionPref } from "@/lib/config-store";
import { Button, ConfirmDialog, Modal, TextInput, useToast } from "@/components/ui/primitives";
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

export type SettingsTab = "search" | "appearance" | "shortcuts" | "modules" | "background" | "privacy" | "about";

/**
 * 页签级关键词。
 *
 * 只用于「输入的关键词当前页签没有 → 跳到第一个可能有的页签」，
 * 真正的过滤仍按 DOM 文本做 —— 所以这里不用穷举每个开关的文案，
 * 写几个同义词够用即可。
 */
const TAB_KEYWORDS: Record<SettingsTab, string> = {
  search: "搜索引擎 引擎 建议 快捷指令 指令 排序 google bing 百度",
  appearance: "常规 外观 主题 亮色 暗色 跟随系统 强调色 颜色 暗角 减少动效 动效 简洁 经典 布局",
  shortcuts: "快捷跳转 快捷项 图标 书签 导入 排序 添加 删除",
  modules: "模块 时钟 秒 问候语 一言 便签 天气 温度 单位 城市 定位 启用",
  background: "背景 壁纸 每日一图 回溯 暗化 模糊 缩放 ken burns 自定义 上传",
  privacy: "隐私 白名单 图标 favicon 导入 导出 清除 数据 配置",
  about: "关于 版本 说明 开源 隐私 快捷键",
};

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "search", label: "搜索引擎", icon: <IconSearch /> },
  { id: "appearance", label: "外观", icon: <IconPalette /> },
  { id: "shortcuts", label: "快捷跳转", icon: <IconGrid /> },
  { id: "modules", label: "模块", icon: <IconLayers /> },
  { id: "background", label: "背景", icon: <IconImage /> },
  { id: "privacy", label: "隐私与数据", icon: <IconShield /> },
  { id: "about", label: "关于", icon: <IconInfo /> },
];

export function SettingsPanel({
  open,
  onClose,
  initialTab,
  returnFocusTo,
}: {
  open: boolean;
  onClose: () => void;
  /** 从命令面板等入口指定要打开的页签；不传则保持上一次停留的页签 */
  initialTab?: SettingsTab;
  /** 关闭后焦点回到哪；由页面在打开前捕获，避免快捷面板卸载后丢焦点 */
  returnFocusTo?: HTMLElement | null;
}) {
  const { reset } = useConfig();
  const reduce = useReducedMotionPref();
  const { push } = useToast();
  const s = useSettingsController();

  const [tab, setTab] = useState<SettingsTab>("appearance");
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [query, setQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // 关掉面板时清空搜索，下次打开回到完整列表
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // 指定页签只在「打开」或「指定值变化」时生效，不影响用户手动切换
  useEffect(() => {
    if (open && initialTab) setTab(initialTab);
  }, [open, initialTab]);

  /*
   * 按 DOM 文本过滤当前页签。
   *
   * 监听 contentRef 的子节点变化，而不是跟着 [query, tab] 跑一次：
   * AnimatePresence 的 mode="wait" 会先播完退出动画再挂载新页签，
   * 只监听 tab 的话，过滤会在新内容挂载之前执行、拿到 0 个节点。
   * MutationObserver 还能覆盖「切页签后内容异步挂载」这类情况。
   */
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;

    const apply = () => {
      const q = query.trim().toLowerCase();
      let hits = 0;
      for (const section of Array.from(root.querySelectorAll<HTMLElement>(".settings-section"))) {
        const hit = !q || (section.textContent ?? "").toLowerCase().includes(q);
        section.style.display = hit ? "" : "none";
        if (q && hit) {
          section.dataset.searchHit = "true";
          hits += 1;
        } else {
          delete section.dataset.searchHit;
        }
      }
      setMatchCount(hits);
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [query]);

  const onSearch = (value: string) => {
    setQuery(value);
    const q = value.trim().toLowerCase();
    if (!q) return;
    if (!TAB_KEYWORDS[tab].includes(q)) {
      const next = TABS.find((t) => TAB_KEYWORDS[t.id].includes(q));
      if (next && next.id !== tab) setTab(next.id);
    }
  };

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
        returnFocusTo={returnFocusTo}
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
        <div className="mb-3 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <TextInput
              value={query}
              onChange={onSearch}
              placeholder="搜索设置项，例如「模糊」「书签」"
              ariaLabel="搜索设置项"
              testId="settings-search"
            />
          </div>
          {query.trim() ? (
            <span className="shrink-0 text-[11px] text-[var(--fg-subtle)]" data-testid="settings-search-count">
              {matchCount} 项
            </span>
          ) : null}
        </div>

        <div className="flex min-h-0 w-full flex-1 flex-col gap-3 sm:flex-row sm:gap-4">
          {/*
            分类导航。
            下面「滑动胶囊底」是上一版的外观：active 项由 layoutId 共享一层圆角底，
            切换页签时它从旧位置滑到新位置。这个版本是用户要求回滚的样式，
            不要改回「菜单面板」那一版。
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
          <div
            ref={contentRef}
            className="thin-scroll min-w-0 flex-1 overflow-y-auto pr-0.5"
            data-testid="settings-content"
          >
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
