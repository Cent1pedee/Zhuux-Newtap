"use client";

/**
 * Magic UI · TextAnimate（按需引入，手写等价实现）
 * 参考 magicui.design/docs/components/text-animate
 *
 * 作用：文本按字符（或单词）依次淡入上移，用于「每日一言」切换时的逐字 reveal。
 * reduced-motion 时直接渲染整句，不做逐字动画（PRD 8.5）。
 */

import { motion } from "motion/react";
import { useMemo } from "react";
import { EASE_OUT_CUBIC } from "@/lib/motion";

export function TextAnimate({
  text,
  by = "character",
  reduce = false,
  delay = 0,
  stagger = 0.012,
  className = "",
  testId,
}: {
  text: string;
  by?: "character" | "word";
  reduce?: boolean;
  delay?: number;
  stagger?: number;
  className?: string;
  testId?: string;
}) {
  const pieces = useMemo(() => {
    if (by === "word") return text.split(/(\s+)/).filter((s) => s.length > 0);
    return Array.from(text);
  }, [text, by]);

  if (reduce) {
    return (
      <span className={className} data-testid={testId}>
        {text}
      </span>
    );
  }

  return (
    <span className={className} data-testid={testId} aria-label={text}>
      {pieces.map((piece, index) => (
        <motion.span
          key={`${piece}-${index}`}
          aria-hidden="true"
          className="inline-block whitespace-pre"
          initial={{ opacity: 0, y: 6, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.26, delay: delay + index * stagger, ease: EASE_OUT_CUBIC }}
        >
          {piece}
        </motion.span>
      ))}
    </span>
  );
}
