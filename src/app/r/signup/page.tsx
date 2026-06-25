"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SnsKind } from "@/lib/types";

const CHANNELS: { kind: SnsKind; label: string; placeholder: string; metric: string }[] = [
  { kind: "naver_blog", label: "네이버 블로그", placeholder: "https://blog.naver.com/...", metric: "일방문자" },
  { kind: "instagram", label: "인스타그램", placeholder: "https://instagram.com/...", metric: "팔로워" },
  { kind: "youtube", label: "유튜브", placeholder: "https://youtube.com/@...", metric: "구독자" },
  { kind: "tiktok", label: "틱톡", placeholder: "https://tiktok.com/@...", metric: "팔로워" },
];

export default function ReviewerSignupPage() {
  return (
    <Suspense fallback={null}>
      <ReviewerSignup />
    </Suspense>
  );
}

function ReviewerSignup() {
  const router = useRouter();
  const sp = useSearchParams();
  const inviteToken = sp.get("invite")?.trim() || null;
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
    if (inviteToken) {
      router.push(`/welcome/box?token=${encodeURIComponent(inviteToken)}`);
    } else {
      router.push("/r/home");
    }
    router.refresh();
  }

  function next() {
    setErr(null);
    if (!email || !password || !nickname) { setErr("모든 항목을 입력해주세요"); return; }
    if (password.length < 6) { setErr("비밀번호는 6자 이상"); return; }
    setStep(2);
  }

  // Step 0 — Apple-style hero (light canvas, display-lg headline, blue pill CTA)
  if (step === 0) {
    return (
      <main className="mobile-shell bg-canvas min-h-[100dvh] flex flex-col">
        <div className="flex-1 flex flex-col justify-center px-7 py-16">
          <div className="text-[12px] tracking-[0.18em] text-muted uppercase mb-5">CATCHPASS</div>
          <h1 className="font-display text-[40px] leading-[1.07] text-ink">
            선정 기다리는<br />체험단 말고,<br />등급으로 받는<br />체험권.
          </h1>
          <p className="mt-5 text-[19px] leading-[1.4] text-ink2 max-w-[300px]">
            평소처럼 이용하고 리뷰로 인증하세요.
          </p>
        </div>
        <div className="px-7 pb-10">
          <button
            onClick={() => setStep(1)}
            className="w-full h-12 rounded-pill bg-brand text-white text-[17px] font-normal"
          >
            시작하기
          </button>
          <div className="text-center mt-4">
            <span className="text-[14px] text-muted">이미 계정이 있어요 </span>
            <Link href="/r/login" className="text-[14px] text-brand">로그인</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mobile-shell px-6 pt-12 pb-10 bg-canvas">
      <button onClick={() => setStep(step === 2 ? 1 : 0)} className="text-brand text-[14px]">← 이전</button>
      <div className="mt-4 text-[12px] text-muted">{step} / 2</div>

      {step === 1 && (
        <>
          <h1 className="mt-2 font-display text-[34px] leading-[1.1] text-ink">계정 만들기</h1>
          <p className="mt-3 text-[17px] text-ink2 leading-[1.4]">이메일과 닉네임만 있으면 바로 시작할 수 있어요.</p>
          <div className="mt-8 space-y-3">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="이메일" className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[17px]" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="비밀번호 (6자 이상)" className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[17px]" />
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="닉네임" className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[17px]" />
            {err && <div className="text-error text-[14px]">{err}</div>}
            <button onClick={next} className="w-full h-12 rounded-pill bg-brand text-white text-[17px] font-normal">다음</button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="mt-2 font-display text-[34px] leading-[1.1] text-ink">SNS 채널 연동</h1>
          <p className="mt-3 text-[17px] text-ink2 leading-[1.4]">채널 영향력을 분석해 등급을 산정합니다. 1개 이상 연동을 권장합니다.</p>

          <div className="mt-6 space-y-2">
            {CHANNELS.map((c) => {
              const on = !!sns[c.kind].url.trim();
              return (
                <div key={c.kind} className={`rounded-lg border p-5 ${on ? "border-brand" : "border-hairline"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-[17px] font-semibold text-ink">{c.label}</div>
                      <div className="text-[14px] text-muted mt-0.5">{c.metric} 수치 기반 분석</div>
                    </div>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${on ? "bg-brand" : "border border-hairline"}`}>
                      {on && <span className="text-white text-[11px] font-semibold">✓</span>}
                    </div>
                  </div>
                  <input
                    value={sns[c.kind].url}
                    onChange={(e) => setSns({ ...sns, [c.kind]: { ...sns[c.kind], url: e.target.value } })}
                    placeholder={c.placeholder}
                    className="w-full h-11 px-3 rounded-sm border border-hairline focus:border-brand focus:outline-none text-[14px]"
                  />
                  <input
                    value={sns[c.kind].influence}
                    onChange={(e) => setSns({ ...sns, [c.kind]: { ...sns[c.kind], influence: e.target.value.replace(/\D/g, "") } })}
                    placeholder={`${c.metric} 수 (숫자만)`}
                    inputMode="numeric"
                    className="w-full h-11 px-3 mt-2 rounded-sm border border-hairline focus:border-brand focus:outline-none text-[14px]"
                  />
                </div>
              );
            })}
          </div>

          {err && <div className="text-error text-[14px] mt-3">{err}</div>}

          <div className="mt-6 space-y-2">
            <button disabled={loading} onClick={() => submit(false)} className="w-full h-12 rounded-pill bg-brand text-white text-[17px] font-normal disabled:opacity-50">{loading ? "처리 중..." : "연동 후 시작하기"}</button>
            <button disabled={loading} onClick={() => submit(true)} className="w-full h-12 text-brand text-[15px]">연동 없이 시작 (N등급)</button>
          </div>
        </>
      )}
    </main>
  );
}
