import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "情報Ⅰ Digital Lab（2・3年次）",
  description: "情報Ⅰのデジタル分野を、実験と確認問題で学ぶ2・3年次向けの教材サイトです。"
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
