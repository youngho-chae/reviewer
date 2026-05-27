"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ReviewerLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@reviewer.com");
  const [password, setPassword] = useState("demo1234");
  const [err, setErr] = useState<string | null>(null);
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
    <main className="mobile-shell px-6 pt-14 pb-10">
      <Link href="/" className="text-muted text-[14px]">← 처음으로</Link>
      <h1 className="mt-6 text-[24px] font-bold">체험자 로그인</h1>
      <p className="mt-2 text-[14px] text-muted">CATCHPASS 등급으로 체험권을 받아보세요.</p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="이메일" className="w-full h-14 px-4 rounded-md border border-hairline focus:border-ink focus:outline-none text-[15px]" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="비밀번호" className="w-full h-14 px-4 rounded-md border border-hairline focus:border-ink focus:outline-none text-[15px]" />
        {err && <div className="text-error text-[14px]">{err}</div>}
        <button disabled={loading} type="submit" className="w-full h-14 rounded-full bg-ink text-white text-[16px] font-bold disabled:opacity-50">{loading ? "로그인 중..." : "로그인"}</button>
      </form>

      <div className="mt-6 text-center text-[14px] text-muted">
        처음이신가요? <Link href="/r/signup" className="text-ink font-medium underline">가입하기</Link>
      </div>
    </main>
  );
}
