import Link from "next/link";

export default function Landing() {
  return (
    <main className="mobile-shell bg-ink min-h-[100dvh] text-white flex flex-col">
      <div className="flex-1 px-7 pt-20 pb-8 flex flex-col justify-center">
        <div className="text-[13px] tracking-[0.25em] text-brand font-bold">CATCHPASS</div>
        <h1 className="mt-3.5 text-[38px] font-extrabold leading-[1.15] tracking-tight">
          선정 기다리는<br />체험단 말고,<br />
          <span className="text-brand">등급으로 받는<br />체험권.</span>
        </h1>
        <p className="mt-5 text-[15px] text-white/70 leading-relaxed">
          체험단 티 내지 않고, 사장님 눈치 보지 않고. 평소처럼 이용하고 리뷰로 인증하세요.
        </p>
      </div>

      <div className="px-7 pb-8 space-y-2.5">
        <Link
          href="/r/login"
          className="block rounded-full bg-brand text-brandInk text-center py-4 text-[16px] font-bold"
        >
          체험자로 시작하기
        </Link>
        <Link
          href="/o/login"
          className="block rounded-full border border-white/30 text-white text-center py-4 text-[16px] font-semibold"
        >
          사장님으로 시작하기
        </Link>
      </div>

      <div className="px-7 pb-10 text-[12px] text-white/55 leading-relaxed">
        <p className="mb-1.5">데모 계정</p>
        <ul className="space-y-0.5">
          <li>• 체험자: <span className="text-white">demo@reviewer.com</span> / demo1234</li>
          <li>• 사장님: <span className="text-white">demo@store.com</span> / demo1234</li>
        </ul>
      </div>
    </main>
  );
}
