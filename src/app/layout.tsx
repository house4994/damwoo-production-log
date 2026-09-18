import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "담우 생산일지 / 원료수불부",
  description: "농업회사법인 담우 생산일보 및 원료수불부 자동 계산 및 출력 시스템",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 antialiased">
        <Navbar />
        <main className="flex-1 pb-16">{children}</main>
      </body>
    </html>
  );
}
