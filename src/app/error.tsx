"use client";

import Link from "next/link";

/**
 * 段级错误边界。
 *
 * 之前没有任何 error.tsx：任何一个模块在渲染期抛错（例如某次配置里存了非法值，
 * 让 `lat.toFixed()` 直接炸掉），React 会卸载整棵树 —— 用户看到的是一张纯白页面，
 * 连「回首页」都没有。这里提供两条出路：
 *   · 重试：`reset()` 重新渲染这一段（瞬时错误、一次性异常可直接恢复）；
 *   · 返回：链接回首页（`reset` 无效时至少能离开）。
 *
 * 注意：error.tsx 必须是 Client Component，且**不能**捕获 layout 自身的错误
 * （那需要根级的 global-error.tsx），本项目 layout 只做静态元数据与 Provider，
 * 风险面很小，暂不额外加一层。
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="app-shell items-center justify-center px-6">
      <div className="glass w-full max-w-md rounded-[var(--radius-card)] p-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--fg-subtle)]">Error</p>
        <h1 className="mt-2 text-[20px] font-semibold">页面出了点问题</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--fg-muted)]">
          渲染这一段时抛出了异常。你的配置与便签都存在本机，没有丢失。
        </p>
        {error.digest ? (
          <p
            className="mt-2 font-mono text-[10.5px] text-[var(--fg-subtle)]"
            data-testid="error-digest"
          >
            错误编号 {error.digest}
          </p>
        ) : null}
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-[var(--radius-sm)] px-3.5 py-2 text-[13px] font-medium text-white"
            style={{ background: "var(--accent)" }}
            data-testid="error-retry"
          >
            重试
          </button>
          <Link
            href="/"
            className="rounded-[var(--radius-sm)] border border-[var(--glass-border)] px-3.5 py-2 text-[13px] font-medium text-[var(--fg)]"
            data-testid="error-home"
          >
            返回起始页
          </Link>
        </div>
      </div>
    </div>
  );
}
