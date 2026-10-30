"use client";

import { SITE } from "@/config/site";
import { Button } from "@/components/ui/primitives";
import type { SettingsController } from "@/components/settings/controller";

/** 关于页签：站点信息、技术栈、隐私边界、复制地址 */
export function AboutTab({ s }: { s: SettingsController }) {
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
          配置存 localStorage、图片缓存存 IndexedDB，全部只在本机。默认第三方请求数为 0；
          任何远程请求都必须命中白名单。可在「隐私与数据」里导出、导入或一键清除。
        </p>
      </section>

      <section className="settings-section">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              void navigator.clipboard
                ?.writeText(window.location.href)
                .then(() => push("站点地址已复制", "success"))
                .catch(() => push("复制失败，请手动复制地址栏", "error"));
            }}
            size="sm"
            testId="about-copy-url"
          >
            复制站点地址
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-[var(--fg-subtle)]">版本 1.0.0 · 配置结构 v{config.version}</p>
      </section>
    </div>
  );
}
