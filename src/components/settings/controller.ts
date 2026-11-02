"use client";

/**
 * 设置面板的「控制器」。
 *
 * 拆分动因：原来 1192 行的单文件把 7 个页签的 UI、6 组表单草稿、导入导出、
 * 白名单、定位全部堆在一个组件里。真正的耦合点不是 UI，而是**草稿状态** ——
 * 它们必须活得比页签长（切走再切回来，刚填了一半的指令不该被清空）。
 *
 * 所以草稿与副作用统一放这里，页签组件只做渲染。这样：
 *  · 切页签不会丢草稿（与拆分前行为一致）；
 *  · 每个页签文件只关心自己的 DOM，改文案不会碰到别人的逻辑；
 *  · 新增一个页签 = 一个文件 + 一行 TABS。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { findCity, nearestCity } from "@/config/cities";
import { createDefaultConfig } from "@/config/defaults";
import { ENGINES, LIMITS } from "@/config/site";
import { accentContrast, isAccentAcceptable } from "@/lib/color";
import { useConfig } from "@/lib/config-store";
import { deleteStoredImage, IMAGE_REF_PREFIX, putStoredImage } from "@/lib/image-store";
import { mergeConfig } from "@/lib/storage";
import { useToast } from "@/components/ui/primitives";

/** 导入文件上限：超过 1MB 的 JSON 只可能是被塞了二进制 */
const IMPORT_MAX_BYTES = 1024 * 1024;
/** 快捷指令条数上限：与导入校验共用同一个常量，避免 UI 与 schema 各说各话 */
const MAX_QUICK_COMMANDS = LIMITS.maxQuickCommands;

