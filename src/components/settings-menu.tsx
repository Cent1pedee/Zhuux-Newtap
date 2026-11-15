"use client";

import { DropdownMenu } from "radix-ui";
import { Fragment, type ReactElement } from "react";
import type { SettingsTab } from "@/components/settings-panel";
import {
  IconGrid,
  IconImage,
  IconInfo,
  IconLayers,
  IconPalette,
  IconSearch,
  IconShield,
} from "@/components/settings/tab-icons";

/**
 * 右上角设置的二级菜单。
 *
 * 点击齿轮先出这一层，而不是直接把整套设置拍在用户脸上：
 * 菜单只负责「去哪一页」，真正的设置项仍在完整弹窗里。
 * 顺序对齐参考图：常规 → 搜索 → 壁纸 → 快捷跳转 → 模块，分隔线之后是隐私与关于。
 */
const ITEMS: { id: SettingsTab; label: string; icon: React.ReactNode; separated?: boolean }[] = [
  { id: "appearance", label: "常规设置", icon: <IconPalette /> },
  { id: "search", label: "搜索引擎偏好", icon: <IconSearch /> },
  { id: "background", label: "壁纸偏好", icon: <IconImage /> },
  { id: "shortcuts", label: "快捷跳转", icon: <IconGrid /> },
  { id: "modules", label: "模块显示", icon: <IconLayers /> },
  { id: "privacy", label: "隐私与数据", icon: <IconShield />, separated: true },
  { id: "about", label: "关于", icon: <IconInfo /> },
];

export function SettingsMenu({
  open,
  onOpenChange,
  onSelect,
  trigger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (tab: SettingsTab) => void;
  /** 触发按钮由调用方提供：简洁首页是悬浮齿轮，经典布局是顶栏动作 */
  trigger: ReactElement;
}) {
  return (
    <DropdownMenu.Root open={open} onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          side="bottom"
          sideOffset={10}
          collisionPadding={12}
          data-testid="settings-menu"
          className="settings-menu"
        >
          {ITEMS.map((item) => (
            <Fragment key={item.id}>
              {item.separated ? <DropdownMenu.Separator className="settings-menu-sep" /> : null}
              <DropdownMenu.Item
                className="settings-menu-item"
                data-testid={`settings-menu-${item.id}`}
                onSelect={() => onSelect(item.id)}
              >
                <span className="settings-menu-icon" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </DropdownMenu.Item>
            </Fragment>
          ))}
          <DropdownMenu.Arrow className="settings-menu-arrow" />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
