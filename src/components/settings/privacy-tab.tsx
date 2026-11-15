"use client";

import { Input } from "@/components/ui/input";
import { Button, TextInput } from "@/components/ui/primitives";
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
        <div className="settings-actions settings-actions--row">
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
        <h3 className="settings-h3">数据管理</h3>
        <div className="settings-actions py-1">
          <Button onClick={exportConfig} size="sm" testId="export-config">
            导出配置
          </Button>
          <Button onClick={() => importRef.current?.click()} size="sm" testId="import-config">
            导入配置
          </Button>
          <Input
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

      {/*
        隐私说明只保留这一份。旧版「关于」页里另有一段几乎逐字相同的
        「数据与隐私」，两处都要跟着改、还互相指来指去；现在关于页只留一行
        指向本弹窗的说明，不再复述。
      */}
      <section className="settings-section">
        <h3 className="settings-h3">隐私说明</h3>
        <div className="space-y-1 text-[11.5px] leading-relaxed text-[var(--fg-muted)]">
          <p>· 本地存储：配置（localStorage）与图片缓存（IndexedDB），仅存本机，不上传。</p>
          <p>
            · 远程请求：一言默认开启、搜索建议默认关闭；接口请求受白名单约束，不带 Cookie、不带
            referrer。站点图标由浏览器直接加载，在「设置 → 快捷跳转 → 站点图标」里关闭。
          </p>
          <p>· 统计：本版本未接入任何第三方统计，默认第三方请求数为 0。</p>
          <p>· 你可以随时导出配置或一键清除全部本地数据。</p>
        </div>
      </section>
    </div>
  );
}
