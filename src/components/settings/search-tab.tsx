"use client";

import { ENGINES } from "@/config/site";
import { Button, Switch, TextInput } from "@/components/ui/primitives";
import { EngineBadge } from "@/components/engine-glyph";
import type { SettingsController } from "@/components/settings/controller";

/** 引擎行内的小号开关：与设置里的大号 Switch 同一套语言，只是缩小一半 */
function MiniSwitch({
  checked,
  onChange,
  label,
  testId,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      data-testid={testId}
      data-state={checked ? "on" : "off"}
      className={`relative h-[18px] w-8 shrink-0 rounded-full transition-colors duration-200 ease-out ${
        checked ? "" : "bg-[color-mix(in_srgb,var(--fg)_16%,transparent)]"
      }`}
      style={
        checked
          ? { background: "var(--accent)", boxShadow: "0 0 0 2.5px color-mix(in srgb, var(--accent) 16%, transparent)" }
          : undefined
      }
    >
      <span
        className={`absolute top-[2px] left-[2px] size-3.5 rounded-full bg-white transition-transform duration-200 ease-out ${
          checked ? "translate-x-[14px]" : "translate-x-0"
        }`}
        style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
      />
    </button>
  );
}

/** 搜索引擎页签：引擎启停 / 排序、搜索建议、快捷指令 */
export function SearchTab({ s }: { s: SettingsController }) {
  const { config, set, update, push, moveEngine, toggleEngine, enabledEngines, cmdDraft, setCmdDraft, addCommand } =
    s;

  return (
    <div className="settings-body">
      <section className="settings-section">
        <h3 className="settings-h3">搜索引擎</h3>
        <p className="mb-2 text-[11px] text-[var(--fg-subtle)]">
          点击引擎图标循环切换，右键打开列表。至少保留一个。
        </p>
        <ul className="space-y-1">
          {ENGINES.map((engine) => {
            const enabled = config.engineOrder.includes(engine.id);
            const index = config.engineOrder.indexOf(engine.id);
            return (
              <li
                key={engine.id}
                className="flex items-center gap-2 rounded-lg border border-[var(--glass-border)] px-2 py-1.5"
              >
                <EngineBadge id={engine.id} size={22} url={engine.homeUrl} autoFetch={config.icons.autoFetch} />
                <span className="flex-1 truncate text-[12.5px]">{engine.name}</span>
                {enabled ? (
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveEngine(engine.id, -1)}
                      disabled={index <= 0}
                      aria-label={`上移 ${engine.name}`}
                      data-testid={`engine-up-${engine.id}`}
                      className="grid size-6 place-items-center rounded text-[var(--fg-subtle)] hover:bg-[var(--hover-bg)] hover:text-[var(--fg)] disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveEngine(engine.id, 1)}
                      disabled={index >= config.engineOrder.length - 1}
                      aria-label={`下移 ${engine.name}`}
                      data-testid={`engine-down-${engine.id}`}
                      className="grid size-6 place-items-center rounded text-[var(--fg-subtle)] hover:bg-[var(--hover-bg)] hover:text-[var(--fg)] disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                ) : null}
                <MiniSwitch
                  checked={enabled}
                  onChange={(next) => toggleEngine(engine.id, next)}
                  label={`${enabled ? "停用" : "启用"} ${engine.name}`}
                  testId={`engine-toggle-${engine.id}`}
                />
              </li>
            );
          })}
        </ul>
        <p className="mt-1.5 text-[11px] text-[var(--fg-subtle)]">
          当前启用：{enabledEngines.map((e) => e?.name).join(" / ") || "无"}
        </p>
      </section>

      <section className="settings-section">
        <h3 className="settings-h3">搜索建议</h3>
        <Switch
          checked={config.suggest.enabled}
          onChange={(v) => update("suggest", { enabled: v })}
          label="启用实时搜索建议"
          description="开启后仅请求当前引擎的 suggest 接口（api.bing.com），其余引擎无建议源。关闭则零网络请求。"
          testId="suggest-toggle"
        />
      </section>

      <section className="settings-section">
        <h3 className="settings-h3">快捷指令</h3>
        <p className="mb-2 text-[11px] text-[var(--fg-subtle)]">
          在搜索框输入 <code className="kbd">/g 关键词</code> 直达对应站点；无关键词时打开站点首页。
        </p>
        <ul className="mb-2 space-y-1">
          {config.quickCommands.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-2 rounded-lg border border-[var(--glass-border)] px-2 py-1.5"
            >
              <span className="rounded bg-[var(--input-bg)] px-1.5 py-0.5 font-mono text-[11px]">{c.key}</span>
              <span className="min-w-0 flex-1 truncate text-[12px]">{c.label}</span>
              <button
                type="button"
                onClick={() => {
                  set(
                    "quickCommands",
                    config.quickCommands.filter((x) => x.id !== c.id),
                  );
                  push("已删除指令", "success");
                }}
                aria-label={`删除指令 ${c.key}`}
                data-testid={`cmd-delete-${c.id}`}
                className="grid size-6 place-items-center rounded text-[var(--fg-subtle)] hover:bg-red-500/15 hover:text-red-400"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-2 gap-1.5">
          <TextInput
            value={cmdDraft.key}
            onChange={(v) => setCmdDraft({ ...cmdDraft, key: v })}
            placeholder="/x"
            ariaLabel="指令触发词"
            maxLength={8}
            testId="cmd-key"
          />
          <TextInput
            value={cmdDraft.label}
            onChange={(v) => setCmdDraft({ ...cmdDraft, label: v })}
            placeholder="名称"
            ariaLabel="指令名称"
            maxLength={12}
            testId="cmd-label"
          />
          <div className="col-span-2">
            <TextInput
              value={cmdDraft.url}
              onChange={(v) => setCmdDraft({ ...cmdDraft, url: v })}
              placeholder="搜索地址，含 {q} 占位符"
              ariaLabel="指令搜索地址"
              testId="cmd-url"
            />
          </div>
          <div className="col-span-2">
            <TextInput
              value={cmdDraft.siteUrl}
              onChange={(v) => setCmdDraft({ ...cmdDraft, siteUrl: v })}
              placeholder="站点首页（无关键词时打开）"
              ariaLabel="指令站点首页"
              testId="cmd-site"
            />
          </div>
        </div>
        <div className="mt-2">
          <Button onClick={addCommand} size="sm" variant="primary" testId="cmd-add">
            添加快捷指令
          </Button>
        </div>
      </section>
    </div>
  );
}
