import Link from "next/link";

// 법적 고지 문서 공용 레이아웃 — 로그인 없이 접근 가능해야 함 (가입 전 열람)
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mobile-shell bg-canvas min-h-[100dvh]">
      <div className="sticky top-0 z-10 frosted-parchment border-b border-hairlineSoft">
        <div className="h-13 px-5 flex items-center justify-between">
          <Link href="/" className="cp-action text-[15px] text-brand">CATCHPASS</Link>
          <nav className="flex gap-4 text-[13px]">
            <Link href="/legal/terms" className="text-ink2">이용약관</Link>
            <Link href="/legal/privacy" className="text-ink2">개인정보처리방침</Link>
          </nav>
        </div>
      </div>
      <div className="px-6 py-10">{children}</div>
    </main>
  );
}
