"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LIMITS, type Shortcut } from "@/config/site";
import { useConfig, useReducedMotionPref } from "@/lib/config-store";
import {
  Button,
  ConfirmDialog,
  Field,
  Modal,
  Segmented,
  TextInput,
  useToast,
} from "@/components/ui/primitives";
import { ShortcutIcon } from "@/components/shortcut-icon";
import { faviconCapability } from "@/lib/favicon";
import { hostOf } from "@/lib/services";

/**
 * 图标来源（优先级从高到低由语义本身表达）：
 *   image / emoji = 用户自定义，永远优先
 *   letter        = 自动：先抓站点 favicon，抓不到才显示首字母
 * 名称没有叫「自动」是因为数据结构里 iconKind 的取值要向后兼容，
 * 但界面上明确写「自动」，否则用户会以为不填就是首字母。
 */
const ICON_KINDS = [
  { value: "letter" as const, label: "自动 / 首字母" },
  { value: "emoji" as const, label: "Emoji" },
  { value: "image" as const, label: "上传图片" },
];

const PALETTE = [
  "#2F6FED",
  "#7C5CFF",
  "#0EA5A5",
  "#12A150",
  "#D97706",
  "#E11D63",
  "#EA580C",
  "#64748B",
  "#24292F",
];

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * 快捷跳转管理（设置 → 快捷跳转）。
 *
 * 首页的 Dock 只负责跳转，增删改与排序全部收在这里，
 * 以免指针划到图标上就弹出编辑工具条。
 */
export function ShortcutManager() {
  const { config, set } = useConfig();
  const reduce = useReducedMotionPref();
  const { push } = useToast();

  const [editor, setEditor] = useState<{ open: boolean; item: Shortcut | null }>({
    open: false,
    item: null,
  });
  const [confirm, setConfirm] = useState<{ open: boolean; itemId: string }>({
    open: false,
    itemId: "",
  });

  const items = useMemo(() => config.groups.flatMap((g) => g.items), [config.groups]);
  const groupId = config.groups[0]?.id ?? "grp-main";

  /** 写回配置：保留分组结构（向后兼容），界面上一律展平 */
  const commitItems = (next: Shortcut[]) => {
    const first = config.groups[0];
    if (!first) {
      set("groups", [{ id: groupId, name: "快捷跳转", items: next }]);
      return;
    }
    set("groups", [{ ...first, items: next }, ...config.groups.slice(1)]);
  };

  const saveItem = (item: Shortcut) => {
    const exists = items.some((i) => i.id === item.id);
    if (!exists && items.length >= LIMITS.maxShortcuts) {
      push(`最多 ${LIMITS.maxShortcuts} 个快捷项`, "error");
      return;
    }
    commitItems(exists ? items.map((i) => (i.id === item.id ? item : i)) : [...items, item]);
    push(exists ? "已保存快捷项" : "已添加快捷项", "success");
    setEditor({ open: false, item: null });
  };

  const deleteItem = (itemId: string) => {
    commitItems(items.filter((i) => i.id !== itemId));
    push("已删除快捷项", "success");
    setConfirm({ open: false, itemId: "" });
  };

  const move = (itemId: string, delta: number) => {
    const index = items.findIndex((i) => i.id === itemId);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= items.length) {
      push("已到边界", "info");
      return;
    }
    const list = [...items];
    [list[index], list[next]] = [list[next], list[index]];
    commitItems(list);
    push("已调整顺序", "success");
  };

  return (
    <div data-testid="shortcut-manager">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] leading-relaxed text-[var(--fg-subtle)]">
          首页底部图标条的顺序即此列表顺序。共 {items.length} / {LIMITS.maxShortcuts} 个。
        </p>
        <Button
          onClick={() => setEditor({ open: true, item: null })}
          size="sm"
          variant="primary"
          testId="add-shortcut"
        >
          添加
        </Button>
      </div>

      {items.length === 0 ? (
        <p
          className="rounded-[var(--radius-sm)] border border-dashed border-[var(--glass-border)] px-3 py-6 text-center text-[11.5px] text-[var(--fg-subtle)]"
          data-testid="shortcut-empty"
        >
          还没有快捷项，点右上角「添加」新建第一个
        </p>
      ) : (
        <ul className="space-y-1" data-testid="shortcut-list">
          {items.map((item, index) => (
            <motion.li
              key={item.id}
              layout={!reduce}
              data-shortcut-id={item.id}
              className="flex items-center gap-2 rounded-[var(--radius-sm)] px-1.5 py-1 transition-colors hover:bg-[var(--hover-bg)]"
            >
              <ShortcutIcon item={item} size={26} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] text-[var(--fg)]">{item.title}</span>
                <span className="block truncate text-[10.5px] text-[var(--fg-subtle)]">{item.url}</span>
              </span>
              <span className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => move(item.id, -1)}
                  disabled={index === 0}
                  aria-label={`将 ${item.title} 前移`}
                  title="前移"
                  className="grid size-6 place-items-center rounded-[var(--radius-xs)] text-[var(--fg-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--fg)] disabled:opacity-30"
                >
                  <ArrowIcon dir="up" />
                </button>
                <button
                  type="button"
                  onClick={() => move(item.id, 1)}
                  disabled={index === items.length - 1}
                  aria-label={`将 ${item.title} 后移`}
                  title="后移"
                  className="grid size-6 place-items-center rounded-[var(--radius-xs)] text-[var(--fg-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--fg)] disabled:opacity-30"
                >
                  <ArrowIcon dir="down" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditor({ open: true, item })}
                  aria-label={`编辑 ${item.title}`}
                  title={`编辑 ${item.title}`}
                  data-testid={`shortcut-edit-${item.id}`}
                  className="grid size-6 place-items-center rounded-[var(--radius-xs)] text-[var(--fg-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--fg)]"
                >
                  <PencilIcon size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm({ open: true, itemId: item.id })}
                  aria-label={`删除 ${item.title}`}
                  title={`删除 ${item.title}`}
                  data-testid={`shortcut-delete-${item.id}`}
                  className="grid size-6 place-items-center rounded-[var(--radius-xs)] text-[var(--fg-muted)] hover:bg-red-500/15 hover:text-red-400"
                >
                  <TrashIcon size={11} />
                </button>
              </span>
            </motion.li>
          ))}
        </ul>
      )}

      <ShortcutEditor
        open={editor.open}
        item={editor.item}
        reduceMotion={reduce}
        onClose={() => setEditor({ open: false, item: null })}
        onSave={saveItem}
      />

      <ConfirmDialog
        open={confirm.open}
        title="删除快捷项"
        description="该快捷项将从列表中移除，此操作不可撤销。"
        confirmText="删除"
        danger
        reduceMotion={reduce}
        onCancel={() => setConfirm({ open: false, itemId: "" })}
        onConfirm={() => deleteItem(confirm.itemId)}
      />
    </div>
  );
}

