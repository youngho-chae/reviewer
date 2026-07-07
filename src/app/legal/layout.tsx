import Link from "next/link";

// 법적 고지 문서 공용 레이아웃 — 로그인 없이 접근 가능해야 함 (가입 전 열람)
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mobile-shell bg-canvas min-h-[100dvh]">
      <div className="sticky top-0 z-10 bg-canvas border-b border-hairline">
        <div className="h-[52px] px-5 flex items-center justify-between">
          <Link href="/" className="cp-action text-[15px] font-bold text-brand tracking-title">CATCHPASS</Link>
          <nav className="flex gap-4 text-[13px] font-medium">
            <Link href="/legal/terms" className="cp-action text-ink2">이용약관</Link>
            <Link href="/legal/privacy" className="cp-action text-ink2">개인정보처리방침</Link>
          </nav>
        </div>
      </div>
      <div className="px-5 py-8">{children}</div>
    </main>
  );
}
