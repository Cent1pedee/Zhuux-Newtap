"use client";

import { SITE } from "@/config/site";
import { Button } from "@/components/ui/primitives";
import type { SettingsController } from "@/components/settings/controller";

/** 关于弹窗：站点信息、技术栈、版本、复制地址与快捷键入口 */
export function AboutTab({
  s,
  onOpenHelp,
  onClose,
}: {
  s: SettingsController;
  onOpenHelp?: () => void;
  onClose?: () => void;
}) {
  const { config, push } = s;

  return (
    <div className="settings-body">
      <section className="settings-section">
        <div className="flex items-center gap-3">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-md)] text-[15px] font-semibold text-white"
            style={{ background: "var(--accent)" }}
            aria-hidden="true"
          >
            起
          </span>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold">{SITE.title}</h3>
            <p className="text-[11.5px] leading-relaxed text-[var(--fg-subtle)]">{SITE.description}</p>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h3 className="settings-h3">技术栈</h3>
        <p className="text-[11.5px] leading-relaxed text-[var(--fg-muted)]">
          Next.js 15 App Router · React 19 · TypeScript strict · Tailwind CSS v4 · Motion · Magic UI
          风格组件（全部自绘，无第三方运行时依赖）。
        </p>
      </section>

      <section className="settings-section">
        <h3 className="settings-h3">数据与隐私</h3>
        <p className="text-[11.5px] leading-relaxed text-[var(--fg-muted)]">
          配置与图片缓存只存本机，完整说明和备份 / 清理入口在右上角菜单的「隐私与数据」。
        </p>
      </section>

      <section className="settings-section">
        <div className="settings-actions">
          <Button
            onClick={() => {
              // 非 HTTPS / 隐私模式下 clipboard 可能整个不可用：旧版会静默无反应
              if (!navigator.clipboard?.writeText) {
                push("当前环境不支持剪贴板，请手动复制地址栏", "error");
                return;
              }
              void navigator.clipboard
                .writeText(window.location.href)
                .then(() => push("站点地址已复制", "success"))
                .catch(() => push("复制失败，请手动复制地址栏", "error"));
            }}
            size="sm"
            testId="about-copy-url"
          >
            复制站点地址
          </Button>
          {onOpenHelp ? (
            <Button
              onClick={() => {
                onClose?.();
                onOpenHelp();
              }}
              size="sm"
              testId="about-open-help"
            >
              查看快捷键
            </Button>
          ) : null}
        </div>
        <p className="mt-2 text-[11px] text-[var(--fg-subtle)]">版本 1.0.0 · 配置结构 v{config.version}</p>
      </section>
    </div>
  );
}
