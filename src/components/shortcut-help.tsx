"use client";

import { useEffect } from "react";
import { Button, Modal } from "@/components/ui/primitives";
import { useReducedMotionPref } from "@/lib/config-store";

const ROWS: { keys: string[]; text: string }[] = [
  { keys: ["⌘", "K"], text: "打开命令面板（Windows 用 Ctrl）" },
  { keys: ["Ctrl", "1–9"], text: "打开第 1–9 个快捷项" },
  { keys: ["/"], text: "在搜索框里输入快捷指令，例如 /g、/bili" },
  { keys: ["Enter"], text: "搜索，或打开选中的建议" },
  { keys: ["Esc"], text: "关闭浮层；搜索框里则清空输入" },
  { keys: ["?"], text: "打开这份快捷键说明" },
  { keys: ["右键"], text: "在页面任意位置唤出或收起快捷网站" },
];

/**
 * 快捷键说明。
 *
 * `?` 的监听放在组件内部：它需要「不在输入框里」这个判断，
 * 放在 page.tsx 会让页面再多一段与渲染无关的键盘逻辑。
 */
export function ShortcutHelp({
  open,
  onOpen,
  onClose,
  returnFocusTo,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** 关闭后焦点回到哪 —— 从「关于」里点进来时，入口按钮随弹窗一起卸载了 */
  returnFocusTo?: HTMLElement | null;
}) {
  const reduce = useReducedMotionPref();

  useEffect(() => {
    if (open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "?" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      // 在输入框里问号是正文，不是快捷键
      if (target instanceof HTMLElement && target.closest("input, textarea, [contenteditable='true']")) return;
      event.preventDefault();
      onOpen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpen]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="快捷键"
      description="首页与浮层里可用的键盘操作。"
      size="sm"
      reduceMotion={reduce}
      returnFocusTo={returnFocusTo}
      footer={
        <Button onClick={onClose} variant="primary" testId="shortcut-help-close">
          知道了
        </Button>
      }
    >
      <ul className="m-0 list-none space-y-2 p-0" data-testid="shortcut-help-list">
        {ROWS.map((row) => (
          <li key={row.text} className="flex items-center justify-between gap-4 text-[12px]">
            <span className="text-[var(--fg-muted)]">{row.text}</span>
            <span className="flex shrink-0 items-center gap-1">
              {row.keys.map((key) => (
                <kbd
                  key={key}
                  className="rounded-[var(--radius-xs)] border border-[var(--glass-border)] bg-[var(--input-bg)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--fg)]"
                >
                  {key}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
