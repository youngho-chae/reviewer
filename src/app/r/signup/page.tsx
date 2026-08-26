"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import { validatePassword } from "@/lib/password";
import {
  EmailDupField,
  PasswordPair,
  PhoneVerifyField,
  ReferralField,
  AgreeGroup,
  AGREE_INIT,
  FIELD_LABEL,
  Required,
  type AgreeState,
  type EmailStatus,
} from "@/components/signup/SignupFields";

// 체험자 가입 (2026-08-18 와이어프레임 개편 — 구 3스텝을 시작 화면 + 단일 폼으로)
//  step 0: 시작 — 간편로그인(네이버·카카오) 또는 이메일 가입 (기존 유지)
//  본 폼 : 이메일(중복 확인)·비밀번호/재입력(표시 토글)·닉네임(중복확인)·
//          휴대전화 인라인 인증·추천인 코드(초대 토큰 — ?invite 프리필)·
//          전체 동의(만 14세/약관/개인정보 필수 + 마케팅 선택) → [회원가입]
//  소셜 경유는 비밀번호 섹션 없음 (이메일·닉네임 프리필)
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
  const socialProvider = sp.get("social") === "naver" || sp.get("social") === "kakao" ? sp.get("social")! : null;
  const socialLabel = socialProvider === "kakao" ? "카카오" : "네이버";

  const [step, setStep] = useState<0 | 1>(socialProvider ? 1 : 0);
  const [email, setEmail] = useState(sp.get("email") ?? "");
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [nickname, setNickname] = useState(sp.get("nick") ?? "");
  const [nickStatus, setNickStatus] = useState<"idle" | "checking" | "ok" | "taken">("idle");
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [referral, setReferral] = useState(sp.get("invite")?.trim() ?? "");
  const [agree, setAgree] = useState<AgreeState>(AGREE_INIT);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 닉네임 중복확인 — 500ms 디바운스 (가입과 회원 정보 수정이 공유하는 check-availability)
  useEffect(() => {
    if (nickname.trim().length < 2) {
      setNickStatus("idle");
      return;
    }
    setNickStatus("checking");
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/auth/check-availability", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ field: "nickname", value: nickname.trim() }),
        });
        if (!res.ok) throw new Error();
        setNickStatus((await res.json()).available ? "ok" : "taken");
      } catch {
        setNickStatus("idle");
      }
    }, 500);
    return () => clearTimeout(t);
  }, [nickname]);

  async function submit() {
    setErr(null);
    if (!socialProvider) {
      if (!email.trim() || !password) return setErr("이메일과 비밀번호를 입력해주세요");
      if (emailStatus === "taken") return setErr("이미 가입된 이메일이에요 — 다른 이메일을 사용해주세요");
      const pwErr = validatePassword(password);
      if (pwErr) return setErr(pwErr);
      if (password !== password2) return setErr("비밀번호가 일치하지 않아요 — 다시 확인해주세요");
    }
    if (!nickname.trim()) return setErr("닉네임을 입력해주세요");
    if (nickStatus === "taken") return setErr("이미 사용 중인 닉네임이에요 — 다른 닉네임을 입력해주세요");
    if (!verifiedPhone) return setErr("휴대전화 번호 인증을 완료해주세요");
    if (!agree.age || !agree.terms || !agree.privacy) return setErr("필수 항목에 모두 동의해주세요");

    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role: "reviewer",
        phone: verifiedPhone,
        nickname: nickname.trim(),
        agreeTerms: agree.terms && agree.privacy,
        agreeAge: agree.age,
        agreeMarketing: agree.marketing,
        ...(socialProvider ? { social: true, email: email.trim() || undefined } : { email: email.trim(), password }),
      }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "가입 실패");
      setLoading(false);
      return;
    }
    // 가입 완료 — 추천인 코드가 있으면 웰컴 박스, 아니면 채널 연동 유도
    if (referral) {
      router.push(`/welcome/box?token=${encodeURIComponent(referral)}`);
    } else {
      router.push("/r/me/channels?welcome=1");
    }
    router.refresh();
  }

  // ── step 0: 시작 — 간편로그인 또는 이메일 가입 ──
  if (step === 0) {
    return (
      <main className="mobile-shell bg-canvas min-h-[100dvh] flex flex-col">
        <div className="flex-1 flex flex-col justify-center px-7 py-16">
          <div className="text-[12px] tracking-[0.18em] text-muted uppercase mb-5">CATCHPASS</div>
          <h1 className="text-[22px] font-bold tracking-title leading-[1.3] text-ink">
            선정 기다리는<br />체험단 말고,<br />등급으로 받는<br />체험권.
          </h1>
          <p className="mt-5 text-[19px] leading-[1.4] text-ink2 max-w-[300px]">
            평소처럼 이용하고 리뷰로 인증하세요.
          </p>
        </div>
        <div className="px-7 pb-10 space-y-2">
          {/* 간편로그인 — 기존 계정이면 즉시 로그인, 처음이면 가입 폼으로 이어진다 */}
          <a href="/api/auth/social/naver/start" className="cp-action flex w-full h-[52px] items-center justify-center rounded-md bg-[#03C75A] text-white text-[16px] font-bold">
            네이버로 시작하기
          </a>
          <a href="/api/auth/social/kakao/start" className="cp-action flex w-full h-[52px] items-center justify-center rounded-md bg-[#FEE500] text-[#191919] text-[16px] font-bold">
            카카오로 시작하기
          </a>
          <button
            onClick={() => setStep(1)}
            className="cp-action w-full h-[52px] rounded-md border border-hairline bg-canvas text-ink text-[16px] font-bold"
          >
            이메일로 가입하기
          </button>
          <div className="text-center pt-2">
            <span className="text-[14px] text-muted">이미 계정이 있어요 </span>
            <Link href="/r/login" className="text-[14px] text-brand">로그인</Link>
          </div>
        </div>
      </main>
    );
  }

  // ── 본 폼: 회원가입 (와이어프레임 단일 화면) ──
  return (
    <main className="mobile-shell bg-canvas min-h-[100dvh] pb-10">
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-3 grid grid-cols-[40px_1fr_40px] items-center">
          <button
            type="button"
            onClick={() => (socialProvider ? router.push("/r/signup") : setStep(0))}
            aria-label="이전"
            className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink"
          >
            <Icon name="chevron-left" variant="border" size={22} />
          </button>
          <h1 className="text-[16px] font-bold text-ink tracking-title text-center">회원가입</h1>
          <span />
        </div>
      </div>

      <div className="px-6 pt-4 space-y-7">
        {socialProvider && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-brandSoft text-brand text-[13px] font-semibold">
            {socialLabel} 계정으로 가입 중 — 비밀번호 없이 간편로그인으로 이용해요
          </div>
        )}

        <EmailDupField
          role="reviewer"
          email={email}
          onChange={setEmail}
          status={emailStatus}
          onStatus={setEmailStatus}
          placeholder={socialProvider ? "이메일 (선택 — 소셜 계정 이메일 사용)" : "이메일을 입력해 주세요."}
        />

        {!socialProvider && <PasswordPair pw={password} pw2={password2} onPw={setPassword} onPw2={setPassword2} />}

        {/* 닉네임 — 익명 리뷰 원칙상 실명(이름) 대신 표시명 수집 (중복확인) */}
        <div>
          <div className={FIELD_LABEL}>
            닉네임
            <Required />
          </div>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="닉네임을 입력해 주세요."
            className={`mt-2 w-full h-12 px-4 rounded-md border focus:outline-none text-[16px] ${
              nickStatus === "taken" ? "border-error" : "border-hairline focus:border-brand"
            }`}
          />
          {nickStatus === "taken" && (
            <p className="mt-1.5 text-[12px] text-error">이미 사용 중인 닉네임이에요 — 다른 닉네임을 입력해주세요.</p>
          )}
          {nickStatus === "ok" && <p className="mt-1.5 text-[12px] text-successStrong">사용할 수 있는 닉네임이에요.</p>}
        </div>

        <PhoneVerifyField role="reviewer" verifiedPhone={verifiedPhone} onVerified={setVerifiedPhone} />

        <ReferralField code={referral} onChange={setReferral} />

        <AgreeGroup value={agree} onChange={setAgree} />

        {err && <p className="text-[14px] text-error">{err}</p>}
        <button
          type="button"
          disabled={loading}
          onClick={submit}
          className="cp-action w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:opacity-50"
        >
          {loading ? "처리 중..." : "회원가입"}
        </button>
        <p className="text-[12px] text-muted leading-[1.5] text-center !mt-3">
          가입 후 SNS 채널을 연동·인증하면 등급이 산정되고 지원 금액이 올라가요.
        </p>
      </div>
    </main>
  );
}
