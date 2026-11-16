"use client";

/**
 * 轻提示（sonner）。
 *
 * 为什么单独成文件：`primitives.tsx` 里还装着 Radix 的 Dialog / AlertDialog /
 * Slider / Switch / RadioGroup。`layout.tsx` 只需要 ToastProvider，却因为
 * 「同一个模块」把整套 UI kit 一起拖进了首屏 bundle —— 实测首屏 JS 246 kB gzip，
 * 其中弹窗与表单控件用户在第一屏根本用不到。把 Toast 拆出来后，
 * 那些组件只随设置面板（按需加载）进入，首屏只剩 sonner 这一小块。
 *
 * 视觉约定见 .sp-toast 系列：14px 圆角卡片 + 同尺寸语气图标，位置固定 top-center，
 * 与 Dock / 一言 / 弹窗页脚完全解耦。
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { PERSIST_ERROR_EVENT } from "@/lib/storage";

export type ToastTone = "info" | "success" | "error";
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
   * 不清的话，下一次挂载（尤其是组件测试之间）会把上一轮的提示重新渲染出来。
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
