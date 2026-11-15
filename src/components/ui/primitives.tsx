"use client";

/* 把 shadcn 官方组件包装成项目原有的 API：导出名、props、data-testid、类名都不变。
   Slider 的 DOM 变成 Radix thumb，E2E 设值改用键盘；弹窗动画换成 data-[state] CSS 动画。 */

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch as ShadcnSwitch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button as ShadcnButton } from "@/components/ui/button";
import { PERSIST_ERROR_EVENT } from "@/lib/storage";
import { cn } from "@/lib/utils";

/* ==========================================================================
   模态框：shadcn Dialog（Radix 提供焦点陷阱 / Esc 层叠 / 滚动锁 / 焦点恢复）
   ========================================================================== */

/** 官方 DialogContent 的固定定位 + 默认内距都要清掉，换回项目原有的玻璃面板配方 */
const DIALOG_PANEL_CLASS =
  "glass-strong flex flex-col overflow-hidden rounded-[var(--radius-card)] border-0 bg-transparent p-0 shadow-none gap-0 outline-none " +
  "max-w-none focus-visible:ring-0";

const DIALOG_OVERLAY_CLASS = "bg-black/45 backdrop-blur-[10px] border-0";

type OverlayProps = React.ComponentProps<typeof DialogOverlay>;

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
  returnFocusTo,
  panelClassName,
  initialFocus = "first",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  reduceMotion?: boolean;
  labelledBy?: string;
  bodyClassName?: string;
  fixedHeight?: boolean;
  /** 显式指定关闭后焦点回到哪个元素；不传则用打开时的 activeElement */
  returnFocusTo?: HTMLElement | null;
  /** 追加到弹窗面板上的类名（例如设置弹窗需要更实的底色） */
  panelClassName?: string;
  /**
   * 打开时焦点落在哪。
   * 默认交给 Radix 找第一个可聚焦元素；没有输入框的弹窗会落到右上角关闭按钮上，
   * 而程序化聚焦在 Chrome 里会命中 :focus-visible，一打开就有一圈刺眼的轮廓。
   * 这类弹窗改成聚焦面板本身（tabIndex=-1），读屏仍会播报标题，Tab 再去关闭按钮。
   */
  initialFocus?: "first" | "panel";
}) {
  const autoId = useId();
  const titleId = labelledBy ?? `${autoId}-title`;
  const descId = `${autoId}-desc`;

  /*
   * onClose 用 ref 保存：调用方普遍传内联箭头函数，每次上层渲染都是新引用。
   * Radix 的 onOpenChange 直接读 ref，不会因为重渲染重建监听或抢走输入焦点。
   */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  /*
   * 焦点还原：本项目的弹窗由外部 state 控制，没有 shadcn 的 DialogTrigger，
   * 因此 Radix 的 triggerRef 是空的，关闭后不会把焦点还给触发按钮。
   * 在 render 阶段（Radix 的 FocusScope 抢焦点之前）记下当前焦点，
   * 关闭后下一帧还回去 —— 与替换前 Modal 的行为一致。
   */
  const restoreRef = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  if (!wasOpen.current && open) {
    restoreRef.current =
      returnFocusTo ?? (typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null));
  }
  wasOpen.current = open;

  /*
   * 焦点还必须在 Radix 完成清理之后（它关闭时会把焦点丢给 body）。
   * 用 onCloseAutoFocus 而不是自己 setTimeout：这个回调就是为「关闭后焦点去哪」准备的，
   * 还能 preventDefault 掉 Radix 的默认行为。
   */
  const onCloseAutoFocus = (event: Event) => {
    const node = restoreRef.current;
    restoreRef.current = null;
    if (!node || !document.contains(node)) return;
    event.preventDefault();
    // 等 Radix 把 aria-hidden / inert 从背景移除后再聚焦，否则 focus() 会被吞掉
    window.setTimeout(() => {
      if (node.isConnected) node.focus();
    }, 0);
  };

  const widthClass =
    size === "sm"
      ? "max-w-sm sm:max-w-sm"
      : size === "lg"
        ? "max-w-3xl sm:max-w-3xl"
        : "max-w-xl sm:max-w-xl";
  const heightClass = fixedHeight ? "h-[min(640px,84dvh)]" : "max-h-[86dvh]";

  const overlayProps = {
    "data-testid": "modal-overlay",
    className: DIALOG_OVERLAY_CLASS,
    children: <span data-testid="modal-backdrop" className="absolute inset-0" aria-hidden="true" />,
  } as unknown as OverlayProps;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCloseRef.current(); }}>
      <DialogContent
        showCloseButton={false}
        overlayProps={overlayProps}
        tabIndex={initialFocus === "panel" ? -1 : undefined}
        onOpenAutoFocus={
          initialFocus === "panel"
            ? (event) => {
                event.preventDefault();
                (event.currentTarget as HTMLElement).focus();
              }
            : undefined
        }
        onCloseAutoFocus={onCloseAutoFocus}
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        data-reduce-motion={reduceMotion ? "true" : undefined}
        className={cn(DIALOG_PANEL_CLASS, heightClass, widthClass, "w-full", panelClassName)}
      >
        <DialogHeader className="flex flex-row shrink-0 items-start justify-between gap-4 border-b border-[var(--glass-border)] px-5 py-4 text-left">
          <div>
            <DialogTitle id={titleId} className="text-[15px] font-semibold leading-normal tracking-tight">
              {title}
            </DialogTitle>
            {description ? (
              <DialogDescription id={descId} className="mt-1 text-xs leading-relaxed text-[var(--fg-subtle)]">
                {description}
              </DialogDescription>
            ) : null}
          </div>
          <DialogClose asChild>
            <button
              type="button"
              aria-label="关闭弹窗"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--fg)] focus-visible:ring-0"
              data-testid="modal-close"
            >
              <CloseIcon />
            </button>
          </DialogClose>
        </DialogHeader>
        {children ? (
          <div className={bodyClassName ?? "thin-scroll flex-1 overflow-y-auto px-5 py-4"}>{children}</div>
        ) : null}
        {footer ? (
          <DialogFooter className="flex shrink-0 flex-row items-center justify-end gap-2 border-t border-[var(--glass-border)] px-5 py-3 sm:flex-row sm:justify-end">
            {footer}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* ==========================================================================
   Toast：shadcn 官方方案 sonner + 项目自己的一张卡片

   之前的 toast 是「34px 小胶囊 + 6px 圆点」，和页面里 12~18px 圆角的卡片、
   13px 正文完全不是一套语言；位置又挂在 bottom-center 上、靠实测 Dock 高度
   抬起来，于是：窄屏 Dock 折行时偏移会滞后、设置弹窗打开时气泡正好压在
   「恢复出厂 / 完成」那排按钮上、一言那行文字也会被盖住。多条同时出现时
   sonner 默认把旧的气泡缩小叠在后面，宽度随文字变，堆成一摞参差的碎片。

   现在统一成：
     · 位置固定 top-center + 20px，与 Dock / 一言 / 弹窗页脚彻底无关；
     · 一张 14px 圆角卡片，底色与描边取和设置面板相同的玻璃 token；
     · 语气用「同尺寸图标 + 同尺寸色块」表达，不再靠一颗小圆点；
     · 宽度由 sonner 的 --width 统一，多条展开堆叠，不再缩放错位。
   ========================================================================== */

type ToastTone = "info" | "success" | "error";
type ToastAction = { label: string; onClick: () => void };
type ToastContextValue = { push: (text: string, tone?: ToastTone, action?: ToastAction) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

/** 三种语气共用同一套 14px 线性图标：尺寸、线宽、圆角一致，只有路径不同 */
function ToastToneIcon({ tone }: { tone: ToastTone }) {
  const shape = (
    <>
      <circle cx="12" cy="12" r="9" />
      {tone === "success" ? (
        <path d="m8 12 2.7 2.7L16 9.4" strokeLinecap="round" strokeLinejoin="round" />
      ) : tone === "error" ? (
        <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" />
      ) : (
        <path d="M12 11.2v5M12 7.9h.01" strokeLinecap="round" />
      )}
    </>
  );
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      {shape}
    </svg>
  );
}

/**
 * 系统级「减少动效」偏好兜底（layout 里没给 ToastProvider 传 reduceMotion，
 * 所以必须自己读一次，否则页面其它动画停了、气泡还在弹）。
 */
function useSystemReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return reduce;
}

export function ToastProvider({
  children,
  reduceMotion,
}: {
  children: React.ReactNode;
  reduceMotion?: boolean;
}) {
  const systemReduce = useSystemReduceMotion();
  const reduce = reduceMotion ?? systemReduce;

  const push = useCallback((text: string, tone: ToastTone = "info", action?: ToastAction) => {
    toast.custom(
      (t) => (
        <div className="sp-toast" data-testid="toast" data-tone={tone} role="status">
          <span className="sp-toast-icon" aria-hidden="true">
            <ToastToneIcon tone={tone} />
          </span>
          <span className="sp-toast-text">{text}</span>
          {action ? (
            <button
              type="button"
              onClick={() => {
                action.onClick();
                toast.dismiss(t);
              }}
              data-testid="toast-action"
              className="sp-toast-action"
            >
              {action.label}
            </button>
          ) : null}
        </div>
      ),
      { duration: action ? 6000 : 2800, unstyled: true },
    );
  }, []);

  /** 配置写盘失败的提示：ConfigProvider 自己拿不到 UI，只广播事件 */
  useEffect(() => {
    const onPersistError = () => {
      push("本地存储写入失败，设置可能无法保存：请清理浏览器存储，或改用图片地址而非本地上传", "error");
    };
    window.addEventListener(PERSIST_ERROR_EVENT, onPersistError);
    return () => window.removeEventListener(PERSIST_ERROR_EVENT, onPersistError);
  }, [push]);

  /*
   * sonner 的 toast 队列是模块级全局状态，不会随组件卸载清空。
   * 原先 ToastProvider 用局部 state，组件一卸载气泡自然消失；换成官方方案后
   * 不清会在下一次挂载（尤其是组件测试之间）把上一轮的提示重新渲染出来。
   */
  useEffect(
    () => () => {
      toast.dismiss();
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <Toaster
        position="top-center"
        visibleToasts={3}
        duration={2800}
        offset={20}
        gap={10}
        expand
        className={reduce ? "toaster toaster--reduce" : "toaster"}
      />
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

/** 开关本体：shadcn Switch（Radix），几何与位移由 .sp-switch 系列 CSS 独占 */
export function SwitchButton({
  checked,
  onChange,
  label,
  testId,
  size = "md",
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  testId?: string;
  size?: "md" | "sm";
  disabled?: boolean;
}) {
  return (
    <ShadcnSwitch
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
      disabled={disabled}
      data-testid={testId}
      className={cn("sp-switch shrink-0", size === "sm" ? "sp-switch--sm" : "sp-switch--md")}
    />
  );
}

/** 带标题与描述的整行开关：用 shadcn Label 保留「点文字也能切换」 */
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
    <Label className="flex cursor-pointer items-start justify-between gap-4 gap-0 py-2 text-inherit font-normal leading-normal">
      <span className="min-w-0">
        <span className="block text-[13px] font-medium leading-5">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--fg-subtle)]">{description}</span>
        ) : null}
      </span>
      <SwitchButton checked={checked} onChange={onChange} label={label} disabled={disabled} testId={testId} />
    </Label>
  );
}

