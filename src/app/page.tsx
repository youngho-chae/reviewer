import Link from "next/link";

// 루트 랜딩 — 역할 선택 (DESIGN.md v2: 화이트 캔버스, 20px 볼드 타이틀,
// 헤어라인 보더 rounded-md 선택 카드 2장, 퍼플 CTA 액센트)
export default function Landing() {
  return (
    <main className="mobile-shell bg-canvas min-h-[100dvh] flex flex-col px-5 pt-16 pb-10">
      <div className="text-[13px] font-bold text-brand tracking-title">CATCHPASS</div>
      <h1 className="mt-4 text-[20px] font-bold text-ink tracking-title leading-[1.35]">
        선정 기다리는 체험단 말고,
        <br />
        등급으로 받는 체험권.
      </h1>
      <p className="mt-2 text-[15px] text-ink2 leading-[1.5]">평소처럼 이용하고 리뷰로 인증하세요.</p>

      {/* 역할 선택 카드 */}
      <div className="mt-8 space-y-3">
        <Link href="/r/login" className="cp-action block rounded-md border border-hairline bg-canvas p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[16px] font-bold text-ink">체험자로 시작</div>
              <div className="mt-1 text-[13px] text-muted leading-[1.4]">동네 체험권 받고 평소처럼 리뷰로 인증해요</div>
            </div>
            <span className="shrink-0 text-[14px] font-semibold text-brand">시작하기 →</span>
          </div>
        </Link>
        <Link href="/o/login" className="cp-action block rounded-md border border-hairline bg-canvas p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[16px] font-bold text-ink">사장님으로 시작</div>
              <div className="mt-1 text-[13px] text-muted leading-[1.4]">멤버십으로 체험단을 모집하고 후기를 받아요</div>
            </div>
            <span className="shrink-0 text-[14px] font-semibold text-brand">시작하기 →</span>
          </div>
        </Link>
        {/* 관리자(운영팀) 진입 — /admin 백오피스 (2026-07-17 지시) */}
        <Link href="/admin/login" className="cp-action block rounded-md border border-hairline bg-canvas p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[16px] font-bold text-ink">관리자로 시작</div>
              <div className="mt-1 text-[13px] text-muted leading-[1.4]">운영팀 백오피스 — 검수·회원·출금·인증 관리</div>
            </div>
            <span className="shrink-0 text-[14px] font-semibold text-brand">시작하기 →</span>
          </div>
        </Link>
      </div>

      {/* 제품 스토리 — notice-banner 톤 */}
      <div className="mt-8 rounded-md bg-brandSoft px-4 py-4">
        <div className="text-[14px] font-bold text-brand">등급이 가치를 만듭니다.</div>
        <p className="mt-1 text-[13px] text-ink2 leading-[1.5]">
          SNS 채널 영향력으로 시작하는 5단계 등급. 매장이 당신을 선택합니다.
        </p>
        <Link href="/r/signup" className="cp-action inline-block mt-2 text-[13px] font-semibold text-brand">
          더 알아보기 →
        </Link>
      </div>

      {/* 데모 계정 — footer 톤 */}
      <div className="mt-auto pt-10">
        <div className="rounded-md bg-parchment px-4 py-4">
          <div className="text-[13px] font-semibold text-ink mb-2">데모 계정</div>
          <div className="space-y-1 text-[13px] text-ink2">
            <div>체험자 · <span className="font-mono text-[12px]">demo@reviewer.com</span> / demo1234</div>
            <div>사장님 · <span className="font-mono text-[12px]">demo@store.com</span> / demo1234</div>
            <div>관리자 · <span className="font-mono text-[12px]">admin@catchrank.co.kr</span> / demo1234</div>
          </div>
        </div>
      </div>
    </main>
  );
}