export function useSettingsController() {
  const { config, set, update, replace, reset } = useConfig();
  const { push } = useToast();

  /* ------------------------------ 草稿 ------------------------------ */

  /** 选省份只切城市列表，不立刻写库（否则城市会被强行改成第一个） */
  const [provinceDraft, setProvinceDraft] = useState("");
  const [cmdDraft, setCmdDraft] = useState({ key: "", label: "", url: "", siteUrl: "" });
  const [whitelistDraft, setWhitelistDraft] = useState("");
  const [customAccent, setCustomAccent] = useState(config.theme.accent);
  const [wallpaperUrl, setWallpaperUrl] = useState(
    config.wallpaper.source === "url" ? config.wallpaper.value : "",
  );

  const wallpaperFileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => setCustomAccent(config.theme.accent), [config.theme.accent]);

  /* ------------------------------ 引擎 ------------------------------ */

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

  const enabledEngines = useMemo(
    () => config.engineOrder.map((id) => ENGINES.find((e) => e.id === id)).filter(Boolean),
    [config.engineOrder],
  );

  /* ------------------------------ 快捷指令 ------------------------------ */

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
    if (config.quickCommands.length >= MAX_QUICK_COMMANDS) {
      push(`快捷指令最多 ${MAX_QUICK_COMMANDS} 条`, "error");
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

  const resolvedMode = config.theme.mode === "light" ? "light" : "dark";
  const contrast = accentContrast(customAccent, resolvedMode);
  const acceptable = isAccentAcceptable(customAccent, resolvedMode);

  /** 对比度不达标的颜色只更新预览，不应用（避免深底上出现读不清的强调色） */
  const pickAccent = (value: string) => {
    setCustomAccent(value);
    if (isAccentAcceptable(value, resolvedMode)) update("theme", { accent: value });
  };

  /* ------------------------------ 背景 ------------------------------ */

  /** 只回收「被换掉的本地上传图」：引用是内容寻址的，不会误删别的字段还在用的图 */
  const dropStoredImage = (value: string) => {
    if (value.startsWith(IMAGE_REF_PREFIX)) void deleteStoredImage(value);
  };

  const applyWallpaperUrl = () => {
    const value = wallpaperUrl.trim();
    if (!value) {
      push("请填写图片地址", "error");
      return;
    }
    /*
     * 只收 http(s)。早先还放行 data:image/ —— 那是给「本地图存配置」时代留的口子，
     * 现在图片统一进 IndexedDB，再允许粘贴 dataURL 等于把配额炸弹重新交回用户手里。
     */
    if (!/^https?:\/\//i.test(value)) {
      push("图片需为 http(s) 地址", "error");
      return;
    }
    const previous = config.wallpaper.value;
    set("wallpaper", { source: "url", value });
    dropStoredImage(previous);
    push("背景图片已应用", "success");
  };

  const onWallpaperFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      push("请选择图片文件", "error");
      return;
    }
    /*
     * 图片本体进 IndexedDB，配置里只留 `idb:` 引用，所以这里可以用真正的取图上限 8MB。
     * 早先直接存 dataURL 时，3MB 以上就会把 localStorage 配额撑爆 ——
     * 界面换了图、刷新又回去，用户完全看不出发生了什么。
     */
    if (file.size > LIMITS.wallpaperMaxBytes) {
      push(`图片需小于 ${Math.round(LIMITS.wallpaperMaxBytes / 1024 / 1024)}MB`, "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) {
        push("图片读取失败，请换一张", "error");
        return;
      }
      void (async () => {
        try {
          const ref = await putStoredImage("wallpaper", dataUrl);
          const previous = config.wallpaper.value;
          set("wallpaper", { source: "local", value: ref });
          dropStoredImage(previous);
          push("本地图片已应用", "success");
        } catch {
          // 写不进去就明说，绝不能让「已应用」这句话落在一个没存住的配置上
          push("图片保存失败：本地存储不可用或空间不足", "error");
        }
      })();
    };
    reader.readAsDataURL(file);
  };

  const clearWallpaper = () => {
    const previous = config.wallpaper.value;
    set("wallpaper", { source: "none", value: "" });
    setWallpaperUrl("");
    dropStoredImage(previous);
    push("已移除自定义图片", "success");
  };

  /* ------------------------------ 白名单 ------------------------------ */

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
    if (file.size > IMPORT_MAX_BYTES) {
      push("配置文件过大（>1MB）", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as unknown;
        if (!parsed || typeof parsed !== "object") throw new Error("bad");
        // 走 schema 校验：坏字段在这里被丢掉，不会流到渲染层
        replace(mergeConfig(createDefaultConfig(), parsed));
        push("配置已导入", "success");
      } catch {
        push("配置文件解析失败，请检查 JSON 格式", "error");
      }
    };
    reader.readAsText(file);
  };

  /* ------------------------------ 天气定位 ------------------------------ */

  const locateWeather = async () => {
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
        push(near ? `已定位到 ${near.city.name}` : "已使用当前位置", "success");
      },
      () => push("定位失败或未授权，请手动选择城市", "error"),
      { timeout: 8000, maximumAge: 600000 },
    );
  };

  /* ------------------------------ 天气城市 ------------------------------ */

  const draftProvince = provinceDraft || config.weather.province;

  const selectCity = (next: string) => {
    if (!next) return;
    const hit = findCity(draftProvince, next);
    update("weather", {
      province: draftProvince,
      city: next,
      lat: hit ? hit.lat : null,
      lon: hit ? hit.lon : null,
      source: hit ? "manual" : "none",
    });
  };

  return {
    // 配置
    config,
    set,
    update,
    replace,
    reset,
    push,
    // 引擎
    moveEngine,
    toggleEngine,
    enabledEngines,
    // 快捷指令
    cmdDraft,
    setCmdDraft,
    addCommand,
    // 强调色
    customAccent,
    pickAccent,
    contrast,
    acceptable,
    // 背景
    wallpaperUrl,
    setWallpaperUrl,
    wallpaperFileRef,
    applyWallpaperUrl,
    onWallpaperFile,
    clearWallpaper,
    // 白名单
    whitelistDraft,
    setWhitelistDraft,
    addWhitelist,
    // 导入导出
    importRef,
    exportConfig,
    onImportFile,
    // 天气
    provinceDraft,
    setProvinceDraft,
    draftProvince,
    selectCity,
    locateWeather,
  };
}

/** 页签组件统一拿这一份控制器 */
export type SettingsController = ReturnType<typeof useSettingsController>;
