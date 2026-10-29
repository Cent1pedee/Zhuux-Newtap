"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useConfig, useReducedMotionPref } from "@/lib/config-store";
import { EASE_OUT_CUBIC } from "@/lib/motion";
import { quoteOfDay, randomQuote, type Quote } from "@/lib/quotes";
import { fetchRemoteQuote } from "@/lib/services";
import { useToast } from "@/components/ui/primitives";
import { TextAnimate } from "@/components/magicui/text-animate";

export function DailyQuote() {
  const { config, ready } = useConfig();
  const reduce = useReducedMotionPref();
  const { push } = useToast();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [dimmed, setDimmed] = useState(false);
  const seq = useRef(0);

  /**
   * 首次取一条：按配置来源（默认远程 hitokoto），失败静默回退本地库。
   * 不再暴露「分类」——分类属于「我挑哪一叠卡片」的后台设定，
   * 出现在首页那一行小字旁边只会让人以为它是个筛选器。
   */
  useEffect(() => {
    /*
     * 必须等配置就绪：ConfigProvider 首帧给的是默认值（远程），
     * 若此时就发请求，本地源的用户也会白跑一次网络。
     */
    if (!ready) return;
    let alive = true;
    if (config.quote.source === "local") {
      setQuote(quoteOfDay(config.quote.category));
      return;
    }
    const seqId = (seq.current += 1);
    setLoading(true);
    fetchRemoteQuote(config.privacy.whitelist)
      .then((remote) => {
        if (!alive || seq.current !== seqId) return;
        setQuote({ text: remote.text, from: remote.from, category: "literary" });
      })
      .catch(() => {
        if (!alive || seq.current !== seqId) return;
        setQuote(quoteOfDay(config.quote.category));
      })
      .finally(() => {
        if (alive && seq.current === seqId) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [ready, config.quote.source, config.quote.category, config.privacy.whitelist]);

  /**
   * 聚焦渐隐：页面内任意输入框获得焦点（搜索框 / 设置 / 便签）时，
   * 一言让位给用户正在输入的内容；失焦后原样淡回。
   * 用 focusin/focusout 监听而不是上下文传参，组件之间保持零耦合。
   */
  useEffect(() => {
    const isTextField = (el: EventTarget | null) =>
      el instanceof HTMLElement && el.matches("input, textarea, [contenteditable='true']");
    const onFocusIn = (event: FocusEvent) => {
      if (isTextField(event.target)) setDimmed(true);
    };
    const onFocusOut = () => setDimmed(false);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  /** 换一条：点整段文字即可（不再有刷新按钮） */
  const refresh = useCallback(async () => {
    const seqId = (seq.current += 1);
    const fallback = randomQuote(config.quote.category, quote?.text);

    if (config.quote.source === "local") {
      setQuote(fallback);
      return;
    }

    setLoading(true);
    try {
      const remote = await fetchRemoteQuote(config.privacy.whitelist);
      if (seq.current !== seqId) return;
      setQuote({ text: remote.text, from: remote.from, category: "literary" });
    } catch {
      if (seq.current !== seqId) return;
      setQuote(fallback);
      push("远程一言不可用，已回退本地语录", "info");
    } finally {
      if (seq.current === seqId) setLoading(false);
    }
  }, [config.quote.category, config.quote.source, config.privacy.whitelist, quote?.text, push]);

  if (!config.quote.show) return null;

  return (
    /**
     * 一言没有容器、没有边框、没有按钮组 —— 就是背景上的一行小字。
     * 整段文字本身是按钮：点字换一条，指针移上去才浮现「换一条」的提示。
     */
    <motion.section
      aria-label="每日一言"
      data-entrance="quote"
      data-dimmed={dimmed ? "true" : "false"}
      className="quote-section relative z-40 mx-auto flex w-full max-w-[520px] flex-col items-center px-1"
      data-testid="quote-section"
    >
      <div className="relative flex w-full flex-col items-center gap-1.5" data-testid="quote-card">
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          title="点击换一条"
          data-testid="quote-body"
          className="quote-body w-full"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={quote?.text ?? "loading"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: reduce ? 0 : -4 }}
              transition={{ duration: reduce ? 0 : 0.16, ease: EASE_OUT_CUBIC }}
              className="text-quote block text-[13.5px] leading-[1.9]"
            >
              <TextAnimate
                text={loading && !quote ? "正在取一句话…" : (quote?.text ?? "加载中…")}
                reduce={reduce}
                testId="quote-text"
              />
            </motion.span>
          </AnimatePresence>
        </button>

        {/* 只留出处。远程/本地、分类、刷新都不显示 —— 一行小字旁边挂四个控件只会分散注意力 */}
        <span className="quote-from text-[10.5px] text-[var(--fg-subtle)]" data-testid="quote-from">
          {quote?.from ? `— ${quote.from}` : ""}
        </span>
      </div>
    </motion.section>
  );
}
