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
  const [step, setStep] = useState<0 | 1 | 2>(0);
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

  // Step 0 — Hero onboarding (V3 dark)
  if (step === 0) {
    return (
      <main className="mobile-shell flex flex-col min-h-[100dvh] bg-ink text-white">
        <div className="flex-1 px-7 pt-20 pb-8 flex flex-col justify-center">
          <div className="text-[14px] font-bold text-brand tracking-wider">CATCHPASS</div>
          <h1 className="mt-3.5 text-[40px] font-extrabold leading-[1.15] tracking-tight">
            선정 기다리는<br />체험단 말고,<br />
            <span className="text-brand">등급으로 받는<br />체험권.</span>
          </h1>
          <p className="mt-5 text-[16px] text-white/70 leading-relaxed">
            체험단 티 내지 않고, 사장님 눈치 보지 않고. 평소처럼 이용하고 리뷰로 인증하세요.
          </p>
        </div>
        <div className="px-7 pb-10">
          <button
            onClick={() => setStep(1)}
            className="w-full h-14 rounded-full bg-brand text-brandInk text-[16px] font-bold"
          >
            시작하기
          </button>
          <div className="text-center mt-3.5">
            <span className="text-[13px] text-white/55">이미 계정이 있어요 </span>
            <Link href="/r/login" className="text-[13px] font-semibold underline">로그인</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mobile-shell px-6 pt-12 pb-10">
      <button onClick={() => setStep(step === 2 ? 1 : 0)} className="text-muted text-[14px]">← 이전</button>
      <div className="mt-4 text-[12px] text-muted">{step} / 2</div>

      {step === 1 && (
        <>
          <h1 className="mt-2 text-[26px] font-extrabold tracking-tight">계정 만들기</h1>
          <p className="mt-2 text-[14px] text-muted">이메일과 닉네임만 있으면 바로 시작할 수 있어요.</p>
          <div className="mt-7 space-y-3">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="이메일" className="w-full h-14 px-4 rounded-md border border-hairline focus:border-ink focus:outline-none text-[15px]" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="비밀번호 (6자 이상)" className="w-full h-14 px-4 rounded-md border border-hairline focus:border-ink focus:outline-none text-[15px]" />
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="닉네임" className="w-full h-14 px-4 rounded-md border border-hairline focus:border-ink focus:outline-none text-[15px]" />
            {err && <div className="text-error text-[14px]">{err}</div>}
            <button onClick={next} className="w-full h-14 rounded-full bg-ink text-white text-[16px] font-bold">다음</button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="mt-2 text-[26px] font-extrabold tracking-tight">SNS 채널을 연동해 주세요</h1>
          <p className="mt-2 text-[14px] text-muted leading-relaxed">캐치랭크는 채널 영향력을 분석해 등급을 산정합니다. 1개 이상 연동을 권장합니다.</p>

          <div className="mt-6 space-y-2.5">
            {CHANNELS.map((c) => {
              const on = !!sns[c.kind].url.trim();
              return (
                <div key={c.kind} className={`rounded-md border-[1.5px] p-4 ${on ? "border-ink bg-surfaceSoft" : "border-hairline"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-[15px] font-bold">{c.label}</div>
                      <div className="text-[12px] text-muted mt-0.5">{c.metric} 수치 기반 분석</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center ${on ? "bg-ink border-ink" : "border-hairline"}`}>
                      {on && <span className="text-white text-[10px] font-bold">✓</span>}
                    </div>
                  </div>
                  <input
                    value={sns[c.kind].url}
                    onChange={(e) => setSns({ ...sns, [c.kind]: { ...sns[c.kind], url: e.target.value } })}
                    placeholder={c.placeholder}
                    className="w-full h-11 px-3 rounded-sm border border-hairline focus:border-ink focus:outline-none text-[13px]"
                  />
                  <input
                    value={sns[c.kind].influence}
                    onChange={(e) => setSns({ ...sns, [c.kind]: { ...sns[c.kind], influence: e.target.value.replace(/\D/g, "") } })}
                    placeholder={`${c.metric} 수 (숫자만)`}
                    inputMode="numeric"
                    className="w-full h-11 px-3 mt-2 rounded-sm border border-hairline focus:border-ink focus:outline-none text-[13px]"
                  />
                </div>
              );
            })}
          </div>

          {err && <div className="text-error text-[14px] mt-3">{err}</div>}

          <div className="mt-6 space-y-2">
            <button disabled={loading} onClick={() => submit(false)} className="w-full h-14 rounded-full bg-ink text-white text-[16px] font-bold disabled:opacity-50">{loading ? "처리 중..." : "연동 후 시작하기"}</button>
            <button disabled={loading} onClick={() => submit(true)} className="w-full h-12 text-muted text-[13px] underline">연동 없이 시작하기 (N등급으로 시작)</button>
          </div>
        </>
      )}
    </main>
  );
}
