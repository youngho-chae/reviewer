"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SnsKind } from "@/lib/types";

const CHANNELS: { kind: SnsKind; label: string; placeholder: string; metric: string }[] = [
  { kind: "naver_blog", label: "네이버 블로그", placeholder: "https://blog.naver.com/...", metric: "일방문자" },
  { kind: "instagram", label: "인스타그램", placeholder: "https://instagram.com/...", metric: "팔로워" },
  { kind: "youtube", label: "유튜브", placeholder: "https://youtube.com/@...", metric: "구독자" },
  { kind: "tiktok", label: "틱톡", placeholder: "https://tiktok.com/@...", metric: "팔로워" },
];

export default function ReviewerSignup() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [sns, setSns] = useState<Record<SnsKind, { url: string; influence: string }>>({
    naver_blog: { url: "", influence: "" },
    instagram: { url: "", influence: "" },
    youtube: { url: "", influence: "" },
    tiktok: { url: "", influence: "" },
  });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(skipSns: boolean = false) {
    setLoading(true); setErr(null);
    const snsArr = skipSns ? [] : CHANNELS
      .filter((c) => sns[c.kind].url.trim())
      .map((c) => ({ kind: c.kind, url: sns[c.kind].url.trim(), influence: Number(sns[c.kind].influence) || 0 }));
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "reviewer", email, password, nickname, sns: snsArr }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      setErr(error || "가입 실패");
      setLoading(false);
      return;
    }
    router.push("/r/home");
    router.refresh();
  }

  function next() {
    setErr(null);
    if (!email || !password || !nickname) { setErr("모든 항목을 입력해주세요"); return; }
    if (password.length < 6) { setErr("비밀번호는 6자 이상"); return; }
    setStep(2);
  }

  return (
    <main className="mobile-shell px-6 pt-14 pb-10">
      <Link href="/r/login" className="text-muted text-[14px]">← 로그인으로</Link>
      <div className="mt-4 text-[12px] text-muted">{step}/2 단계</div>

      {step === 1 && (
        <>
          <h1 className="mt-2 text-[24px] font-bold">체험자 가입</h1>
          <div className="mt-8 space-y-3">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="이메일" className="w-full h-14 px-4 rounded-sm border border-hairline focus:border-ink focus:outline-none text-[16px]" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="비밀번호 (6자 이상)" className="w-full h-14 px-4 rounded-sm border border-hairline focus:border-ink focus:outline-none text-[16px]" />
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="닉네임" className="w-full h-14 px-4 rounded-sm border border-hairline focus:border-ink focus:outline-none text-[16px]" />
            {err && <div className="text-error text-[14px]">{err}</div>}
            <button onClick={next} className="w-full h-14 rounded-sm bg-brand text-white text-[16px] font-medium">다음</button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="mt-2 text-[24px] font-bold">SNS 채널 연동</h1>
          <p className="mt-2 text-[14px] text-muted">최소 1개 연동 시 영향력 수치로 초기 등급(C/B/A)이 자동 산정됩니다.</p>

          <div className="mt-6 space-y-4">
            {CHANNELS.map((c) => (
              <div key={c.kind} className="rounded-md border border-hairline p-3">
                <div className="text-[14px] font-semibold mb-2">{c.label}</div>
                <input
                  value={sns[c.kind].url}
                  onChange={(e) => setSns({ ...sns, [c.kind]: { ...sns[c.kind], url: e.target.value } })}
                  placeholder={c.placeholder}
                  className="w-full h-11 px-3 rounded-sm border border-hairline focus:border-ink focus:outline-none text-[14px]"
                />
                <input
                  value={sns[c.kind].influence}
                  onChange={(e) => setSns({ ...sns, [c.kind]: { ...sns[c.kind], influence: e.target.value.replace(/\D/g, "") } })}
                  placeholder={`${c.metric} 수 (숫자만)`}
                  inputMode="numeric"
                  className="w-full h-11 px-3 mt-2 rounded-sm border border-hairline focus:border-ink focus:outline-none text-[14px]"
                />
              </div>
            ))}
          </div>

          {err && <div className="text-error text-[14px] mt-3">{err}</div>}

          <div className="mt-6 space-y-2">
            <button disabled={loading} onClick={() => submit(false)} className="w-full h-14 rounded-sm bg-brand text-white text-[16px] font-medium disabled:opacity-50">{loading ? "처리 중..." : "연동 후 시작하기"}</button>
            <button disabled={loading} onClick={() => submit(true)} className="w-full h-12 text-muted text-[14px] underline">연동 없이 시작하기 (N등급으로 시작)</button>
          </div>
        </>
      )}
    </main>
  );
}
