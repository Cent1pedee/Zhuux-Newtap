"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ACCENTS, ENGINES, SITE } from "@/config/site";
import { PROVINCES, citiesOf, findCity, nearestCity } from "@/config/cities";
import type { AppConfig } from "@/config/types";
import { createDefaultConfig } from "@/config/defaults";
import { useConfig, useReducedMotionPref } from "@/lib/config-store";
import { accentContrast, isAccentAcceptable } from "@/lib/color";
import { mergeConfig } from "@/lib/storage";
import {
  Button,
  ConfirmDialog,
  Field,
  Modal,
  Range,
  Segmented,
  Switch,
  TextInput,
  useToast,
} from "@/components/ui/primitives";
import { ShortcutManager } from "@/components/shortcut-manager";
import { EngineBadge } from "@/components/engine-glyph";

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
  const { config, set, update, replace, reset } = useConfig();
  const reduce = useReducedMotionPref();
  const { push } = useToast();
  const [tab, setTab] = useState<Tab>("appearance");
  /* 设置里的省份草稿：选省份只切城市列表，不立刻写库（否则城市会被强行改成第一个） */
  const [provinceDraft, setProvinceDraft] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  /* ------------------------------ 引擎排序 ------------------------------ */
  const moveEngine = (id: string, delta: number) => {
    const order = [...config.engineOrder];
    const index = order.indexOf(id);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
    set("engineOrder", order);
  };

  const toggleEngine = (id: string, enabled: boolean) => {
    if (enabled) {
      if (config.engineOrder.includes(id)) return;
      set("engineOrder", [...config.engineOrder, id]);
      push("已启用引擎", "success");
      return;
    }
    if (config.engineOrder.length <= 1) {
      push("至少保留一个搜索引擎", "error");
      return;
    }
    const order = config.engineOrder.filter((e) => e !== id);
    set("engineOrder", order);
    if (config.engineId === id) set("engineId", order[0]);
    push("已停用引擎", "success");
  };

  /* ------------------------------ 快捷指令 ------------------------------ */
  const [cmdDraft, setCmdDraft] = useState({ key: "", label: "", url: "", siteUrl: "" });
  const addCommand = () => {
    const key = cmdDraft.key.trim();
    const label = cmdDraft.label.trim();
    const url = cmdDraft.url.trim();
    if (!key || !label || !url) {
      push("指令、名称、地址均为必填", "error");
      return;
    }
    if (!key.startsWith("/")) {
      push("指令需以 / 开头", "error");
      return;
    }
    if (config.quickCommands.some((c) => c.key.toLowerCase() === key.toLowerCase())) {
      push("指令已存在", "error");
      return;
    }
    if (config.quickCommands.length >= 24) {
      push("快捷指令最多 24 条", "error");
      return;
    }
    set("quickCommands", [
      ...config.quickCommands,
      { id: `cmd-${Date.now().toString(36)}`, key, label, url, siteUrl: cmdDraft.siteUrl.trim() || url },
    ]);
    setCmdDraft({ key: "", label: "", url: "", siteUrl: "" });
    push("已添加快捷指令", "success");
  };

  /* ------------------------------ 强调色 ------------------------------ */
  const [customAccent, setCustomAccent] = useState(config.theme.accent);
  useEffect(() => setCustomAccent(config.theme.accent), [config.theme.accent]);
  const contrast = accentContrast(customAccent, config.theme.mode === "light" ? "light" : "dark");
  const acceptable = isAccentAcceptable(customAccent, config.theme.mode === "light" ? "light" : "dark");

  /* ------------------------------ 背景 ------------------------------ */
  const [wallpaperUrl, setWallpaperUrl] = useState(
    config.wallpaper.source === "url" ? config.wallpaper.value : "",
  );
  const wallpaperFileRef = useRef<HTMLInputElement>(null);

  const applyWallpaperUrl = () => {
    const value = wallpaperUrl.trim();
    if (!value) {
      push("请填写图片地址", "error");
      return;
    }
    if (!/^https?:\/\//i.test(value) && !value.startsWith("data:image/")) {
      push("图片需为 http(s) 地址", "error");
      return;
    }
    set("wallpaper", { source: "url", value });
    push("背景图片已应用", "success");
  };

  const onWallpaperFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      push("请选择图片文件", "error");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      push("图片需小于 8MB", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      set("wallpaper", { source: "local", value: reader.result });
      push("本地图片已应用", "success");
    };
    reader.readAsDataURL(file);
  };

  /* ------------------------------ 导入导出 ------------------------------ */
  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `startpage-config-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    push("配置已导出", "success");
  };

  const onImportFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1024 * 1024) {
      push("配置文件过大（>1MB）", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as unknown;
        if (!parsed || typeof parsed !== "object") throw new Error("bad");
        const merged = mergeConfig(createDefaultConfig(), parsed);
        replace(merged);
        push("配置已导入", "success");
      } catch {
        push("配置文件解析失败，请检查 JSON 格式", "error");
      }
    };
    reader.readAsText(file);
  };

  const [whitelistDraft, setWhitelistDraft] = useState("");
  const addWhitelist = () => {
    const host = whitelistDraft
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
    if (!host || !host.includes(".")) {
      push("请输入有效域名，例如 example.com", "error");
      return;
    }
    if (config.privacy.whitelist.includes(host)) {
      push("该域名已在白名单", "info");
      return;
    }
    update("privacy", { whitelist: [...config.privacy.whitelist, host] });
    setWhitelistDraft("");
    push("已加入白名单", "success");
  };

  const enabledEngines = useMemo(
    () => config.engineOrder.map((id) => ENGINES.find((e) => e.id === id)).filter(Boolean),
    [config.engineOrder],
  );

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
                {/* ------------------------- 搜索 ------------------------- */}
                {tab === "search" ? (
                  <div className="settings-body">
                    <section className="settings-section">
                      <h3 className="settings-h3">搜索引擎</h3>
                      <p className="mb-2 text-[11px] text-[var(--fg-subtle)]">
                        点击引擎图标循环切换，右键打开列表。至少保留一个。
                      </p>
                      <ul className="space-y-1">
                        {ENGINES.map((engine) => {
                          const enabled = config.engineOrder.includes(engine.id);
                          const index = config.engineOrder.indexOf(engine.id);
                          return (
                            <li
                              key={engine.id}
                              className="flex items-center gap-2 rounded-lg border border-[var(--glass-border)] px-2 py-1.5"
                            >
                              <EngineBadge
                                id={engine.id}
                                size={22}
                                url={engine.homeUrl}
                                autoFetch={config.icons.autoFetch}
                              />
                              <span className="flex-1 truncate text-[12.5px]">{engine.name}</span>
                              {enabled ? (
                                <div className="flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => moveEngine(engine.id, -1)}
                                    disabled={index <= 0}
                                    aria-label={`上移 ${engine.name}`}
                                    data-testid={`engine-up-${engine.id}`}
                                    className="grid size-6 place-items-center rounded text-[var(--fg-subtle)] hover:bg-[var(--hover-bg)] hover:text-[var(--fg)] disabled:opacity-30"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveEngine(engine.id, 1)}
                                    disabled={index >= config.engineOrder.length - 1}
                                    aria-label={`下移 ${engine.name}`}
                                    data-testid={`engine-down-${engine.id}`}
                                    className="grid size-6 place-items-center rounded text-[var(--fg-subtle)] hover:bg-[var(--hover-bg)] hover:text-[var(--fg)] disabled:opacity-30"
                                  >
                                    ↓
                                  </button>
                                </div>
                              ) : null}
                              <MiniSwitch
                                checked={enabled}
                                onChange={(next) => toggleEngine(engine.id, next)}
                                label={`${enabled ? "停用" : "启用"} ${engine.name}`}
                                testId={`engine-toggle-${engine.id}`}
                              />
                            </li>
                          );
                        })}
                      </ul>
                      <p className="mt-1.5 text-[11px] text-[var(--fg-subtle)]">
                        当前启用：{enabledEngines.map((e) => e?.name).join(" / ") || "无"}
                      </p>
                    </section>

                    <section className="settings-section">
                      <h3 className="settings-h3">搜索建议</h3>
                      <Switch
                        checked={config.suggest.enabled}
                        onChange={(v) => update("suggest", { enabled: v })}
                        label="启用实时搜索建议"
                        description="开启后仅请求当前引擎的 suggest 接口（api.bing.com），其余引擎无建议源。关闭则零网络请求。"
                        testId="suggest-toggle"
                      />
                    </section>

                    <section className="settings-section">
                      <h3 className="settings-h3">快捷指令</h3>
                      <p className="mb-2 text-[11px] text-[var(--fg-subtle)]">
                        在搜索框输入 <code className="kbd">/g 关键词</code> 直达对应站点；无关键词时打开站点首页。
                      </p>
                      <ul className="mb-2 space-y-1">
                        {config.quickCommands.map((c) => (
                          <li
                            key={c.id}
                            className="flex items-center gap-2 rounded-lg border border-[var(--glass-border)] px-2 py-1.5"
                          >
                            <span className="rounded bg-[var(--input-bg)] px-1.5 py-0.5 font-mono text-[11px]">
                              {c.key}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[12px]">{c.label}</span>
                            <button
                              type="button"
                              onClick={() => {
                                set("quickCommands", config.quickCommands.filter((x) => x.id !== c.id));
                                push("已删除指令", "success");
                              }}
                              aria-label={`删除指令 ${c.key}`}
                              data-testid={`cmd-delete-${c.id}`}
                              className="grid size-6 place-items-center rounded text-[var(--fg-subtle)] hover:bg-red-500/15 hover:text-red-400"
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                      <div className="grid grid-cols-2 gap-1.5">
                        <TextInput
                          value={cmdDraft.key}
                          onChange={(v) => setCmdDraft({ ...cmdDraft, key: v })}
                          placeholder="/x"
                          ariaLabel="指令触发词"
                          maxLength={8}
                          testId="cmd-key"
                        />
                        <TextInput
                          value={cmdDraft.label}
                          onChange={(v) => setCmdDraft({ ...cmdDraft, label: v })}
                          placeholder="名称"
                          ariaLabel="指令名称"
                          maxLength={12}
                          testId="cmd-label"
                        />
                        <div className="col-span-2">
                          <TextInput
                            value={cmdDraft.url}
                            onChange={(v) => setCmdDraft({ ...cmdDraft, url: v })}
                            placeholder="搜索地址，含 {q} 占位符"
                            ariaLabel="指令搜索地址"
                            testId="cmd-url"
                          />
                        </div>
                        <div className="col-span-2">
                          <TextInput
                            value={cmdDraft.siteUrl}
                            onChange={(v) => setCmdDraft({ ...cmdDraft, siteUrl: v })}
                            placeholder="站点首页（无关键词时打开）"
                            ariaLabel="指令站点首页"
                            testId="cmd-site"
                          />
                        </div>
                      </div>
                      <div className="mt-2">
                        <Button onClick={addCommand} size="sm" variant="primary" testId="cmd-add">
                          添加快捷指令
                        </Button>
                      </div>
                    </section>
                  </div>
                ) : null}

                {/* ------------------------- 外观 ------------------------- */}
                {tab === "appearance" ? (
                  <div className="settings-body">
                    <section className="settings-section">
                      <h3 className="settings-h3">主题</h3>
                      <Segmented
                        options={[
                          { value: "light", label: "亮色" },
                          { value: "dark", label: "暗色" },
                          { value: "system", label: "跟随系统" },
                        ]}
                        value={config.theme.mode}
                        onChange={(v) => update("theme", { mode: v })}
                        label="主题模式"
                        testId="theme-mode"
                      />
                    </section>

                    <section className="settings-section">
                      <h3 className="settings-h3">强调色</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {ACCENTS.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => update("theme", { accent: a.value })}
                            aria-label={`强调色 ${a.name}`}
                            aria-pressed={config.theme.accent === a.value}
                            data-testid={`accent-${a.id}`}
                            className={`size-7 rounded-full border-2 transition-transform hover:scale-110 ${
                              config.theme.accent === a.value ? "border-white" : "border-transparent"
                            }`}
                            style={{ background: a.value }}
                          />
                        ))}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="color"
                          value={customAccent}
                          onChange={(e) => {
                            setCustomAccent(e.target.value);
                            if (isAccentAcceptable(e.target.value, config.theme.mode === "light" ? "light" : "dark")) {
                              update("theme", { accent: e.target.value });
                            }
                          }}
                          aria-label="自定义强调色"
                          data-testid="accent-picker"
                          className="size-8 cursor-pointer rounded border border-[var(--glass-border)] bg-transparent"
                        />
                        <span className="font-mono text-[11px] text-[var(--fg-subtle)]">{customAccent}</span>
                        <span
                          className={`text-[11px] ${acceptable ? "text-emerald-400" : "text-amber-400"}`}
                          data-testid="accent-contrast"
                        >
                          对比度 {contrast.toFixed(1)}:1 {acceptable ? "（通过 AA）" : "（低于 3:1，未应用）"}
                        </span>
                      </div>
                    </section>

                    <section className="settings-section">
                      <h3 className="settings-h3">动效</h3>
                      <Switch
                        checked={config.a11y.reducedMotion === true}
                        onChange={(v) => set("a11y", { reducedMotion: v ? true : null })}
                        label="减少动效"
                        description="开启后禁用全部动画；关闭则跟随系统 prefers-reduced-motion。"
                        testId="reduce-motion"
                      />
                    </section>
                  </div>
                ) : null}

                {/* ------------------------- 时间与一言 ------------------------- */}
                {tab === "modules" ? (
                  <div className="settings-body">
                    <section className="settings-section">
                      <h3 className="settings-h3">时间</h3>
                      <Switch
                        checked={config.clock.show}
                        onChange={(v) => update("clock", { show: v })}
                        label="显示时钟"
                        testId="clock-show"
                      />
                      <Switch
                        checked={config.clock.showSeconds}
                        onChange={(v) => update("clock", { showSeconds: v })}
                        label="显示秒"
                        testId="clock-seconds"
                      />
                      <Switch
                        checked={config.greeting.show}
                        onChange={(v) => update("greeting", { show: v })}
                        label="显示问候语"
                        testId="greeting-show"
                      />
                      <Field label="自定义问候语" hint="留空则按时段自动切换（早安 / 上午好 / 午安 / 下午好 / 晚上好 / 夜深了）">
                        <TextInput
                          value={config.greeting.custom}
                          onChange={(v) => update("greeting", { custom: v })}
                          placeholder="例如：今天也要加油"
                          maxLength={20}
                          ariaLabel="自定义问候语"
                          testId="greeting-custom"
                        />
                      </Field>
                    </section>

                    <section className="settings-section">
                      <h3 className="settings-h3">待办便签（可选）</h3>
                      <Switch
                        checked={config.note.enabled}
                        onChange={(v) => update("note", { enabled: v })}
                        label="显示待办便签"
                        description="默认开启。纯文本，直接保存在本机配置里，随导出/导入与一键清除一起处理，不会上传。"
                        testId="note-enable"
                      />
                    </section>

                    <section className="settings-section">
                      <h3 className="settings-h3">天气</h3>
                      <Switch
                        checked={config.weather.enabled}
                        onChange={(v) => update("weather", { enabled: v })}
                        label="显示天气"
                        description="默认开启。首次打开会尝试一次浏览器定位；不授权就选城市。坐标只发给 api.open-meteo.com（已在内置白名单），不带任何本地数据。"
                        testId="weather-enable"
                      />
                      {config.weather.enabled ? (
                        <div className="space-y-2 pt-1">
                          <div className="py-1">
                            <span className="mb-1.5 block text-[13px] font-medium">温度单位</span>
                            <Segmented
                              options={[
                                { value: "c", label: "摄氏 °C" },
                                { value: "f", label: "华氏 °F" },
                              ]}
                              value={config.weather.unit}
                              onChange={(v) => update("weather", { unit: v })}
                              label="温度单位"
                              testId="weather-unit"
                            />
                          </div>
                          {/*
                            省份 + 城市两个原生下拉，不再让用户手填经纬度：
                            经纬度是机器坐标，人不知道自己家的两位小数是多少。
                            省份只是「切城市列表」的草稿，选城市才写回坐标 ——
                            否则一选省份就被强行改成该省第一个城市。
                          */}
                          <div className="py-1">
                            <span className="mb-1.5 block text-[13px] font-medium">城市</span>
                            <div className="grid grid-cols-2 gap-1.5">
                              <div className="weather-select-wrap">
                                <select
                                  aria-label="省份"
                                  data-testid="weather-province"
                                  value={provinceDraft || config.weather.province}
                                  onChange={(e) => setProvinceDraft(e.target.value)}
                                  className="weather-select"
                                >
                                  <option value="">选择省份</option>
                                  {PROVINCES.map((p) => (
                                    <option key={p.name} value={p.name}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown />
                              </div>
                              <div className="weather-select-wrap">
                                <select
                                  aria-label="城市"
                                  data-testid="weather-city-select"
                                  value={
                                    citiesOf(provinceDraft || config.weather.province).some(
                                      (c) => c.name === config.weather.city,
                                    )
                                      ? config.weather.city
                                      : ""
                                  }
                                  onChange={(e) => {
                                    const next = e.target.value;
                                    if (!next) return;
                                    const hit = findCity(provinceDraft || config.weather.province, next);
                                    update("weather", {
                                      province: provinceDraft || config.weather.province,
                                      city: next,
                                      lat: hit ? hit.lat : null,
                                      lon: hit ? hit.lon : null,
                                      source: hit ? "manual" : "none",
                                    });
                                  }}
                                  disabled={citiesOf(provinceDraft || config.weather.province).length === 0}
                                  className="weather-select"
                                >
                                  <option value="">
                                    {citiesOf(provinceDraft || config.weather.province).length === 0
                                      ? "先选省份"
                                      : "选择城市"}
                                  </option>
                                  {citiesOf(provinceDraft || config.weather.province).map((c) => (
                                    <option key={c.name} value={c.name}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown />
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <Button
                              size="sm"
                              onClick={async () => {
                                if (typeof navigator === "undefined" || !navigator.geolocation) {
                                  push("当前浏览器不支持定位，请手动选择城市", "error");
                                  return;
                                }
                                push("正在获取定位…", "info");
                                navigator.geolocation.getCurrentPosition(
                                  (pos) => {
                                    const lat = Number(pos.coords.latitude.toFixed(3));
                                    const lon = Number(pos.coords.longitude.toFixed(3));
                                    /*
                                      反查最近的城市再写回：只写经纬度的话，
                                      下拉框会一直是空值（用户看到的「没选中任何城市」）。
                                    */
                                    const near = nearestCity(lat, lon);
                                    update("weather", {
                                      lat,
                                      lon,
                                      province: near ? near.province : "",
                                      city: near ? near.city.name : "",
                                      source: "geo",
                                    });
                                    setProvinceDraft(near ? near.province : "");
                                    push(
                                      near ? `已定位到 ${near.city.name}` : "已使用当前位置",
                                      "success",
                                    );
                                  },
                                  () => push("定位失败或未授权，请手动选择城市", "error"),
                                  { timeout: 8000, maximumAge: 600000 },
                                );
                              }}
                              testId="weather-locate"
                            >
                              使用我的定位
                            </Button>
                            {/* 状态用一枚小药丸表示，而不是再写一行「当前：省 · 市」——
                                城市名已经在左侧下拉里明摆着，重复一遍只是噪音。 */}
                            <span
                              className="weather-status"
                              data-source={config.weather.source}
                              data-testid="weather-status"
                            >
                              <span className="weather-status-dot" aria-hidden="true" />
                              {config.weather.source === "geo"
                                ? "已定位"
                                : config.weather.source === "manual"
                                  ? "手动选择"
                                  : "未选择"}
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </section>

                    <section className="settings-section">
                      <h3 className="settings-h3">每日一言</h3>
                      <Switch
                        checked={config.quote.show}
                        onChange={(v) => update("quote", { show: v })}
                        label="显示每日一言"
                        testId="quote-show"
                      />
                      <div className="py-2">
                        <span className="mb-1.5 block text-[13px] font-medium">数据源</span>
                        <Segmented
                          options={[
                            { value: "local", label: "内置语录库" },
                            { value: "remote", label: "远程 API" },
                          ]}
                          value={config.quote.source}
                          onChange={(v) => update("quote", { source: v })}
                          label="一言数据源"
                          testId="quote-source"
                        />
                        <p className="mt-1 text-[11px] leading-relaxed text-[var(--fg-subtle)]">
                          默认走远程 API（v1.hitokoto.cn），3 秒超时自动回退内置语录库；切成内置库则完全不发网络请求。
                        </p>
                      </div>
                    </section>
                  </div>
                ) : null}

                {/* ------------------------- 背景 ------------------------- */}
                {tab === "background" ? (
                  <div className="settings-body">
                    <section className="settings-section">
                      <h3 className="settings-h3">每日壁纸</h3>
                      <p className="mb-2 text-[11px] leading-relaxed text-[var(--fg-subtle)]">
                        Edge / Bing 每日一图，随日期自动更新。元数据取自 bing.biturl.top（已在白名单内），
                        图片由 bing.com 直链加载；请求失败时自动回落到纯渐变，页面不会白屏。
                      </p>
                      <Switch
                        checked={config.background.source === "edge"}
                        onChange={(v) => update("background", { source: v ? "edge" : "none" })}
                        label="使用每日壁纸"
                        description="关闭后只剩纯渐变底色，第三方请求数降为 0。"
                        testId="background-edge"
                      />
                      <Field label="往前回溯" hint="0 = 今天；想看前几天的图可以往后调">
                        <Segmented
                          options={[
                            { value: "0", label: "今天" },
                            { value: "1", label: "-1 天" },
                            { value: "3", label: "-3 天" },
                            { value: "7", label: "-7 天" },
                          ]}
                          value={String(config.background.offset)}
                          onChange={(v) => update("background", { offset: Number(v) })}
                          label="壁纸回溯天数"
                          testId="background-offset"
                        />
                      </Field>
                    </section>

                    <section className="settings-section">
                      <h3 className="settings-h3">自定义图片（可选）</h3>
                      <p className="mb-2 text-[11px] leading-relaxed text-[var(--fg-subtle)]">
                        优先级高于每日壁纸。留空或点「移除」则回到每日壁纸。
                      </p>
                      <div className="flex gap-1.5">
                        <div className="min-w-0 flex-1">
                          <TextInput
                            value={wallpaperUrl}
                            onChange={setWallpaperUrl}
                            placeholder="https://example.com/bg.jpg"
                            ariaLabel="远程背景图片地址"
                            testId="wallpaper-url"
                          />
                        </div>
                        <Button onClick={applyWallpaperUrl} size="sm" testId="wallpaper-url-apply">
                          应用
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Button onClick={() => wallpaperFileRef.current?.click()} size="sm" testId="wallpaper-upload">
                          选择本地图片
                        </Button>
                        <input
                          ref={wallpaperFileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          data-testid="wallpaper-file"
                          onChange={(e) => onWallpaperFile(e.target.files?.[0])}
                        />
                        <Button
                          onClick={() => {
                            set("wallpaper", { source: "none", value: "" });
                            setWallpaperUrl("");
                            push("已移除自定义图片", "success");
                          }}
                          size="sm"
                          variant="ghost"
                          testId="wallpaper-clear"
                        >
                          移除图片
                        </Button>
                        <span className="text-[11px] text-[var(--fg-subtle)]">小于 8MB，仅存本机</span>
                      </div>
                    </section>

                    <section className="settings-section">
                      <h3 className="settings-h3">前景可读性</h3>
                      <Range
                        label="暗化程度"
                        min={0}
                        max={70}
                        value={config.background.dim}
                        onChange={(v) => update("background", { dim: v })}
                        suffix="%"
                        testId="wallpaper-dim"
                      />
                      <Range
                        label="基础模糊"
                        min={0}
                        max={20}
                        value={config.background.blur}
                        onChange={(v) => update("background", { blur: v })}
                        suffix="px"
                        testId="wallpaper-blur"
                      />
                      <Switch
                        checked={config.background.kenBurns}
                        onChange={(v) => update("background", { kenBurns: v })}
                        label="Ken Burns 缓慢缩放"
                        testId="wallpaper-kenburns"
                      />
                    </section>
                  </div>
                ) : null}

                {/* ------------------------- 隐私与数据 ------------------------- */}
                {tab === "privacy" ? (
                  <div className="settings-body">
                    <section className="settings-section">
                      <h3 className="settings-h3">请求白名单</h3>
                      <p className="mb-2 text-[11px] leading-relaxed text-[var(--fg-subtle)]">
                        所有远程请求都必须命中白名单，否则被 fetch 封装直接拒绝。默认仅含可选功能的域名。
                      </p>
                      <ul className="mb-2 space-y-1">
                        {config.privacy.whitelist.map((host) => (
                          <li
                            key={host}
                            className="flex items-center gap-2 rounded-lg border border-[var(--glass-border)] px-2 py-1"
                          >
                            <span className="flex-1 truncate font-mono text-[11.5px]">{host}</span>
                            <button
                              type="button"
                              onClick={() => {
                                update("privacy", { whitelist: config.privacy.whitelist.filter((h) => h !== host) });
                                push("已移除", "success");
                              }}
                              aria-label={`移除白名单 ${host}`}
                              data-testid={`whitelist-remove-${host}`}
                              className="grid size-5 place-items-center rounded text-[var(--fg-subtle)] hover:bg-red-500/15 hover:text-red-400"
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                      <div className="flex gap-1.5">
                        <div className="min-w-0 flex-1">
                          <TextInput
                            value={whitelistDraft}
                            onChange={setWhitelistDraft}
                            placeholder="example.com"
                            ariaLabel="新增白名单域名"
                            testId="whitelist-input"
                          />
                        </div>
                        <Button onClick={addWhitelist} size="sm" testId="whitelist-add">
                          添加
                        </Button>
                      </div>
                    </section>

                    <section className="settings-section">
                      <h3 className="settings-h3">站点图标</h3>
                      <Switch
                        checked={config.icons.autoFetch}
                        onChange={(v) => update("icons", { autoFetch: v })}
                        label="自动抓取站点图标（favicon）"
                        /* 这条曾经写「默认关闭，仅白名单域名」，与「Dock 显示站点图标」直接冲突：
                           favicon 的域名恰恰就是每个站点自己，永远不可能预先列进白名单。
                           现在默认开启，白名单只管 safeFetch 的接口请求（一言 / 天气 / 壁纸元数据）。 */
                        description="默认开启。Dock 与引擎徽标用它显示真实图标；失败或缺图时自动降级为首字母。取图只读 /favicon.ico，不带 Cookie、不带 referrer，内网地址一律跳过。"
                        testId="icons-autofetch"
                      />
                      <p className="mt-1 text-[11px] leading-relaxed text-[var(--fg-subtle)]">
                        白名单只约束「一言 / 天气 / 壁纸元数据」这类接口请求；站点图标是浏览器直接加载的静态图片，
                        不经过白名单——两者不会互相限制。
                      </p>
                    </section>

                    <section className="settings-section">
                      <h3 className="settings-h3">数据管理</h3>
                      <div className="flex flex-wrap gap-2 py-1">
                        <Button onClick={exportConfig} size="sm" testId="export-config">
                          导出配置
                        </Button>
                        <Button onClick={() => importRef.current?.click()} size="sm" testId="import-config">
                          导入配置
                        </Button>
                        <input
                          ref={importRef}
                          type="file"
                          accept="application/json,.json"
                          className="hidden"
                          data-testid="import-file"
                          onChange={(e) => onImportFile(e.target.files?.[0])}
                        />
                        <Button onClick={() => setConfirmClear(true)} size="sm" variant="danger" testId="clear-data">
                          一键清除全部数据
                        </Button>
                      </div>
                    </section>

                    <section className="settings-section">
                      <h3 className="settings-h3">隐私说明</h3>
                      <div className="space-y-1 text-[11.5px] leading-relaxed text-[var(--fg-muted)]">
                        <p>· 本地存储：配置（localStorage）与图片缓存（IndexedDB），仅存本机，不上传。</p>
                        <p>· 远程请求：一言与天气默认开启、搜索建议默认关闭；接口请求受白名单约束，不带 Cookie、不带 referrer。站点图标由浏览器直接加载，可在「站点图标」里关闭。</p>
                        <p>· 统计：本版本未接入任何第三方统计，默认第三方请求数为 0。</p>
                        <p>· 你可以随时导出配置或一键清除全部本地数据。</p>
                      </div>
                    </section>
                  </div>
                ) : null}

                {/* ------------------------- 快捷跳转 ------------------------- */}
                {tab === "shortcuts" ? (
                  <div className="settings-body">
                    <section className="settings-section">
                      <h3 className="settings-h3">快捷跳转</h3>
                      <p className="mb-2 text-[11px] leading-relaxed text-[var(--fg-subtle)]">
                        首页底部那排图标的全部增删改都收在这里 —— 指针划过图标时不会再冒出编辑按钮，
                        首页只负责「点一下就走」。
                      </p>
                    </section>
                    <section className="settings-section">
                      <ShortcutManager />
                    </section>
                  </div>
                ) : null}

                {/* ------------------------- 关于 ------------------------- */}
                {tab === "about" ? (
                  <div className="settings-body">
                    <section className="settings-section">
                      <div className="flex items-center gap-3">
                        <span
                          className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-md)] text-[15px] font-semibold text-white"
                          style={{ background: "var(--accent)" }}
                          aria-hidden="true"
                        >
                          起
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-[14px] font-semibold">{SITE.title}</h3>
                          <p className="text-[11.5px] leading-relaxed text-[var(--fg-subtle)]">{SITE.description}</p>
                        </div>
                      </div>
                    </section>

                    <section className="settings-section">
                      <h3 className="settings-h3">技术栈</h3>
                      <p className="text-[11.5px] leading-relaxed text-[var(--fg-muted)]">
                        Next.js 15 App Router · React 19 · TypeScript strict · Tailwind CSS v4 · Motion ·
                        Magic UI 风格组件（全部自绘，无第三方运行时依赖）。
                      </p>
                    </section>

                    <section className="settings-section">
                      <h3 className="settings-h3">数据与隐私</h3>
                      <p className="text-[11.5px] leading-relaxed text-[var(--fg-muted)]">
                        配置存 localStorage、图片缓存存 IndexedDB，全部只在本机。默认第三方请求数为 0；
                        任何远程请求都必须命中白名单。可在「隐私与数据」里导出、导入或一键清除。
                      </p>
                    </section>

                    <section className="settings-section">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => {
                            void navigator.clipboard
                              ?.writeText(window.location.href)
                              .then(() => push("站点地址已复制", "success"))
                              .catch(() => push("复制失败，请手动复制地址栏", "error"));
                          }}
                          size="sm"
                          testId="about-copy-url"
                        >
                          复制站点地址
                        </Button>
                      </div>
                      <p className="mt-2 text-[11px] text-[var(--fg-subtle)]">
                        版本 1.0.0 · 配置结构 v{config.version}
                      </p>
                    </section>
                  </div>
                ) : null}
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

/** 供外部（命令面板）读取的默认配置导出，避免重复构造 */
export const DEFAULT_CONFIG_SNAPSHOT = createDefaultConfig();
export type { AppConfig };

/* ---------------------------- 页签图标（内联 SVG，零请求） ---------------------------- */

function iconProps() {
  return {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

function IconSearch() {
  return (
    <svg {...iconProps()}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function IconPalette() {
  return (
    <svg {...iconProps()}>
      <path d="M12 21a9 9 0 1 1 9-9c0 2-1.6 3-3 3h-1.5a2 2 0 0 0-1.4 3.4A2 2 0 0 1 12 21Z" />
      <circle cx="8" cy="10" r="1.2" />
      <circle cx="12" cy="7.5" r="1.2" />
      <circle cx="15.8" cy="10" r="1.2" />
    </svg>
  );
}

/** 下拉框右侧的自绘箭头（原生 select 的箭头在深色下几乎看不见） */
function ChevronDown() {
  return (
    <svg
      className="weather-select-chevron"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 引擎行内的小号开关：与设置里的大号 Switch 同一套语言，只是缩小一半 */
function MiniSwitch({
  checked,
  onChange,
  label,
  testId,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      data-testid={testId}
      data-state={checked ? "on" : "off"}
      className={`relative h-[18px] w-8 shrink-0 rounded-full transition-colors duration-200 ease-out ${
        checked ? "" : "bg-[color-mix(in_srgb,var(--fg)_16%,transparent)]"
      }`}
      style={
        checked
          ? { background: "var(--accent)", boxShadow: "0 0 0 2.5px color-mix(in srgb, var(--accent) 16%, transparent)" }
          : undefined
      }
    >
      <span
        className={`absolute top-[2px] left-[2px] size-3.5 rounded-full bg-white transition-transform duration-200 ease-out ${
          checked ? "translate-x-[14px]" : "translate-x-0"
        }`}
        style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
      />
    </button>
  );
}

function IconGrid() {
  return (
    <svg {...iconProps()}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg {...iconProps()}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  );
}

function IconImage() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4 18 5-5 4 4 3-3 4 4" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg {...iconProps()}>
      <path d="M12 3l7 3v5.5c0 4.2-2.9 7.7-7 9.5-4.1-1.8-7-5.3-7-9.5V6l7-3Z" />
      <path d="m9.5 12 1.8 1.8L15 10" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h0" />
    </svg>
  );
}
