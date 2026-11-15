"use client";

import { ShortcutManager } from "@/components/shortcut-manager";
import { Switch } from "@/components/ui/primitives";
import type { SettingsController } from "@/components/settings/controller";

/**
 * 快捷跳转页签：站点管理 + 站点图标。
 *
 * 「自动抓取站点图标」原先埋在「隐私与数据」里，但它管的就是这一排图标长什么样，
 * 用户找图标设置时不会想到去翻隐私页。现在跟着站点列表放在同一页，
 * 隐私弹窗只保留白名单、备份与数据边界，各管一件事。
 */
export function ShortcutsTab({ s }: { s: SettingsController }) {
  const { config, update } = s;

  return (
    <div className="settings-body">
      <section className="settings-section">
        <h3 className="settings-h3">快捷跳转</h3>
        <p className="settings-note">
          首页底部那排图标的全部增删改都收在这里 —— 指针划过图标时不会再冒出编辑按钮，首页只负责「点一下就走」。
        </p>
      </section>

      <section className="settings-section">
        <h3 className="settings-h3">站点图标</h3>
        <Switch
          checked={config.icons.autoFetch}
          onChange={(v) => update("icons", { autoFetch: v })}
          label="自动抓取站点图标（favicon）"
          description="默认开启。Dock 与引擎徽标用它显示真实图标；失败或缺图时自动降级为首字母。取图只读 /favicon.ico，不带 Cookie、不带 referrer，内网地址一律跳过。"
          testId="icons-autofetch"
        />
        <p className="settings-note mt-1">
          站点图标是浏览器直接加载的静态图片，不经过请求白名单；想彻底关掉这次请求就关上面的开关。
        </p>
      </section>

      <section className="settings-section">
        <ShortcutManager />
      </section>
    </div>
  );
}
