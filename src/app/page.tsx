import Link from "next/link";

export default function Landing() {
  return (
    <main className="mobile-shell bg-canvas min-h-[100dvh] flex flex-col">
      {/* Hero tile — light parchment, Apple-tight headline */}
      <section className="flex-1 flex flex-col justify-center px-6 py-20 text-center">
        <div className="text-[12px] tracking-[0.18em] text-muted uppercase mb-5">CATCHPASS</div>
        <h1 className="font-display text-[40px] leading-[1.07] text-ink mb-4">
          선정 기다리는<br />체험단 말고,<br />등급으로 받는 체험권.
        </h1>
        <p className="text-[19px] leading-[1.4] text-ink2 max-w-[320px] mx-auto mt-2">
          평소처럼 이용하고 리뷰로 인증하세요.
        </p>
        <div className="flex justify-center gap-3 mt-8">
          <Link
            href="/r/login"
            className="cp-action inline-flex items-center justify-center h-11 px-6 rounded-pill bg-brand text-white text-[17px] font-normal"
          >
            체험자로 시작
          </Link>
          <Link
            href="/o/login"
            className="cp-action inline-flex items-center justify-center h-11 px-6 rounded-pill border border-brand text-brand text-[17px] font-normal"
          >
            사장님으로 시작
          </Link>
        </div>
      </section>

      {/* Dark tile — product story */}
      <section className="bg-tile1 text-white px-6 py-16 text-center">
        <h2 className="font-display text-[34px] leading-[1.1] mb-3">등급이 가치를 만듭니다.</h2>
        <p className="text-[19px] text-[#cccccc] leading-relaxed mb-6">SNS 채널 영향력으로 시작하는 5단계 등급. 매장이 당신을 선택합니다.</p>
        <Link href="/r/signup" className="cp-action inline-flex items-center justify-center h-11 px-6 rounded-pill text-[17px]" style={{ color: "#2997ff" }}>
          더 알아보기 →
        </Link>
      </section>

      {/* Parchment tile — demo credentials */}
      <section className="bg-parchment px-6 py-12">
        <div className="text-[14px] font-semibold text-ink mb-3">데모 계정</div>
        <div className="space-y-2 text-[15px] text-ink2">
          <div>체험자 · <span className="font-mono text-[14px]">demo@reviewer.com</span> / demo1234</div>
          <div>사장님 · <span className="font-mono text-[14px]">demo@store.com</span> / demo1234</div>
        </div>
      </section>
    </main>
  );
}
