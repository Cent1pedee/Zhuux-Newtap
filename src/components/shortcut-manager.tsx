"use client";

import { Input } from "@/components/ui/input";
import { Reorder, useDragControls } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LIMITS, type Shortcut } from "@/config/site";
import { useConfig, useReducedMotionPref } from "@/lib/config-store";
import {
  Button,
  ConfirmDialog,
  Field,
  FieldGroup,
  Modal,
  Segmented,
  TextInput,
  useToast,
} from "@/components/ui/primitives";
import { ShortcutIcon } from "@/components/shortcut-icon";
import { parseBookmarksHtml, toShortcuts } from "@/lib/bookmarks";
import { faviconCapability } from "@/lib/favicon";
import { putStoredImage } from "@/lib/image-store";
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

/**
 * 图标底色已统一成中性片，不再让用户逐站点挑色。
 * 仍在数据里写一个中性值，是为了兼容旧配置与 schema（color 字段保留）。
 */
const NEUTRAL_ICON_COLOR = "#64748B";

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
  const [bookmarkPreview, setBookmarkPreview] = useState<{
    open: boolean;
    name: string;
    total: number;
    skipped: number;
    items: Shortcut[];
  }>({ open: false, name: "", total: 0, skipped: 0, items: [] });
  const bookmarkRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => config.groups.flatMap((g) => g.items), [config.groups]);
  const groupId = config.groups[0]?.id ?? "grp-main";
  /*
   * 拖拽用本地 order 承接中间态：Motion 的 onReorder 在拖动过程中会多次触发，
   * 每次都写配置会不停重建数组、打断拖拽。落手时再统一 commit 一次。
   */
  const [order, setOrder] = useState<Shortcut[]>(items);
  const orderRef = useRef(order);
  orderRef.current = order;
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    setOrder(items);
  }, [items]);
  // 撤销发生在若干秒之后，闭包里的 items 已经过期；这里始终指向最新一次渲染的列表
  const itemsRef = useRef(items);
  itemsRef.current = items;

  /**
   * 写回配置：始终收敛成「一个分组」。
   *
   * 界面本来就是一条展平的 Dock，分组只是历史数据结构。旧实现把展平后的 items
   * 写回 groups[0]，同时又保留 groups.slice(1) 里的原有 items —— 于是一份多分组配置
   * 只要被编辑过一次，同一批图标就会在列表和 Dock 里各出现一遍（React 还会报
   * duplicate key）。这里直接把其余分组并入第一个分组，数据与界面重新对齐。
   */
  const commitItems = (next: Shortcut[]) => {
    const first = config.groups[0];
    set("groups", [{ id: first?.id ?? groupId, name: first?.name ?? "快捷跳转", items: next }]);
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
    const index = items.findIndex((i) => i.id === itemId);
    const removed = items[index];
    if (!removed) {
      setConfirm({ open: false, itemId: "" });
      return;
    }
    commitItems(items.filter((i) => i.id !== itemId));
    setConfirm({ open: false, itemId: "" });
    push("已删除快捷项", "success", {
      label: "撤销",
      onClick: () => {
        const current = itemsRef.current;
        if (current.some((i) => i.id === removed.id)) return;
        const next = [...current];
        next.splice(Math.min(index, next.length), 0, removed);
        commitItems(next);
      },
    });
  };

  const commitOrder = useCallback(
    (next: Shortcut[], announce = true) => {
      const before = itemsRef.current.map((i) => i.id).join("|");
      const after = next.map((i) => i.id).join("|");
      if (before === after) return;
      commitItems(next);
      if (announce) push("已调整顺序", "success");
    },
    // commitItems 依赖 config.groups，每次渲染都是新函数；用 itemsRef 判断是否真的有变化
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.groups],
  );

  /** 键盘兜底：拖拽把手上的 ↑ / ↓ 一次移动一格 */
  const moveBy = useCallback(
    (index: number, delta: number) => {
      const next = index + delta;
      const current = orderRef.current;
      if (next < 0 || next >= current.length) {
        push("已到边界", "info");
        return;
      }
      const list = [...current];
      [list[index], list[next]] = [list[next], list[index]];
      setOrder(list);
      commitOrder(list);
    },
    [commitOrder, push],
  );

  const onBookmarkFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      push("书签文件需小于 5MB", "error");
      return;
    }
    try {
      const html = await file.text();
      const parsed = parseBookmarksHtml(html);
      if (parsed.items.length === 0) {
        push("没有找到可导入的书签（仅支持 http/https）", "error");
        return;
      }
      const { items: next, skipped } = toShortcuts(parsed.items, items);
      if (next.length === 0) {
        push(`没有可新增的书签，跳过 ${skipped} 条（重复或超出上限）`, "info");
        return;
      }
      setBookmarkPreview({ open: true, name: file.name, total: parsed.items.length, skipped, items: next });
    } catch {
      push("书签文件读取失败", "error");
    } finally {
      if (bookmarkRef.current) bookmarkRef.current.value = "";
    }
  };

  const confirmBookmarkImport = () => {
    commitItems([...items, ...bookmarkPreview.items]);
    push(`已导入 ${bookmarkPreview.items.length} 个书签`, "success");
    setBookmarkPreview({ open: false, name: "", total: 0, skipped: 0, items: [] });
  };

  return (
    <div data-testid="shortcut-manager">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] leading-relaxed text-[var(--fg-subtle)]">
          首页底部图标条的顺序即此列表顺序。共 {items.length} / {LIMITS.maxShortcuts} 个。
        </p>
        <div className="settings-actions shrink-0">
          <Button onClick={() => bookmarkRef.current?.click()} size="sm" variant="secondary" testId="import-bookmarks">
            导入书签
          </Button>
          <Button
            onClick={() => setEditor({ open: true, item: null })}
            size="sm"
            variant="primary"
            testId="add-shortcut"
          >
            添加
          </Button>
          <input
            ref={bookmarkRef}
            type="file"
            accept="text/html,.html,.htm"
            className="hidden"
            data-testid="bookmarks-file"
            onChange={(e) => void onBookmarkFile(e.target.files?.[0])}
          />
        </div>
      </div>

      {items.length === 0 ? (
        <p
          className="rounded-[var(--radius-sm)] border border-dashed border-[var(--glass-border)] px-3 py-6 text-center text-[12px] text-[var(--fg-subtle)]"
          data-testid="shortcut-empty"
        >
          还没有快捷项，点右上角「添加」新建第一个
        </p>
      ) : (
        <Reorder.Group
          as="ul"
          axis="y"
          values={order}
          onReorder={setOrder}
          className="space-y-1"
          data-testid="shortcut-list"
        >
          {order.map((item, index) => (
            <ShortcutRow
              key={item.id}
              item={item}
              index={index}
              total={order.length}
              dragging={draggingId === item.id}
              onDragStart={() => setDraggingId(item.id)}
              onDragEnd={() => {
                setDraggingId(null);
                commitOrder(orderRef.current);
              }}
              onMove={moveBy}
              onEdit={() => setEditor({ open: true, item })}
              onDelete={() => setConfirm({ open: true, itemId: item.id })}
            />
          ))}
        </Reorder.Group>
      )}

      <ShortcutEditor
        open={editor.open}
        item={editor.item}
        reduceMotion={reduce}
        onClose={() => setEditor({ open: false, item: null })}
        onSave={saveItem}
      />

      <Modal
        open={bookmarkPreview.open}
        onClose={() => setBookmarkPreview({ open: false, name: "", total: 0, skipped: 0, items: [] })}
        title="导入浏览器书签"
        description={
          `从 ${bookmarkPreview.name} 读到 ${bookmarkPreview.total} 条，可新增 ` +
          `${bookmarkPreview.items.length} 条` +
          (bookmarkPreview.skipped > 0 ? `，跳过 ${bookmarkPreview.skipped} 条（重复或超出上限）` : "")
        }
        size="md"
        reduceMotion={reduce}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setBookmarkPreview({ open: false, name: "", total: 0, skipped: 0, items: [] })}
            >
              取消
            </Button>
            <Button variant="primary" onClick={confirmBookmarkImport} testId="confirm-bookmark-import">
              导入 {bookmarkPreview.items.length} 个
            </Button>
          </>
        }
      >
        <ul className="thin-scroll max-h-52 space-y-1 overflow-y-auto" data-testid="bookmark-preview-list">
          {bookmarkPreview.items.slice(0, 30).map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-[12px]">
              <ShortcutIcon item={item} size={20} />
              <span className="min-w-0 flex-1 truncate text-[var(--fg)]">{item.title}</span>
              <span className="max-w-[45%] truncate text-[11px] text-[var(--fg-subtle)]">{item.url}</span>
            </li>
          ))}
        </ul>
        {bookmarkPreview.items.length > 30 ? (
          <p className="mt-2 text-[11px] text-[var(--fg-subtle)]">
            还有 {bookmarkPreview.items.length - 30} 个，确认后一并导入。
          </p>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={confirm.open}
        title="删除快捷项"
        description="该快捷项将从列表中移除，可在底部提示里撤销。"
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
    } else {
      setTitle("");
      setUrl("");
      setIconKind("letter");
      setIconValue("");
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
    color: item?.color ?? NEUTRAL_ICON_COLOR,
  };

  const submit = async () => {
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
    if (iconKind === "image" && !iconValue) {
      setError("请选择图片，或把图标来源改回「自动 / 首字母」");
      return;
    }
    /*
     * 自定义图片存 IndexedDB，配置里只留几十字节的引用。
     * 写入失败必须停在这里报错 —— 放过去就会变成「保存成功、刷新后图标没了」。
     */
    let nextIconValue = iconKind === "letter" ? (iconValue || t).charAt(0) : iconValue;
    if (iconKind === "image" && iconValue.startsWith("data:image/")) {
      try {
        nextIconValue = await putStoredImage("icon", iconValue);
      } catch {
        setError("图标保存失败：本地存储不可用或空间不足");
        return;
      }
    }
    onSave({
      id: item?.id ?? uid("sc"),
      title: t,
      url: normalized,
      iconKind,
      iconValue: nextIconValue,
      color: item?.color ?? NEUTRAL_ICON_COLOR,
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

      <FieldGroup label="图标来源" hint="上传图片或填 Emoji 会覆盖自动抓取的站点图标">
        <Segmented
          options={ICON_KINDS}
          value={iconKind}
          onChange={(v) => setIconKind(v)}
          label="图标类型"
          testId="shortcut-icon-kind"
        />
      </FieldGroup>

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
        <FieldGroup label="图片" hint="小于 512KB，仅存本机（IndexedDB）">
          <div className="settings-actions settings-actions--row">
            <Button onClick={() => fileRef.current?.click()} size="sm" testId="shortcut-upload">
              选择图片
            </Button>
            <Input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              data-testid="shortcut-file"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <span className="truncate text-[11px] text-[var(--fg-subtle)]">
              {iconValue ? "已选择本地图片" : "未选择"}
            </span>
          </div>
        </FieldGroup>
      ) : null}

      {error ? (
        <p
          className="mt-1 rounded-lg bg-[color-mix(in_srgb,var(--tone-error)_12%,transparent)] px-2 py-1.5 text-[12px] text-[var(--tone-error)]"
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

/**
 * 单行快捷项。
 *
 * 排序从「上移 / 下移两个按钮」换成拖拽：
 *   · 只有左侧把手能起拖（dragListener={false}），文字、编辑、删除按钮不受影响；
 *   · 把手同时承担键盘兜底：聚焦后 ↑ / ↓ 移动一格，读屏可通过 aria-label 知道用法；
 *   · 拖动中的行加一层浮起底色，避免和下面行的文字叠在一起。
 */
function ShortcutRow({
  item,
  index,
  total,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
  onEdit,
  onDelete,
}: {
  item: Shortcut;
  index: number;
  total: number;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (index: number, delta: number) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const controls = useDragControls();
  const reduce = useReducedMotionPref();

  return (
    <Reorder.Item
      as="li"
      value={item}
      dragListener={false}
      dragControls={controls}
      layout={reduce ? undefined : true}
      dragElastic={0.08}
      dragMomentum={false}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      data-shortcut-id={item.id}
      data-dragging={dragging ? "true" : "false"}
      className="shortcut-row flex items-center gap-2 rounded-[var(--radius-sm)] px-1.5 py-1"
    >
      <button
        type="button"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          controls.start(event);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") {
            event.preventDefault();
            onMove(index, -1);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            onMove(index, 1);
          }
        }}
        aria-label={`拖拽排序 ${item.title}，或按上下方向键移动；当前第 ${index + 1} / ${total} 位`}
        title="拖拽排序（或聚焦后按 ↑ ↓）"
        data-testid={`shortcut-drag-${item.id}`}
        className="shortcut-drag-handle grid size-6 shrink-0 cursor-grab place-items-center rounded-[var(--radius-xs)] text-[var(--fg-subtle)] hover:bg-[var(--hover-bg)] hover:text-[var(--fg)] active:cursor-grabbing"
      >
        <GripIcon />
      </button>

      <ShortcutIcon item={item} size={26} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] text-[var(--fg)]">{item.title}</span>
        <span className="block truncate text-[11px] text-[var(--fg-subtle)]">{item.url}</span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`编辑 ${item.title}`}
          title={`编辑 ${item.title}`}
          data-testid={`shortcut-edit-${item.id}`}
          className="grid size-6 place-items-center rounded-[var(--radius-xs)] text-[var(--fg-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--fg)]"
        >
          <PencilIcon size={11} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`删除 ${item.title}`}
          title={`删除 ${item.title}`}
          data-testid={`shortcut-delete-${item.id}`}
          className="grid size-6 place-items-center rounded-[var(--radius-xs)] text-[var(--fg-muted)] hover:bg-[color-mix(in_srgb,var(--tone-error)_15%,transparent)] hover:text-[var(--tone-error)]"
        >
          <TrashIcon size={11} />
        </button>
      </span>
    </Reorder.Item>
  );
}

function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="3" r="1.1" />
      <circle cx="7" cy="3" r="1.1" />
      <circle cx="3" cy="7" r="1.1" />
      <circle cx="7" cy="7" r="1.1" />
      <circle cx="3" cy="11" r="1.1" />
      <circle cx="7" cy="11" r="1.1" />
    </svg>
  );
}

