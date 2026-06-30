"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@catchrank.co.kr");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "admin", email, password }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "로그인 실패");
      setBusy(false);
      return;
    }
    router.push("/admin/reviews");
    router.refresh();
  }

  return (
    <main className="mobile-shell min-h-[100dvh] bg-canvas flex flex-col justify-center px-7">
      <div className="text-[12px] uppercase tracking-[0.18em] text-muted">CATCHPASS</div>
      <h1 className="font-display text-[34px] leading-[1.1] text-ink mt-1">운영팀 검수 콘솔</h1>
      <p className="text-[14px] text-muted mt-2">제출된 후기를 통과/반려 처리합니다.</p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="운영팀 이메일"
          className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px]"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="비밀번호"
          className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px]"
        />
        {err && <div className="text-error text-[13px]">{err}</div>}
        <button
          type="submit"
          disabled={busy || !email || !password}
          className="w-full h-12 rounded-pill bg-ink text-white text-[16px] font-semibold disabled:opacity-50"
        >
          {busy ? "로그인 중..." : "로그인"}
        </button>
      </form>
      <p className="mt-4 text-[12px] text-muted">데모 계정: admin@catchrank.co.kr / demo1234</p>
    </main>
  );
}
