import Link from "next/link";

export const metadata = { title: "页面不存在" };

export default function NotFound() {
  return (
    <div className="app-shell items-center justify-center px-6">
      <div className="glass w-full max-w-md rounded-[var(--radius-card)] p-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--fg-subtle)]">404</p>
        <h1 className="mt-2 text-[20px] font-semibold">这里没有内容</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--fg-muted)]">
          你要找的页面不存在。起始页只有一个单页，所有配置都在本机浏览器里。
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Link
            href="/"
            className="rounded-[var(--radius-sm)] px-3.5 py-2 text-[13px] font-medium text-white"
            style={{ background: "var(--accent)" }}
          >
            返回起始页
          </Link>
        </div>
      </div>
    </div>
  );
}
