"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* ==========================================================================
   模态框：无障碍 dialog（焦点陷阱 + Esc 关闭 + 遮罩点击关闭 + 滚动锁定）
   ========================================================================== */

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/*
 * 打开中的弹窗栈。
 *
 * 设置面板里点「添加」会再叠一层编辑弹窗，两层的 Esc / Tab 监听都挂在 document 上，
 * 于是按一次 Esc 会把两层一起关掉。用栈记住顺序，只有栈顶那层响应键盘。
 */
const modalStack: symbol[] = [];

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  reduceMotion = false,
  labelledBy,
  bodyClassName,
  fixedHeight = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  reduceMotion?: boolean;
  labelledBy?: string;
  /** 覆盖内容区默认样式（设置面板需要「只有右侧内容滚动」的自定义布局） */
  bodyClassName?: string;
  /**
   * 固定高度：面板高度不再随内容多少伸缩。
   * 设置面板各分类内容长短差异很大，只用 max-h 会导致每次切换页签整个弹窗跳一下高度，
   * 所以这里给出确定高度 —— 短内容留白、长内容在内容区内部滚动。
   */
  fixedHeight?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const autoId = useId();
  const titleId = labelledBy ?? `${autoId}-title`;
  const descId = `${autoId}-desc`;

  /*
   * 必须挂到 document.body 上（portal）。
   *
   * 历史 bug：设置面板里的「快捷跳转」页签会再开一个编辑弹窗，而这个弹窗原先渲染在
   * 设置弹窗内部。祖先 `.glass-strong` 同时带 `backdrop-filter` 与 `overflow: hidden`，
   * 于是子元素的 `position: fixed` 不再是相对视口，而是相对这块玻璃定位 —— 编辑弹窗
   * 被塞进 640px 高的小盒子里，标题被顶到遮罩下面看不见（实测标题点命中的是
   * `.absolute inset-0 bg-black/55 backdrop-blur-[3px]`）。
   * 走 portal 之后 fixed 重新相对视口，嵌套弹窗才和顶层弹窗行为一致。
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /*
   * onClose 用 ref 保存，effect 只依赖 open。
   *
   * 历史 bug：调用方普遍传内联箭头 `onClose={() => setOpen(false)}`，每次渲染都是
   * 新函数；而配置变更（改任何设置项）都会让上层重渲染 —— effect 于是重跑，
   * 里面那段「聚焦第一个可聚焦元素」把焦点从正在输入的框抢到关闭按钮上，
   * 表现就是「输入一个字符就被强行跳出」。
   */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Esc 关闭 + Tab 焦点陷阱
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;

    const token = Symbol("modal");
    modalStack.push(token);

    const onKeyDown = (event: KeyboardEvent) => {
      // 只让最上层弹窗响应：否则嵌套时一次 Esc 会关掉两层
      if (modalStack[modalStack.length - 1] !== token) return;

      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const timer = window.setTimeout(() => {
      const node = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      node?.focus();
    }, 30);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const at = modalStack.indexOf(token);
      if (at >= 0) modalStack.splice(at, 1);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(timer);
      restoreRef.current?.focus?.();
    };
    // 故意只依赖 open：见上面 onCloseRef 的注释
  }, [open]);

  const widthClass = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-3xl" : "max-w-xl";
  // 固定高度模式：用确定高度替代 max-h，切换分类时面板不再跳动
  const heightClass = fixedHeight ? "h-[min(640px,84dvh)]" : "max-h-[86dvh]";

  // 首帧还没挂载（SSR / 静态预渲染）时不能碰 document
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18 }}
          data-testid="modal-overlay"
        >
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
            onClick={onClose}
            aria-hidden="true"
            data-testid="modal-backdrop"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            className={`glass-strong relative z-10 flex ${heightClass} w-full ${widthClass} flex-col overflow-hidden rounded-[var(--radius-card)]`}
            initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.94, y: reduceMotion ? 0 : 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.96, y: reduceMotion ? 0 : 8 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 380, damping: 32, mass: 0.9, opacity: { duration: 0.18 } }
            }
          >
            <header className="flex items-start justify-between gap-4 border-b border-[var(--glass-border)] px-5 py-4">
              <div>
                <h2 id={titleId} className="text-[15px] font-semibold tracking-tight">
                  {title}
                </h2>
                {description ? (
                  <p id={descId} className="mt-1 text-xs leading-relaxed text-[var(--fg-subtle)]">
                    {description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="关闭弹窗"
                className="grid size-8 shrink-0 place-items-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--fg)]"
                data-testid="modal-close"
              >
                <CloseIcon />
              </button>
            </header>
            <div className={bodyClassName ?? "thin-scroll flex-1 overflow-y-auto px-5 py-4"}>{children}</div>
            {footer ? (
              <footer className="flex items-center justify-end gap-2 border-t border-[var(--glass-border)] px-5 py-3">
                {footer}
              </footer>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

/* ==========================================================================
   Toast：轻提示（所有操作反馈）
   ========================================================================== */

type Toast = { id: number; text: string; tone: "info" | "success" | "error" };
type ToastContextValue = { push: (text: string, tone?: Toast["tone"]) => void };

import { createContext, useContext } from "react";

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children, reduceMotion = false }: { children: React.ReactNode; reduceMotion?: boolean }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const push = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = (seq.current += 1);
    setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 10, scale: reduceMotion ? 1 : 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
              className="glass-strong pointer-events-auto max-w-[90vw] rounded-full px-4 py-2 text-xs shadow-lg"
              data-testid="toast"
            >
              <span
                aria-hidden="true"
                className="mr-1.5 inline-block size-1.5 rounded-full align-middle"
                style={{
                  background: t.tone === "error" ? "#f87171" : t.tone === "success" ? "#34d399" : "var(--accent)",
                }}
              />
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast 必须在 ToastProvider 内使用");
  return ctx;
}

/* ==========================================================================
   基础控件
   ========================================================================== */

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  testId,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span className="min-w-0">
        <span className="block text-[13px] font-medium leading-5">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--fg-subtle)]">{description}</span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        data-testid={testId}
        data-state={checked ? "on" : "off"}
        /*
          开关重新做过：原先 h-5 w-9 + 1px 边框 + size-4 滑块，
          轨道内宽只有 34px、滑块 16px，打开态两侧各剩 1px ——
          深色背景下那圈 border 还会透出来，看起来像「滑块被卡在灰框里」。
          现在：轨道 34×20，不用边框而是用「底色深浅」表达开/关，
          滑块 16px 带 2px 内边距，位移 14px，两侧各留 2px；
          关态是半透明前景色（不是阴影灰），开态是强调色 + 同色柔光。
        */
        className={`relative mt-0.5 h-5 w-[34px] shrink-0 rounded-full transition-colors duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-40 ${
          checked ? "" : "bg-[color-mix(in_srgb,var(--fg)_16%,transparent)]"
        }`}
        style={
          checked
            ? {
                background: "var(--accent)",
                boxShadow: "0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent)",
              }
            : undefined
        }
      >
        <span
          className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform duration-200 ease-out ${
            checked ? "translate-x-[14px]" : "translate-x-0"
          }`}
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.35)" }}
        />
      </button>
    </label>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block py-2">
      <span className="mb-1.5 block text-[13px] font-medium leading-5">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-[var(--fg-subtle)]">{hint}</span> : null}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  maxLength,
  type = "text",
  ariaLabel,
  testId,
  invalid = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: string;
  ariaLabel?: string;
  testId?: string;
  invalid?: boolean;
}) {
  return (
    /* 外层 .glow-field 提供 Magic UI Glow Effect：聚焦时渐变描边 + 柔光，
       原生 input 上无法画 ::after，故用一层 span 承载 */
    <span className="glow-field block">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-label={ariaLabel ?? placeholder ?? "输入框"}
        aria-invalid={invalid || undefined}
        data-testid={testId}
        className="w-full rounded-[var(--radius-sm)] border border-[var(--glass-border)] bg-[var(--input-bg)] px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-[var(--fg-subtle)] focus:border-transparent"
      />
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "secondary",
  size = "md",
  type = "button",
  disabled = false,
  testId,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  type?: "button" | "submit";
  disabled?: boolean;
  testId?: string;
  ariaLabel?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-45";
  const sizes = size === "sm" ? "px-2.5 py-1.5 text-[12px]" : "px-3.5 py-2 text-[13px]";
  const variants: Record<string, string> = {
    primary: "text-white hover:brightness-110 active:brightness-95",
    secondary:
      "border border-[var(--glass-border)] bg-[var(--input-bg)] text-[var(--fg)] hover:bg-[var(--hover-bg)]",
    ghost: "text-[var(--fg-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--fg)]",
    danger: "border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      data-testid={testId}
      className={`${base} ${sizes} ${variants[variant]}`}
      style={variant === "primary" ? { background: "var(--accent)" } : undefined}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  testId,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  testId?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-testid={testId}
      className="inline-flex rounded-[var(--radius-sm)] border border-[var(--glass-border)] bg-[var(--input-bg)] p-0.5"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`rounded-[var(--radius-xs)] px-2.5 py-1 text-[12px] transition-colors ${
              active ? "text-white" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
            }`}
            style={active ? { background: "var(--accent)" } : undefined}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function Range({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  suffix = "",
  testId,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  suffix?: string;
  testId?: string;
}) {
  return (
    <label className="block py-2">
      <span className="mb-1 flex items-center justify-between text-[13px] font-medium leading-5">
        {label}
        <span className="font-mono text-[11px] text-[var(--fg-subtle)]">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        data-testid={testId}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--input-bg)] accent-[var(--accent)]"
        style={{ accentColor: "var(--accent)" }}
      />
    </label>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "确认",
  cancelText = "取消",
  danger = false,
  onConfirm,
  onCancel,
  reduceMotion,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  reduceMotion?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      reduceMotion={reduceMotion}
      footer={
        <>
          <Button onClick={onCancel} testId="confirm-cancel">
            {cancelText}
          </Button>
          <Button onClick={onConfirm} variant={danger ? "danger" : "primary"} testId="confirm-ok">
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-[var(--fg-muted)]">{description}</p>
    </Modal>
  );
}

export function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}
