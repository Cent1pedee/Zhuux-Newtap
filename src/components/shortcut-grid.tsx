"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
import { useConfig, useReducedMotionPref } from "@/lib/config-store";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { ShortcutIcon } from "@/components/shortcut-icon";

/**
 * 点击时间后浮出的快捷方块网格。
 *
 * 与底部 Dock 的分工：
 *   · 这里是「看得见全部」的主入口，每个方块带名称，适合新用户认路；
 *   · Dock 是熟手的一排快捷方式，悬停才浮出名称。
 * 两者共用同一份配置、同一套图标降级链与同一块实心片，
 * 只是尺寸不同（52 / 42）—— 像同一套应用图标的两个尺寸。
 *
 * 没有托板也没有标题栏：方块直接落在模糊后的壁纸上。
 * 最后一块是「添加」，点开就是设置里的快捷跳转页。
 */
export function ShortcutGrid({ onManage }: { onManage: () => void }) {
  const { config, ready } = useConfig();
  const reduce = useReducedMotionPref();
  /**
   * 分组结构保留在配置里（向后兼容），界面上始终展平成一个网格。
   * 与 Dock 同一套「ready 后再挂载」策略：本地配置没读出来之前不渲染出厂列表。
   */
  const items = useMemo(() => (ready ? config.groups.flatMap((g) => g.items) : []), [config.groups, ready]);

  return (
    <motion.nav
      aria-label="快捷网站"
      data-testid="shortcut-grid"
      className="shortcut-grid"
      variants={staggerContainer(reduce, 0.03, 0.02)}
      initial="hidden"
      animate="show"
    >
      {items.map((item) => (
        <motion.a
          key={item.id}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          draggable={false}
          variants={fadeUp(reduce, 10)}
          className="shortcut-tile"
          data-testid={`shortcut-grid-${item.id}`}
          title={item.title}
        >
          <ShortcutIcon item={item} size={52} variant="tile" />
          <span className="shortcut-tile-label">{item.title}</span>
        </motion.a>
      ))}

      <motion.button
        type="button"
        onClick={onManage}
        variants={fadeUp(reduce, 10)}
        className="shortcut-tile shortcut-tile--add"
        data-testid="shortcut-add-tile"
        aria-label="添加或管理快捷网站"
        title="添加或管理快捷网站"
      >
        <span className="shortcut-tile-add-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </span>
        <span className="shortcut-tile-label">添加</span>
      </motion.button>
    </motion.nav>
  );
}
