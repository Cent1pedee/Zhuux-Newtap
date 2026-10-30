"use client";

import { ShortcutManager } from "@/components/shortcut-manager";

/** 快捷跳转页签：增删改排序全部交给 ShortcutManager，这里只包一层说明 */
export function ShortcutsTab() {
  return (
    <div className="settings-body">
      <section className="settings-section">
        <h3 className="settings-h3">快捷跳转</h3>
        <p className="mb-2 text-[11px] leading-relaxed text-[var(--fg-subtle)]">
          首页底部那排图标的全部增删改都收在这里 —— 指针划过图标时不会再冒出编辑按钮，
          首页只负责「点一下就走」。
        </p>
      </section>
      <section className="settings-section">
        <ShortcutManager />
      </section>
    </div>
  );
}
