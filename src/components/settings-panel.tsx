"use client";

import { AnimatePresence, motion } from "motion/react";
import { Fragment, useDeferredValue, useEffect, useRef, useState } from "react";
import { useConfig, useReducedMotionPref } from "@/lib/config-store";
import { Button, ConfirmDialog, Modal, TextInput } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useSettingsController } from "@/components/settings/controller";
import { AboutTab } from "@/components/settings/about-tab";
import { AppearanceTab } from "@/components/settings/appearance-tab";
import { BackgroundTab } from "@/components/settings/background-tab";
import { ModulesTab } from "@/components/settings/modules-tab";
import { PrivacyTab } from "@/components/settings/privacy-tab";
import { SearchTab } from "@/components/settings/search-tab";
import { ShortcutsTab } from "@/components/settings/shortcuts-tab";
import { IconGrid, IconImage, IconLayers, IconPalette, IconSearch } from "@/components/settings/tab-icons";

/**
 * 设置层的壳。
 *
 * 三种视图共用一个 controller（草稿不丢）、一个弹窗体系：
 *   · settings —— 五个分类的主面板，左侧导航按「首页 / 外观与服务」分组；
 *   · privacy  —— 「隐私与数据」独立弹窗（命令面板直达 / 页脚入口）；
 *   · about    —— 「关于」独立弹窗（命令面板直达 / 页脚入口）。
 *
 * 齿轮不再先弹二级菜单：主面板本身就是完整的分类导航，再列一层菜单纯属重复。
 * 隐私与关于低频、且不占页签，收进页脚的两个文字入口；从页脚打开时叠在主面板
 * 之上，关闭回到原页签。
 */

/** 主面板的五个页签 */
export type SettingsTab = "appearance" | "modules" | "shortcuts" | "background" | "search";
/** 设置入口可选的目标：五个页签 + 两个独立弹窗 */
export type SettingsTarget = SettingsTab | "privacy" | "about";
/** 弹窗视图 */
export type SettingsView = "settings" | "privacy" | "about";

/**
 * 页签级关键词。
 *
 * 只用于「输入的词当前页签没有 → 跳到第一个可能有的页签」。
 * 写进来的每个词都必须能在该页签的 DOM 文本里找到 —— 历史 bug：
 * 「暗角」已迁到背景页却还留在常规页的关键词里，「快捷键」只写在关于页
 * 的关键词里却不出现在正文；搜索这两项都会停在原地、把全部分区隐藏，
 * 只剩一个空白面板。真正的过滤仍按 DOM 文本做。
 */
const TAB_KEYWORDS: Record<SettingsTab, string> = {
  appearance: "常规 首页布局 简洁首页 经典 主题 亮色 暗色 跟随系统 强调色 对比度 动效 减少动效",
  modules: "模块 时间 时钟 秒 问候语 便签 一言 语录 数据源",
  shortcuts: "快捷跳转 快捷项 站点 图标 favicon 书签 导入 排序 添加 删除",
  background: "背景 壁纸 每日一图 回溯 暗角 暗化 模糊 ken burns 自定义 上传 本地图片",
  search: "搜索引擎 引擎 搜索建议 快捷指令 指令 排序 google bing 百度",
};

type TabDef = {
  id: SettingsTab;
  label: string;
  icon: React.ReactNode;
  group: "home" | "service";
};

const TAB_GROUPS: { id: TabDef["group"]; label: string }[] = [
  { id: "home", label: "首页" },
  { id: "service", label: "外观与服务" },
];

const TABS: TabDef[] = [
  // 常规置首，也是默认打开的页签；同组内按「先整体、后局部」排
  { id: "appearance", label: "常规", icon: <IconPalette />, group: "home" },
  { id: "modules", label: "模块", icon: <IconLayers />, group: "home" },
  { id: "shortcuts", label: "快捷跳转", icon: <IconGrid />, group: "home" },
  { id: "background", label: "背景", icon: <IconImage />, group: "service" },
  { id: "search", label: "搜索引擎", icon: <IconSearch />, group: "service" },
];

