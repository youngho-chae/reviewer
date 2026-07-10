"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function OwnerLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@store.com");
  const [password, setPassword] = useState("demo1234");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "owner", email, password }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      setErr(error || "로그인 실패");
      setLoading(false);
      return;
    }
    router.push("/o/home");
    router.refresh();
  }

  return (
    <main className="mobile-shell px-5 pt-14 pb-10 bg-canvas">
      <Link href="/" className="cp-action text-brand text-[14px] font-medium">← 처음으로</Link>
      <h1 className="mt-8 text-[20px] font-bold text-ink tracking-title">사장님 로그인</h1>
      <p className="mt-2 text-[15px] text-ink2 leading-[1.5]">멤버십으로 무제한 모집하세요.</p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="이메일" className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[16px]" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="비밀번호" className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[16px]" />
        {err && <div className="text-error text-[14px]">{err}</div>}
        <button disabled={loading} type="submit" className="w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:bg-sunken disabled:text-mutedSoft">{loading ? "로그인 중..." : "로그인"}</button>
      </form>

      <div className="mt-6 text-center text-[15px]">
        <span className="text-muted">처음이신가요? </span>
        <Link href="/o/signup" className="cp-action text-brand font-semibold">가입하기 →</Link>
      </div>

      {/* [확정 정책 3] 사장님 진입점은 캐치랭크 본체와 연동 예정 — 멤버십 변경도 연동 후 핸들링 */}
      <p className="mt-8 text-center text-[12px] text-muted leading-[1.6]">
        캐치랭크(CatchRank) 계정 연동 로그인은 준비 중이에요.
        <br />
        연동 후에는 캐치랭크에서 바로 사장님 화면으로 진입할 수 있습니다.
      </p>
    </main>
  );
}
