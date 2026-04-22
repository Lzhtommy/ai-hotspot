import type { Metadata } from 'next';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import './globals.css';

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'AI Hotspot',
  description: 'AI 资讯热点聚合 — 每小时抓取、LLM 评分、事件聚合的中文 AI 时间线。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <head>
        <link
          rel="preload"
          href="/fonts/NotoSansSC-Variable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col bg-paper text-ink-900 font-sans">
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
