// File: app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "SKU Label Processor",
  description: "Generate SKU labels with headers and divider pages.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* --- 最终优化：只预加载单个常规字体 --- */}
        <link
          rel="preload"
          href="/fonts/NotoSansSC-Regular.ttf"
          as="font"
          type="font/ttf" // 注意：如果是 .otf 文件，这里写 font/otf
          crossOrigin="anonymous"
        />
      </head>
      <body className={cn("min-h-screen bg-background font-sans antialiased", inter.variable)}>
        {children}
      </body>
    </html>
  );
}