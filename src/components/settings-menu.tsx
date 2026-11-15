"use client";

import { DropdownMenu } from "radix-ui";
import type { ReactElement } from "react";
import type { SettingsTarget } from "@/components/settings-panel";
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
 * 右上角齿轮的二级菜单 —— 现在也是「隐私与数据」「关于」的唯一入口。
 *
 * 旧版这两类既出现在菜单里、又在主设置面板占一个页签，导航重复了一遍；
 * 菜单和面板的标签还各写各的（「常规设置 / 壁纸偏好 / 模块显示」对
 * 「常规 / 背景 / 模块」），同一件事两个名字。现在：
 *   · 五个分类项 → 打开主设置面板的对应页签，标签与面板逐字一致；
 *   · 隐私与数据 / 关于 → 直接打开各自的独立弹窗，不再经过主面板；
 *   · 两组各有一个 11px 组名，层级一眼可读。
 */
type MenuItem = { id: SettingsTarget; label: string; icon: React.ReactNode };

const GROUPS: { label: string; items: MenuItem[] }[] = [
  {
    label: "设置分类",
    items: [
      { id: "appearance", label: "常规", icon: <IconPalette /> },
      { id: "modules", label: "模块", icon: <IconLayers /> },
      { id: "shortcuts", label: "快捷跳转", icon: <IconGrid /> },
      { id: "background", label: "背景", icon: <IconImage /> },
      { id: "search", label: "搜索引擎", icon: <IconSearch /> },
    ],
  },
  {
    label: "数据与信息",
    items: [
      { id: "privacy", label: "隐私与数据", icon: <IconShield /> },
      { id: "about", label: "关于", icon: <IconInfo /> },
    ],
  },
];

export function SettingsMenu({
  open,
  onOpenChange,
  onSelect,
  trigger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (target: SettingsTarget) => void;
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
          {GROUPS.map((group, index) => (
            <div key={group.label}>
              {index > 0 ? <DropdownMenu.Separator className="settings-menu-sep" /> : null}
              <DropdownMenu.Label className="settings-menu-label">{group.label}</DropdownMenu.Label>
              <DropdownMenu.Group>
                {group.items.map((item) => (
                  <DropdownMenu.Item
                    key={item.id}
                    className="settings-menu-item"
                    data-testid={`settings-menu-${item.id}`}
                    onSelect={() => onSelect(item.id)}
                  >
                    <span className="settings-menu-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    {item.label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Group>
            </div>
          ))}
          <DropdownMenu.Arrow className="settings-menu-arrow" />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