export function SettingsPanel({
  open,
  onClose,
  view = "settings",
  initialTab,
  returnFocusTo,
  onOpenHelp,
}: {
  open: boolean;
  onClose: () => void;
  /** 「隐私与数据 / 关于」直接进对应弹窗，不经过主面板 */
  view?: SettingsView;
  /** 从命令面板等入口指定要打开的页签；不传则保持上一次停留的页签 */
  initialTab?: SettingsTab;
  /** 关闭后焦点回到哪；由页面在打开前捕获，避免快捷面板卸载后丢焦点 */
  returnFocusTo?: HTMLElement | null;
  /** 「关于」里的查看快捷键入口 */
  onOpenHelp?: () => void;
}) {
  const { reset } = useConfig();
  const reduce = useReducedMotionPref();
  const { push } = useToast();
  const s = useSettingsController();

  const [tab, setTab] = useState<SettingsTab>("appearance");
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  /*
   * 隐私 / 关于不再是二级菜单的入口，但也不适合再占一个页签：
   * 它们低频、且内容与五分类不同。改成设置页脚的两个文字入口，
   * 点开后在主面板之上叠一层更轻的弹窗，关闭即回到原页签。
   */
  const [subView, setSubView] = useState<"privacy" | "about" | null>(null);
  const privacyBtnRef = useRef<HTMLButtonElement | null>(null);
  const aboutBtnRef = useRef<HTMLButtonElement | null>(null);
  const [query, setQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  /*
   * 过滤是按 DOM 文本逐 section 遍历的命令式操作，输入每敲一个字都会重跑。
   * 用 deferred 值承接过滤，React 会在快速输入时跳过中间态、只提交最后一次，
   * 输入本身不再被过滤阻塞（CPU 4x 下原本会出现 51ms 长任务）。
   * 跨页签跳转仍读即时 query，保证「输完就跳」的响应不打折。
   */
  const deferredQuery = useDeferredValue(query);
  const contentRef = useRef<HTMLDivElement>(null);

  // 关掉面板时清空搜索，下次打开回到完整列表
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // 指定页签只在「打开」或「指定值变化」时生效，不影响用户手动切换
  useEffect(() => {
    if (open && view === "settings" && initialTab) setTab(initialTab);
  }, [open, view, initialTab]);

  /*
   * 按 DOM 文本过滤当前页签。
   *
   * observer 只观察内容根节点的直接 childList：AnimatePresence mode="wait"
   * 会等 180ms 退出动画播完才挂载新页签，光靠 [query, tab, open] 的 effect
   * 会过滤到旧内容上；输入文字只改属性/文本，不会产生 childList 变化。
   */
  useEffect(() => {
    if (view !== "settings") return;
    const root = contentRef.current;
    if (!root) return;

    const apply = () => {
      const q = deferredQuery.trim().toLowerCase();
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
    if (!deferredQuery.trim()) return;
    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true });
    return () => observer.disconnect();
  }, [deferredQuery, tab, open, view]);

  /**
   * 内容区是否真的在滚。
   * 只有真的溢出时才在底边加一道渐隐 —— 否则「刚好放得下」的页签
   * 也会把最后一行的下沿压暗，看起来像没渲染完。
   *
   * 历史 bug：ResizeObserver 只观察滚动容器，而容器自身的盒子从不随内容
   * 高度变化，再加上 AnimatePresence 延迟挂载，切换页签后标记会反过来
   * （shortcuts 明明要滚却标 false，appearance 不滚却还留着 true）。
   * 现在同时观察内层 .settings-body，并在内容根节点 childList 变化时重新挂观察器。
   */
  const [scrollable, setScrollable] = useState(false);
  useEffect(() => {
    if (view !== "settings" || !open) return;
    const el = contentRef.current;
    if (!el) return;
    const update = () => setScrollable(el.scrollHeight - el.clientHeight > 4);
    const ro = new ResizeObserver(update);
    const observe = () => {
      ro.disconnect();
      ro.observe(el);
      el.querySelectorAll(".settings-body").forEach((node) => ro.observe(node));
      update();
    };
    observe();
    const mo = new MutationObserver(observe);
    mo.observe(el, { childList: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [tab, query, open, view]);

  const onSearch = (value: string) => {
    setQuery(value);
    const q = value.trim().toLowerCase();
    if (!q) return;
    if (!TAB_KEYWORDS[tab].includes(q)) {
      const next = TABS.find((t) => TAB_KEYWORDS[t.id].includes(q));
      if (next && next.id !== tab) setTab(next.id);
    }
  };

  const clearDialogs = (
    <>
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

  /* ---------------------------- 隐私与数据（独立视图或页脚子视图） ---------------------------- */
  const privacyOpen = view === "privacy" ? open : subView === "privacy";
  const privacyModal = (
    <Modal
      open={privacyOpen}
      onClose={view === "privacy" ? onClose : () => setSubView(null)}
      title="隐私与数据"
      description="请求白名单、配置备份与本地数据清理。"
      size="md"
      reduceMotion={reduce}
      panelClassName="settings-modal settings-modal--compact"
      bodyClassName="thin-scroll settings-compact-body flex-1 overflow-y-auto px-5 py-4"
      overlayClassName="bg-black/25 backdrop-blur-[2px]"
      returnFocusTo={view === "privacy" ? returnFocusTo : privacyBtnRef.current}
      initialFocus="panel"
      footer={
        <Button
          onClick={view === "privacy" ? onClose : () => setSubView(null)}
          variant="primary"
          testId="privacy-done"
        >
          完成
        </Button>
      }
    >
      <PrivacyTab s={s} onClear={() => setConfirmClear(true)} />
    </Modal>
  );

  /* ---------------------------- 关于（独立视图或页脚子视图） ---------------------------- */
  const aboutOpen = view === "about" ? open : subView === "about";
  const aboutModal = (
    <Modal
      open={aboutOpen}
      onClose={view === "about" ? onClose : () => setSubView(null)}
      title="关于"
      description="站点信息、技术栈与快捷入口。"
      size="md"
      reduceMotion={reduce}
      panelClassName="settings-modal settings-modal--compact"
      bodyClassName="thin-scroll settings-compact-body flex-1 overflow-y-auto px-5 py-4"
      overlayClassName="bg-black/25 backdrop-blur-[2px]"
      returnFocusTo={view === "about" ? returnFocusTo : aboutBtnRef.current}
      initialFocus="panel"
      footer={
        <Button
          onClick={view === "about" ? onClose : () => setSubView(null)}
          variant="primary"
          testId="about-done"
        >
          完成
        </Button>
      }
    >
      <AboutTab s={s} onOpenHelp={onOpenHelp} onClose={onClose} />
    </Modal>
  );

  if (view === "privacy") {
    return (
      <>
        {privacyModal}
        {clearDialogs}
      </>
    );
  }

  if (view === "about") {
    return (
      <>
        {aboutModal}
        {clearDialogs}
      </>
    );
  }

  /* ---------------------------- 主设置面板：五个分类 ---------------------------- */
  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="设置"
        description="配置只存在本机；备份、隐私边界与站点信息在页脚。"
        size="lg"
        reduceMotion={reduce}
        fixedHeight
        panelClassName="settings-modal"
        returnFocusTo={returnFocusTo}
        bodyClassName="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-5"
        footer={
          <>
            <div className="mr-auto flex items-center gap-1">
              <button
                ref={privacyBtnRef}
                type="button"
                onClick={() => setSubView("privacy")}
                data-testid="settings-open-privacy"
                className="settings-footer-link"
              >
                隐私与数据
              </button>
              <span aria-hidden="true" className="text-[var(--fg-subtle)] opacity-50">
                ·
              </span>
              <button
                ref={aboutBtnRef}
                type="button"
                onClick={() => setSubView("about")}
                data-testid="settings-open-about"
                className="settings-footer-link"
              >
                关于
              </button>
            </div>
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
            分类导航按「首页 / 外观与服务」两组分层，组名只在桌面竖排时显示；
            窄屏是横排，组名会让按钮换行挤成一团，交给 CSS 隐藏。
            选中项仍由 layoutId 共享一层胶囊底，切换时从旧位置滑到新位置。
          */}
          <nav aria-label="设置分类" className="settings-nav">
            {TAB_GROUPS.map((group, groupIndex) => (
              <Fragment key={group.id}>
                {groupIndex > 0 ? <span className="settings-nav-sep" aria-hidden="true" /> : null}
                <span className="settings-nav-label" aria-hidden="true">
                  {group.label}
                </span>
                {TABS.filter((t) => t.group === group.id).map((t) => {
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
              </Fragment>
            ))}
          </nav>

          {/* 右侧内容区：只有这里滚动，面板本身不撑破视口 */}
          <div
            ref={contentRef}
            className="settings-content thin-scroll min-w-0 flex-1 overflow-y-auto pr-0.5"
            data-testid="settings-content"
            data-scrollable={scrollable ? "true" : "false"}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduce ? 0 : -6 }}
                transition={{ duration: reduce ? 0 : 0.18, ease: [0.215, 0.61, 0.355, 1] }}
              >
                {tab === "appearance" ? <AppearanceTab s={s} /> : null}
                {tab === "modules" ? <ModulesTab s={s} /> : null}
                {tab === "shortcuts" ? <ShortcutsTab s={s} /> : null}
                {tab === "background" ? <BackgroundTab s={s} /> : null}
                {tab === "search" ? <SearchTab s={s} /> : null}
              </motion.div>
            </AnimatePresence>

            {/* 搜索无结果：以前是一块空白面板，连「搜不到了」都不说 */}
            {query.trim() && matchCount === 0 ? (
              <div className="settings-search-empty" data-testid="settings-search-empty" role="status">
                <p className="settings-search-empty-title">没有找到「{query.trim()}」</p>
                <p className="settings-search-empty-note">
                  试试「壁纸」「模糊」「书签」这类关键词，或清空搜索查看全部分类。
                  隐私与数据、关于在设置页脚。
                </p>
                <Button onClick={() => setQuery("")} size="sm" testId="settings-search-clear">
                  清空搜索
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </Modal>

      {privacyModal}
      {aboutModal}
      {clearDialogs}
    </>
  );
}
