import "./globals.css";
import type { Metadata, Viewport } from "next";
import { ensureSeed } from "@/lib/seed";

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

// seed on first import (server-side)
ensureSeed();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
