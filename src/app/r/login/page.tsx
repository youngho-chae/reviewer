"use client";
import { Suspense, useState } from "react";
import { REALTEST } from "@/lib/flags";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ReviewerLoginPage() {
  return (
    <Suspense fallback={null}>
      <ReviewerLogin />
    </Suspense>
  );
}

function ReviewerLogin() {
  const router = useRouter();
  const sp = useSearchParams();
  // realtest: 데모 프리필 없음 — 내부 인원 실계정 로그인 (flags.ts REALTEST)
  const [email, setEmail] = useState(REALTEST ? "" : "demo@reviewer.com");
  const [password, setPassword] = useState(REALTEST ? "" : "demo1234");
  // 소셜 콜백 실패 시 ?error= 로 복귀 (2026-07-23 간편로그인)
  const [err, setErr] = useState<string | null>(sp.get("error"));
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "reviewer", email, password }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      setErr(error || "로그인 실패");
      setLoading(false);
      return;
    }
    router.push("/r/home");
    router.refresh();
  }

  return (
    <main className="mobile-shell px-6 pt-14 pb-10 bg-canvas">
      <Link href="/" className="text-brand text-[15px]">← 처음으로</Link>
      <h1 className="mt-8 text-[20px] font-bold tracking-title text-ink">체험자 로그인</h1>
      <p className="mt-3 text-[17px] text-ink2 leading-[1.47]">CATCHPASS 등급으로 체험권을 받아보세요.</p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="이메일" className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[17px]" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="비밀번호" className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[17px]" />
        {err && <div className="text-error text-[14px]">{err}</div>}
        <button disabled={loading} type="submit" className="cp-action w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:opacity-50">{loading ? "로그인 중..." : "로그인"}</button>
      </form>

      {/* 간편로그인 (2026-07-23) — 기존 계정이면 즉시 로그인, 처음이면 휴대폰 인증 후 가입으로 */}
      <div className="mt-7 flex items-center gap-3">
        <span className="flex-1 h-px bg-hairline" />
        <span className="text-[12px] text-muted">간편로그인</span>
        <span className="flex-1 h-px bg-hairline" />
      </div>
      <div className="mt-4 space-y-2">
        <a href="/api/auth/social/naver/start" className="cp-action flex w-full h-[52px] items-center justify-center rounded-md bg-[#03C75A] text-white text-[16px] font-bold">
          네이버로 시작하기
        </a>
        <a href="/api/auth/social/kakao/start" className="cp-action flex w-full h-[52px] items-center justify-center rounded-md bg-[#FEE500] text-[#191919] text-[16px] font-bold">
          카카오로 시작하기
        </a>
      </div>

      <div className="mt-6 text-center text-[15px]">
        <span className="text-muted">처음이신가요? </span>
        <Link href="/r/signup" className="text-brand">가입하기 →</Link>
      </div>
    </main>
  );
}
