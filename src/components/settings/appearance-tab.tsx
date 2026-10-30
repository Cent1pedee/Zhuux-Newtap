"use client";

import { ACCENTS } from "@/config/site";
import { Segmented, Switch } from "@/components/ui/primitives";
import type { SettingsController } from "@/components/settings/controller";

/** 外观页签：主题模式、强调色（含对比度校验）、动效偏好 */
export function AppearanceTab({ s }: { s: SettingsController }) {
  const { config, set, update, customAccent, pickAccent, contrast, acceptable } = s;

  return (
    <div className="settings-body">
      <section className="settings-section">
        <h3 className="settings-h3">主题</h3>
        <Segmented
          options={[
            { value: "light", label: "亮色" },
            { value: "dark", label: "暗色" },
            { value: "system", label: "跟随系统" },
          ]}
          value={config.theme.mode}
          onChange={(v) => update("theme", { mode: v })}
          label="主题模式"
          testId="theme-mode"
        />
      </section>

      <section className="settings-section">
        <h3 className="settings-h3">强调色</h3>
        <div className="flex flex-wrap gap-1.5">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => update("theme", { accent: a.value })}
              aria-label={`强调色 ${a.name}`}
              aria-pressed={config.theme.accent === a.value}
              data-testid={`accent-${a.id}`}
              className={`size-7 rounded-full border-2 transition-transform hover:scale-110 ${
                config.theme.accent === a.value ? "border-white" : "border-transparent"
              }`}
              style={{ background: a.value }}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="color"
            value={customAccent}
            onChange={(e) => pickAccent(e.target.value)}
            aria-label="自定义强调色"
            data-testid="accent-picker"
            className="size-8 cursor-pointer rounded border border-[var(--glass-border)] bg-transparent"
          />
          <span className="font-mono text-[11px] text-[var(--fg-subtle)]">{customAccent}</span>
          <span
            className={`text-[11px] ${acceptable ? "text-emerald-400" : "text-amber-400"}`}
            data-testid="accent-contrast"
          >
            对比度 {contrast.toFixed(1)}:1 {acceptable ? "（通过 AA）" : "（低于 3:1，未应用）"}
          </span>
        </div>
      </section>

      <section className="settings-section">
        <h3 className="settings-h3">动效</h3>
        <Switch
          checked={config.a11y.reducedMotion === true}
          onChange={(v) => set("a11y", { reducedMotion: v ? true : null })}
          label="减少动效"
          description="开启后禁用全部动画；关闭则跟随系统 prefers-reduced-motion。"
          testId="reduce-motion"
        />
      </section>
    </div>
  );
}
