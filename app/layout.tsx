import type { Metadata } from "next";
import "./globals.css";

// GitHub Pages 配信時は /info_23_ddl 配下になるので、favicon もその接頭辞を付ける
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "情報Ⅰ Digital Lab（2・3年次）",
  description: "情報Ⅰのデジタル分野を、実験と確認問題で学ぶ2・3年次向けの教材サイトです。",
  icons: { icon: `${basePath}/favicon.svg` }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