/** 单控件字段：shadcn Label 包住，点标题 = 聚焦/切换那个控件 */
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <Label className="block gap-0 py-2 text-inherit font-normal leading-normal">
      <span className="mb-1.5 block text-[13px] font-medium leading-5">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-[var(--fg-subtle)]">{hint}</span> : null}
    </Label>
  );
}

/**
 * 多控件字段：视觉与 Field 一致，但**不用 <label>**。
 * <label> 会把点击转发给第一个可标注后代：里面放 Segmented / 色板时，点标题
 * 等于点了第一个选项（实测把壁纸重置回「今天」）。只能用 role="group"。
 * shadcn 没有对应组件，这里用语义容器 + shadcn Label 呈现标题。
 */
export function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="block py-2">
      <Label asChild>
        <span id={id} className="mb-1.5 block gap-0 py-0 text-[13px] font-medium leading-5 text-inherit">
          {label}
        </span>
      </Label>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-[var(--fg-subtle)]">{hint}</span> : null}
    </div>
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
    /* 外层 .glow-field 提供 Magic UI Glow Effect：聚焦时渐变描边 + 柔光 */
    <span className="glow-field block">
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-label={ariaLabel ?? placeholder ?? "输入框"}
        aria-invalid={invalid || undefined}
        data-testid={testId}
        className={cn(
          "h-auto w-full rounded-[var(--radius-sm)] border border-[var(--glass-border)] bg-[var(--input-bg)] px-3 py-2 text-[13px] shadow-none outline-none transition-colors",
          "placeholder:text-[var(--fg-subtle)] selection:bg-transparent",
          "focus:border-transparent focus-visible:border-transparent focus-visible:ring-0",
        )}
      />
    </span>
  );
}