/* ------------------------------ 快捷项编辑器 ------------------------------ */

function ShortcutEditor({
  open,
  item,
  reduceMotion,
  onClose,
  onSave,
}: {
  open: boolean;
  item: Shortcut | null;
  reduceMotion: boolean;
  onClose: () => void;
  onSave: (item: Shortcut) => void;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [iconKind, setIconKind] = useState<Shortcut["iconKind"]>("letter");
  const [iconValue, setIconValue] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError("");
    if (item) {
      setTitle(item.title);
      setUrl(item.url);
      setIconKind(item.iconKind);
      setIconValue(item.iconValue);
      setColor(item.color ?? PALETTE[0]);
    } else {
      setTitle("");
      setUrl("");
      setIconKind("letter");
      setIconValue("");
      setColor(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    }
  }, [open, item]);

  const capability = faviconCapability(url.trim());
  const hostLabel = hostOf(url.trim()) || "该站点";
  const iconAuto = iconKind === "letter";
  const preview: Shortcut = {
    id: item?.id ?? "preview",
    title: title || "预览",
    url: url || "https://example.com",
    iconKind,
    iconValue: iconValue || title || "?",
    color,
  };

  const submit = () => {
    const t = title.trim();
    const u = url.trim();
    if (!t) {
      setError("请填写名称");
      return;
    }
    if (t.length > LIMITS.shortcutTitleMax) {
      setError(`名称最多 ${LIMITS.shortcutTitleMax} 字`);
      return;
    }
    if (!u) {
      setError("请填写链接地址");
      return;
    }
    const normalized = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    try {
      const parsed = new URL(normalized);
      if (!parsed.hostname.includes(".")) throw new Error("bad");
    } catch {
      setError("链接格式不正确，请填写完整域名");
      return;
    }
    onSave({
      id: item?.id ?? uid("sc"),
      title: t,
      url: normalized,
      iconKind,
      iconValue: iconKind === "letter" ? (iconValue || t).charAt(0) : iconValue,
      color,
    });
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }
    if (file.size > 512 * 1024) {
      setError("图片需小于 512KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setIconValue(typeof reader.result === "string" ? reader.result : "");
      setIconKind("image");
      setError("");
    };
    reader.readAsDataURL(file);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? "编辑快捷项" : "添加快捷项"}
      description="名称与链接为必填。图标默认自动取站点图标，你也可以换成 Emoji 或上传图片（自定义优先）。"
      reduceMotion={reduceMotion}
      footer={
        <>
          <Button onClick={onClose} testId="shortcut-cancel">
            取消
          </Button>
          <Button onClick={submit} variant="primary" testId="shortcut-save">
            保存
          </Button>
        </>
      }
    >
      {/* 顶部预览：左边那颗就是 Dock 里将来的样子，右边写名称 —— 所见即所得 */}
      <div className="shortcut-editor-head">
        <ShortcutIcon item={preview} size={46} />
        <div className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-[var(--fg)]">{title || "未命名快捷项"}</span>
          <span className="shortcut-editor-url" title={url || ""}>
            {url || "填写链接后自动识别站点图标"}
          </span>
        </div>
        {iconAuto ? (
          <span className="shortcut-editor-tag" data-testid="shortcut-icon-tag">
            自动图标
          </span>
        ) : (
          <span className="shortcut-editor-tag shortcut-editor-tag--custom" data-testid="shortcut-icon-tag">
            自定义
          </span>
        )}
      </div>

      <Field label="名称">
        <TextInput
          value={title}
          onChange={(v) => {
            setTitle(v);
            setError("");
          }}
          placeholder="例如 GitHub"
          maxLength={LIMITS.shortcutTitleMax}
          ariaLabel="快捷项名称"
          testId="shortcut-title"
        />
      </Field>

      <Field
        label="链接"
        hint={
          capability === "ok"
            ? `将自动取用 ${hostLabel} 的站点图标`
            : capability === "private"
              ? "内网地址通常没有图标，会自动显示首字母"
              : "支持 https:// 开头或直接填写域名"
        }
      >
        <TextInput
          value={url}
          onChange={(v) => {
            setUrl(v);
            setError("");
          }}
          placeholder="https://github.com"
          ariaLabel="快捷项链接"
          testId="shortcut-url"
        />
      </Field>

      <Field label="图标来源" hint="上传图片或填 Emoji 会覆盖自动抓取的站点图标">
        <Segmented
          options={ICON_KINDS}
          value={iconKind}
          onChange={(v) => setIconKind(v)}
          label="图标类型"
          testId="shortcut-icon-kind"
        />
      </Field>

      {iconKind === "emoji" ? (
        <Field label="Emoji" hint="粘贴一个 Emoji，例如 🚀">
          <TextInput
            value={iconValue}
            onChange={setIconValue}
            placeholder="🚀"
            maxLength={4}
            ariaLabel="Emoji 图标"
            testId="shortcut-emoji"
          />
        </Field>
      ) : null}

      {iconKind === "letter" ? (
        <Field label="首字母（可选）" hint="留空则取名称首字；站点图标取得到时优先用站点图标">
          <TextInput
            value={iconValue}
            onChange={setIconValue}
            placeholder="G"
            maxLength={2}
            ariaLabel="首字母图标"
            testId="shortcut-letter"
          />
        </Field>
      ) : null}

      {iconKind === "image" ? (
        <Field label="图片" hint="小于 512KB，仅存本地（dataURL）">
          <div className="flex items-center gap-2">
            <Button onClick={() => fileRef.current?.click()} size="sm" testId="shortcut-upload">
              选择图片
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              data-testid="shortcut-file"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <span className="truncate text-[11px] text-[var(--fg-subtle)]">
              {iconValue.startsWith("data:") ? "已选择本地图片" : "未选择"}
            </span>
          </div>
        </Field>
      ) : null}

      <Field label="图标底色" hint="首字母与 Emoji 会铺这块底色；站点图标自带白色托底">
        <div className="flex flex-wrap gap-1.5">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`选择颜色 ${c}`}
              aria-pressed={color === c}
              data-testid={`shortcut-color-${c.replace("#", "")}`}
              className={`size-6 rounded-full transition-transform hover:scale-110 ${
                color === c ? "ring-2 ring-white ring-offset-1 ring-offset-transparent" : ""
              }`}
              style={{ background: c }}
            />
          ))}
        </div>
      </Field>

      {error ? (
        <p
          className="mt-1 rounded-lg bg-red-500/10 px-2 py-1.5 text-[11.5px] text-red-400"
          role="alert"
          data-testid="shortcut-error"
        >
          {error}
        </p>
      ) : null}
    </Modal>
  );
}

/* ------------------------------ 图标 ------------------------------ */

function PencilIcon({ size = 9 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon({ size = 9 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon({ dir }: { dir: "up" | "down" }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
      <path d={dir === "up" ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
