"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useConfig, useReducedMotionPref } from "@/lib/config-store";
import { ENTRANCE_DELAY, fadeUp, staggerContainer } from "@/lib/motion";
import { useToast } from "@/components/ui/primitives";
import { ShortcutIcon } from "@/components/shortcut-icon";

/**
 * 快捷跳转 Dock（青柠起始页的做法）
 *
 * 这里只有「跳转」一件事：图标 + 名称，点开即走。
 * 不分组、不标题、不卡片；悬停时只有图标上浮 + 一团柔光，
 * 指针移到图标上**不会**浮出任何编辑工具条。
 * 增删改与排序全部在「设置 → 快捷跳转」里完成。
 */
export function ShortcutDock() {
  const { config } = useConfig();
  const reduce = useReducedMotionPref();
  const { push } = useToast();

  /** 分组结构保留在配置里（向后兼容），界面上始终展平成一条 */
  const items = useMemo(() => config.groups.flatMap((g) => g.items), [config.groups]);

  /**
   * macOS Dock 式的「相邻图标一起放大」。
   * 只记录当前指针压在哪个图标上，其余交给每个图标自己按距离算缩放 ——
   * 这样不用把指针坐标逐帧写进 state（会触发整排重渲染，反而掉帧）。
   */
  const [hovered, setHovered] = useState<number | null>(null);

  /**
   * 小屏下的横向滚动渐隐。
   *
   * 手机上 Dock 改成「一行 + 横向滚动」（见 globals.css 的 .shortcut-dock），
   * 一屏放不下 12 项。没有渐隐时，右边缘会硬切半个图标，读起来像布局坏了；
   * 有渐隐才读得出「右边还有」。两端只在该方向真的有内容时才淡出，
   * 滚到头就恢复满亮度 —— 所以这两个标记要跟着滚动位置实时算。
   */
  const dockRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ start: false, end: false });

  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;
    const update = () => {
      // 只有横向滚动真的生效时才需要渐隐（桌面是 wrap，不该出现淡出）
      if (getComputedStyle(el).overflowX !== "auto") {
        setFade({ start: false, end: false });
        return;
      }
      /*
       * 不能直接看 scrollWidth：名称气泡是绝对定位的，桌面端它会溢出到格子之外，
       * 把 scrollWidth 顶大，于是「三项、根本不用滚」也会被判定成可滚并淡出右边缘。
       * 这里改成按子项的实宽累加来算内容宽度 —— 只统计参与流式布局的格子。
       */
      const nodes = Array.from(el.querySelectorAll<HTMLElement>(".shortcut-item"));
      if (nodes.length === 0) {
        setFade({ start: false, end: false });
        return;
      }
      const gap = Number.parseFloat(getComputedStyle(el).columnGap || "0") || 0;
      const contentWidth =
        nodes.reduce((sum, node) => sum + node.getBoundingClientRect().width, 0) + gap * (nodes.length - 1);
      const overflow = contentWidth - el.clientWidth;
      const scrollable = overflow > 2;
      setFade({
        start: scrollable && el.scrollLeft > 2,
        end: scrollable && el.scrollLeft < overflow - 2,
      });
    };
    update();
    // 首帧量到的可能是「样式尚未生效」的尺寸，下一帧再校一次
    const raf = requestAnimationFrame(update);
    el.addEventListener("scroll", update, { passive: true });
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => {
        cancelAnimationFrame(raf);
        el.removeEventListener("scroll", update);
        window.removeEventListener("resize", update);
      };
    }
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // 胶囊宽度变化（旋转屏幕 / 断点切换）同样会影响是否可滚
    if (el.parentElement) ro.observe(el.parentElement);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [items.length]);

  /** Ctrl+数字直达（PRD 4.4）：纯键盘启动，不产生任何界面元素 */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return;
      if (!/^[1-9]$/.test(event.key)) return;
      const target = event.target as HTMLElement | null;
      if (target && target.closest("input, textarea, [contenteditable='true']")) return;
      const item = items[Number(event.key) - 1];
      if (!item) return;
      event.preventDefault();
      push(`打开 ${item.title}`, "info");
      window.open(item.url, "_blank", "noopener,noreferrer");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, push]);

  return (
    <motion.section
      aria-label="快捷跳转"
      data-entrance="grid"
      className="w-full"
      variants={staggerContainer(reduce, 0.03, ENTRANCE_DELAY.grid)}
      initial="hidden"
      animate="show"
    >
      <div
        ref={dockRef}
        className="shortcut-dock"
        data-testid="shortcut-dock"
        data-fade-start={fade.start ? "true" : "false"}
        data-fade-end={fade.end ? "true" : "false"}
      >
        <AnimatePresence initial={false}>
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              layout={!reduce}
              variants={fadeUp(reduce, 8)}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, scale: reduce ? 1 : 0.9, transition: { duration: reduce ? 0 : 0.16 } }}
              onPointerEnter={() => setHovered(index)}
              onPointerLeave={() => setHovered((prev) => (prev === index ? null : prev))}
              whileTap={reduce ? undefined : { scale: 0.94 }}
              data-shortcut-id={item.id}
              className="shortcut-item"
              data-near={hovered !== null && Math.abs(hovered - index) <= 1 ? "true" : "false"}
            >
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                draggable={false}
                title={`打开 ${item.title}`}
                data-testid={`shortcut-${item.id}`}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered((prev) => (prev === index ? null : prev))}
                className="flex flex-col items-center outline-none"
              >
                {/*
                  悬停只作用于这一层：图标自身缩放上浮，柔光也只包住图标。
                  邻居用更小的一档缩放（0.06），指针扫过时整排像被指尖压过 ——
                  单一图标自己弹起来会显得孤立。
                */}
                <motion.span
                  className="shortcut-icon-wrap"
                  animate={{
                    y: hovered === index ? (reduce ? 0 : -4) : 0,
                    scale:
                      hovered === null
                        ? 1
                        : hovered === index
                          ? reduce
                            ? 1
                            : 1.12
                          : Math.abs(hovered - index) === 1 && !reduce
                            ? 1.06
                            : 1,
                  }}
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 380, damping: 26, mass: 0.6 }
                  }
                >
                  <ShortcutIcon item={item} size={42} />
                </motion.span>
                <span className="shortcut-item-label">{item.title}</span>
              </a>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {items.length === 0 ? (
        <p className="shortcut-dock-empty mt-1" data-testid="shortcut-empty">
          还没有快捷项 —— 打开设置里的「快捷跳转」即可添加
        </p>
      ) : null}

      <span className="sr-only" data-testid="shortcut-total">
        {items.length}
      </span>
    </motion.section>
  );
}