/**
 * 设置面板里的按钮：复用 shadcn/ui 官方 Button，几何与状态在全面板统一。
 *
 * 之前 sm(30px 高 / 6px gap / 12px 字) 与 default(36px / 8px / 13px) 会同时
 * 出现在一个页签里，圆角、内距、按压反馈也各说各话。这里把两档合并成一套：
 * 32px 高、12px 内距、6px 图标间距、12.5px 字号、10px 圆角，
 * hover / focus-visible / disabled 交给 buttonVariants，按压反馈统一叠加。
 * `size` 保留在 API 里以兼容调用方，但不再制造第二种视觉。
 */
const BUTTON_VARIANT = {
  primary: "default",
  secondary: "secondary",
  ghost: "ghost",
  danger: "destructive",
} as const;

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
  return (
    <ShadcnButton
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      data-testid={testId}
      variant={BUTTON_VARIANT[variant]}
      size={size === "sm" ? "sm" : "default"}
      className={cn(
        "sp-btn h-8 gap-1.5 rounded-[10px] px-3 text-[12.5px]",
        "transition-[background-color,box-shadow,transform] duration-150 ease-out",
        "active:scale-[0.98] disabled:active:scale-100",
      )}
    >
      {children}
    </ShadcnButton>
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
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as T)}
      aria-label={label}
      data-testid={testId}
      className="sp-segmented inline-flex flex-row gap-0 rounded-[var(--radius-sm)] border border-[var(--glass-border)] bg-[var(--input-bg)] p-0.5"
    >
      {options.map((opt) => (
        <RadioGroupItem
          key={opt.value}
          value={opt.value}
          className={cn(
            "sp-segmented-item aspect-auto size-auto shrink-0 rounded-[var(--radius-xs)] border-0 px-2.5 py-1 text-[12px] shadow-none transition-colors",
            "focus-visible:ring-0 focus-visible:border-transparent",
            opt.value === value ? "text-white" : "text-[var(--fg-muted)] hover:text-[var(--fg)]",
            "[&_[data-slot='radio-group-indicator']]:hidden",
          )}
          style={opt.value === value ? { background: "var(--accent)" } : undefined}
        >
          {opt.label}
        </RadioGroupItem>
      ))}
    </RadioGroup>
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
    <div className="block py-2">
      <div className="mb-1 flex items-center justify-between text-[13px] font-medium leading-5">
        <span>{label}</span>
        <span className="font-mono text-[11px] text-[var(--fg-subtle)]">
          {value}
          {suffix}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(next) => onChange(next[0] ?? value)}
        thumbLabel={label}
        data-testid={testId}
        className="sp-slider h-1.5 w-full cursor-pointer"
      />
    </div>
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
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) onCancelRef.current(); }}>
      <AlertDialogContent
        size="sm"
        data-reduce-motion={reduceMotion ? "true" : undefined}
        className={cn(DIALOG_PANEL_CLASS, "max-w-sm w-full")}
      >
        <AlertDialogHeader className="flex shrink-0 flex-col gap-0 border-b border-[var(--glass-border)] px-5 py-4 text-left">
          <AlertDialogTitle className="text-[15px] font-semibold leading-normal tracking-tight">{title}</AlertDialogTitle>
          <AlertDialogDescription className="mt-1 text-xs leading-relaxed text-[var(--fg-subtle)]">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex shrink-0 flex-row items-center justify-end gap-2 border-t border-[var(--glass-border)] px-5 py-3 sm:flex-row sm:justify-end">
          <AlertDialogCancel asChild>
            <Button testId="confirm-cancel">{cancelText}</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={onConfirm} variant={danger ? "danger" : "primary"} testId="confirm-ok">
              {confirmText}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}
