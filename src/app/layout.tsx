import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { ConfigProvider } from "@/lib/config-store";
import { ToastProvider } from "@/components/ui/primitives";
import { ThemeSync } from "@/components/theme-sync";
import { SITE } from "@/config/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.title} · 专注、清爽、零打扰的新标签页`,
    template: `%s · ${SITE.title}`,
  },
  description: SITE.description,
  applicationName: SITE.title,
  keywords: ["起始页", "新标签页", "搜索引擎", "快捷跳转", "每日一言", "动态背景"],
  authors: [{ name: SITE.author }],
  creator: SITE.author,
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: SITE.url,
    siteName: SITE.title,
    title: `${SITE.title} · 专注、清爽、零打扰的新标签页`,
    description: SITE.description,
  },
  twitter: {
    card: "summary",
    title: SITE.title,
    description: SITE.description,
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: "/favicon.ico" }],
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#05070c" },
    { media: "(prefers-color-scheme: light)", color: "#eef2f8" },
  ],
  colorScheme: "dark light",
};

/**
 * 首屏主题预置脚本（PRD 5.1：切换无闪烁）
 * 在任何渲染前读取 localStorage 中的主题与强调色，写入 <html>。
 * 只做同步读取 + 属性赋值，<1KB，不阻塞首屏。
 */
const THEME_BOOTSTRAP = `(function(){try{
var raw=localStorage.getItem("startpage.config.v1");
var cfg=raw?JSON.parse(raw):null;
var mode=(cfg&&cfg.theme&&cfg.theme.mode)||"dark";
var accent=(cfg&&cfg.theme&&cfg.theme.accent)||"#2f6fed";
var reduce=cfg&&cfg.a11y?cfg.a11y.reducedMotion:null;
var dark=mode==="dark"||(mode==="system"&&!window.matchMedia("(prefers-color-scheme: light)").matches);
var el=document.documentElement;
el.dataset.theme=dark?"dark":"light";
el.style.colorScheme=dark?"dark":"light";
el.style.setProperty("--accent",accent);
if(reduce===true)el.dataset.motion="reduce";
}catch(e){document.documentElement.dataset.theme="dark";}})();`;

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE.title,
  applicationCategory: "BrowserApplication",
  operatingSystem: "Any",
  url: SITE.url,
  description: SITE.description,
  offers: { "@type": "Offer", price: "0", priceCurrency: "CNY" },
  featureList: [
    "多引擎搜索与快捷指令",
    "时间与问候语",
    "每日一言",
    "快捷跳转分组",
    "动态背景",
    "命令面板",
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body className="antialiased">
        <a href="#main" className="skip-link glass rounded-lg px-3 py-2 text-[12px]">
          跳到主要内容
        </a>
        <ConfigProvider>
          <ToastProvider>
            <ThemeSync />
            {children}
          </ToastProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}
