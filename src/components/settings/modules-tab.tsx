"use client";

import { Field, Segmented, Switch, TextInput } from "@/components/ui/primitives";
import type { SettingsController } from "@/components/settings/controller";

/** 模块页签：时间 / 问候 / 便签 / 一言 */
export function ModulesTab({ s }: { s: SettingsController }) {
  const { config, update } = s;

  return (
    <div className="settings-body">
      <section className="settings-section">
        <h3 className="settings-h3">时间</h3>
        <Switch
          checked={config.clock.show}
          onChange={(v) => update("clock", { show: v })}
          label="显示时钟"
          testId="clock-show"
        />
        <Switch
          checked={config.clock.showSeconds}
          onChange={(v) => update("clock", { showSeconds: v })}
          label="显示秒"
          testId="clock-seconds"
        />
        <Switch
          checked={config.greeting.show}
          onChange={(v) => update("greeting", { show: v })}
          label="显示问候语"
          testId="greeting-show"
        />
        <Field
          label="自定义问候语"
          hint="留空则按时段自动切换（早安 / 上午好 / 午安 / 下午好 / 晚上好 / 夜深了）"
        >
          <TextInput
            value={config.greeting.custom}
            onChange={(v) => update("greeting", { custom: v })}
            placeholder="例如：今天也要加油"
            maxLength={20}
            ariaLabel="自定义问候语"
            testId="greeting-custom"
          />
        </Field>
      </section>

      <section className="settings-section">
        <h3 className="settings-h3">待办便签（可选）</h3>
        <Switch
          checked={config.note.enabled}
          onChange={(v) => update("note", { enabled: v })}
          label="显示待办便签"
          description="默认开启。纯文本，直接保存在本机配置里，随导出/导入与一键清除一起处理，不会上传。"
          testId="note-enable"
        />
      </section>

      <section className="settings-section">
        <h3 className="settings-h3">每日一言</h3>
        <Switch
          checked={config.quote.show}
          onChange={(v) => update("quote", { show: v })}
          label="显示每日一言"
          testId="quote-show"
        />
        <div className="py-2">
          <span className="mb-1.5 block text-[13px] font-medium">数据源</span>
          <Segmented
            options={[
              { value: "local", label: "内置语录库" },
              { value: "remote", label: "远程 API" },
            ]}
            value={config.quote.source}
            onChange={(v) => update("quote", { source: v })}
            label="一言数据源"
            testId="quote-source"
          />
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--fg-subtle)]">
            默认走远程 API（v1.hitokoto.cn），3 秒超时自动回退内置语录库；切成内置库则完全不发网络请求。
          </p>
        </div>
      </section>
    </div>
  );
}
