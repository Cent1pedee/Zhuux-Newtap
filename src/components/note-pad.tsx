"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useConfig, useReducedMotionPref } from "@/lib/config-store";
import { EASE_OUT_CUBIC, ENTRANCE_DELAY, fadeUp } from "@/lib/motion";

const MAX_LEN = 2000;

/**
 * 待办便签（P2，可关闭）。
 *
 * 视觉上迭代过三版：
 *   ① 一行小字标签 + 一个裸 textarea —— 标签和输入框各自为政，像把表单控件扔进卡片。
 *   ② 带图标圆徽的标题栏 + 无边框输入区 + 可收起的底部操作栏。
 *   ③ 这一版在 ② 上继续加细节：
 *      · 徽标换成渐变底 + 内高光，和 Dock 图标是同一套材质；
 *      · 卡片左侧有一道 accent 竖线，聚焦时点亮 —— 让人一眼看出「这块可以写」；
 *      · 字数变成胶囊，接近上限时换警示色并轻微脉动；
 *      · 输入框底部有一条极细的字数进度条，随输入生长；
 *      · 底部操作栏给清空按钮配了图标，悬浮时才染红。
 * 数据仍是纯文本，随配置一起导入导出 / 一键清除，输入防抖 300ms 落盘。
 */
export function NotePad() {
  const { config, update } = useConfig();
  const reduce = useReducedMotionPref();
  const [draft, setDraft] = useState(config.note.content);
  const [saved, setSaved] = useState(false);
  const [focused, setFocused] = useState(false);
  const dirty = useRef(false);
  const savedTimer = useRef<number | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  // 外部（导入 / 一键清除 / 恢复出厂）改动时同步回输入框
  useEffect(() => {
    if (dirty.current) return;
    setDraft(config.note.content);
  }, [config.note.content]);

  // 防抖落盘
  useEffect(() => {
    if (!dirty.current) return;
    const timer = window.setTimeout(() => {
      update("note", { content: draft.slice(0, MAX_LEN) });
      dirty.current = false;
      setSaved(true);
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setSaved(false), 1600);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draft, update]);

  useEffect(() => {
    return () => {
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
    };
  }, []);

  // 输入框自动长高：贴两行时固定高度会冒出一条滚动条，写第三行就得手动滚，
  // 在便签上这种体验很别扭。按 scrollHeight 撑开，上限 8 行后交给内部滚动。
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = "auto";
    const lineHeight = 22;
    const max = lineHeight * 8;
    area.style.height = `${Math.min(max, Math.max(46, area.scrollHeight))}px`;
    area.style.overflowY = area.scrollHeight > max ? "auto" : "hidden";
  }, [draft]);

  if (!config.note.enabled) return null;

  const onChange = (value: string) => {
    dirty.current = true;
    setDraft(value.slice(0, MAX_LEN));
  };

  const clear = () => {
    dirty.current = true;
    setDraft("");
    areaRef.current?.focus();
  };

  const nearLimit = draft.length > MAX_LEN * 0.9;
  const hasContent = draft.length > 0;
  // 可用「已输入字数 / 一屏可见的舒适容量」当进度，而不是拿 2000 字去比 ——
  // 对着 2000 字的进度条写两行永远是 0，看不出反馈。
  const meter = Math.min(1, draft.length / 240);

  return (
    <motion.section
      aria-label="待办便签"
      variants={fadeUp(reduce, 10)}
      initial="hidden"
      animate="show"
      transition={{ delay: reduce ? 0 : ENTRANCE_DELAY.quote + 0.15 }}
      className="note-card w-full"
      data-testid="note-card"
      data-focused={focused ? "true" : "false"}
      data-empty={hasContent ? "false" : "true"}
    >
      <span className="note-rail" aria-hidden="true" />

      {/* 标题栏：渐变徽标 + 标题 + 保存状态 + 字数胶囊 */}
      <div className="note-head">
        <span className="note-badge" aria-hidden="true">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M4 7h16" strokeLinecap="round" />
            <path d="M4 12h10" strokeLinecap="round" />
            <path d="M4 17h7" strokeLinecap="round" />
          </svg>
        </span>
        <span className="note-title">待办便签</span>

        <AnimatePresence>
          {saved ? (
            <motion.span
              initial={{ opacity: 0, x: reduce ? 0 : -4, scale: reduce ? 1 : 0.94 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
              transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT_CUBIC }}
              className="note-saved"
              data-testid="note-saved"
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              已保存
            </motion.span>
          ) : null}
        </AnimatePresence>

        <span
          className={`note-count ${nearLimit ? "note-count--warn" : ""}`}
          data-testid="note-count"
          data-visible={hasContent ? "true" : "false"}
          title={`${draft.length} / ${MAX_LEN} 字`}
        >
          {hasContent ? draft.length : ""}
        </span>
      </div>

      {/* 输入区：铺在卡片上，聚焦时浮出一圈内发光 */}
      <textarea
        ref={areaRef}
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="随手记点什么…"
        maxLength={MAX_LEN}
        rows={2}
        aria-label="待办便签内容"
        data-testid="note-input"
        className="note-input thin-scroll"
      />

      {/* 输入框下沿的字数进度：写两行就能看见它长一点，比对着 2000 字计数有反馈 */}
      <span className="note-meter" aria-hidden="true">
        <motion.span
          className="note-meter-fill"
          animate={{ scaleX: meter }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 34, mass: 0.6 }}
        />
      </span>

      {/* 底部操作栏：内容为空且未聚焦时整条收起，空闲卡片上不出现按钮 */}
      <div className="note-foot" data-empty={hasContent ? "false" : "true"}>
        <span className="note-hint">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
            <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          自动保存在本机 · 不会上传
        </span>
        <button
          type="button"
          onClick={clear}
          disabled={!hasContent}
          data-testid="note-clear"
          className="note-clear"
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          清空
        </button>
      </div>
    </motion.section>
  );
}
