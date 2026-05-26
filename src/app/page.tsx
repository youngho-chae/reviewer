import Link from "next/link";

export default function Landing() {
  return (
    <main className="mobile-shell">
      <div className="px-6 pt-16 pb-10">
        <div className="text-[11px] tracking-[0.3em] text-muted">CATCHPASS</div>
        <h1 className="mt-4 text-[28px] font-bold leading-tight text-ink">
          선정 기다리는 체험단 말고,
          <br />
          등급으로 받는 체험권.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-body">
          체험단 티 내지 않고, 사장님 눈치 보지 않고. 평소처럼 이용하고 리뷰로 인증하세요.
        </p>
      </div>

      <div className="px-6 space-y-3">
        <Link
          href="/r/login"
          className="block rounded-sm bg-brand text-white text-center py-4 text-[16px] font-medium hover:bg-brandActive"
        >
          체험자로 시작하기
        </Link>
        <Link
          href="/o/login"
          className="block rounded-sm border border-ink text-ink text-center py-4 text-[16px] font-medium"
        >
          사장님으로 시작하기
        </Link>
      </div>

      <div className="px-6 mt-10 pb-12 text-[13px] text-muted leading-relaxed">
        <p className="mb-2">데모 계정</p>
        <ul className="space-y-1">
          <li>• 체험자: <span className="text-ink">demo@reviewer.com</span> / demo1234</li>
          <li>• 사장님: <span className="text-ink">demo@store.com</span> / demo1234</li>
        </ul>
      </div>
    </main>
  );
}
