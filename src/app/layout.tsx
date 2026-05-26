import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "CATCHPASS",
  description: "선정 기다리는 체험단 말고, 등급으로 받는 체험권.",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};
// 시드는 db.ts의 getDB/getDBAsync 내부에서 lazy 처리 — 별도 호출 불필요

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
