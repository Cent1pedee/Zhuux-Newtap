"use client";

import { Button, Switch, TextInput } from "@/components/ui/primitives";
import type { SettingsController } from "@/components/settings/controller";

/** 隐私与数据页签：请求白名单、站点图标、导入导出与一键清除 */
export function PrivacyTab({ s, onClear }: { s: SettingsController; onClear: () => void }) {
  const {
    config,
    update,
    push,
    whitelistDraft,
    setWhitelistDraft,
    addWhitelist,
    importRef,
    exportConfig,
    onImportFile,
  } = s;

  return (
    <div className="settings-body">
      <section className="settings-section">
        <h3 className="settings-h3">请求白名单</h3>
        <p className="mb-2 text-[11px] leading-relaxed text-[var(--fg-subtle)]">
          所有远程请求都必须命中白名单，否则被 fetch 封装直接拒绝。默认仅含可选功能的域名。
        </p>
        <ul className="mb-2 space-y-1">
          {config.privacy.whitelist.map((host) => (
            <li
              key={host}
              className="flex items-center gap-2 rounded-lg border border-[var(--glass-border)] px-2 py-1"
            >
              <span className="flex-1 truncate font-mono text-[11.5px]">{host}</span>
              <button
                type="button"
                onClick={() => {
                  update("privacy", { whitelist: config.privacy.whitelist.filter((h) => h !== host) });
                  push("已移除", "success");
                }}
                aria-label={`移除白名单 ${host}`}
                data-testid={`whitelist-remove-${host}`}
                className="grid size-5 place-items-center rounded text-[var(--fg-subtle)] hover:bg-red-500/15 hover:text-red-400"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-1.5">
          <div className="min-w-0 flex-1">
            <TextInput
              value={whitelistDraft}
              onChange={setWhitelistDraft}
              placeholder="example.com"
              ariaLabel="新增白名单域名"
              testId="whitelist-input"
            />
          </div>
          <Button onClick={addWhitelist} size="sm" testId="whitelist-add">
            添加
          </Button>
        </div>
      </section>

      <section className="settings-section">
        <h3 className="settings-h3">站点图标</h3>
        <Switch
          checked={config.icons.autoFetch}
          onChange={(v) => update("icons", { autoFetch: v })}
          label="自动抓取站点图标（favicon）"
          /* 这条曾经写「默认关闭，仅白名单域名」，与「Dock 显示站点图标」直接冲突：
             favicon 的域名恰恰就是每个站点自己，永远不可能预先列进白名单。
             现在默认开启，白名单只管 safeFetch 的接口请求（一言 / 天气 / 壁纸元数据）。 */
          description="默认开启。Dock 与引擎徽标用它显示真实图标；失败或缺图时自动降级为首字母。取图只读 /favicon.ico，不带 Cookie、不带 referrer，内网地址一律跳过。"
          testId="icons-autofetch"
        />
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--fg-subtle)]">
          白名单只约束「一言 / 天气 / 壁纸元数据」这类接口请求；站点图标是浏览器直接加载的静态图片，
          不经过白名单——两者不会互相限制。
        </p>
      </section>

      <section className="settings-section">
        <h3 className="settings-h3">数据管理</h3>
        <div className="flex flex-wrap gap-2 py-1">
          <Button onClick={exportConfig} size="sm" testId="export-config">
            导出配置
          </Button>
          <Button onClick={() => importRef.current?.click()} size="sm" testId="import-config">
            导入配置
          </Button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            data-testid="import-file"
            onChange={(e) => onImportFile(e.target.files?.[0])}
          />
          <Button onClick={onClear} size="sm" variant="danger" testId="clear-data">
            一键清除全部数据
          </Button>
        </div>
      </section>

      <section className="settings-section">
        <h3 className="settings-h3">隐私说明</h3>
        <div className="space-y-1 text-[11.5px] leading-relaxed text-[var(--fg-muted)]">
          <p>· 本地存储：配置（localStorage）与图片缓存（IndexedDB），仅存本机，不上传。</p>
          <p>
            · 远程请求：一言与天气默认开启、搜索建议默认关闭；接口请求受白名单约束，不带 Cookie、不带
            referrer。站点图标由浏览器直接加载，可在「站点图标」里关闭。
          </p>
          <p>· 统计：本版本未接入任何第三方统计，默认第三方请求数为 0。</p>
          <p>· 你可以随时导出配置或一键清除全部本地数据。</p>
        </div>
      </section>
    </div>
  );
}
