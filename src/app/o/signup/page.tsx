"use client";
import { Suspense, useState } from "react";
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
  type AgreeState,
  type EmailStatus,
} from "@/components/signup/SignupFields";

// 사장님 가입 (2026-08-18 와이어프레임 개편 · 2차: 매장·사업자 항목 제외) — 체험자와 동일 골격:
//  이메일(중복 확인)·비밀번호/재입력(표시 토글)·휴대전화 인라인 인증(Owner.phone)·
//  추천인 코드·전체 동의(만 14세/약관/개인정보 필수 + 마케팅 선택) → [회원가입].
//  상호·사업자등록번호는 가입 직후 인증 대기 화면에서 제출(수기 인증 절차 유지 — 확정 정책 9),
//  매장 등록은 캠페인 생성의 [URL로 매장정보 불러오기]로.
export default function OwnerSignupPage() {
  return (
    <Suspense fallback={null}>
      <OwnerSignup />
    </Suspense>
  );
}

function OwnerSignup() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [referral, setReferral] = useState(sp.get("invite")?.trim() ?? "");
  const [agree, setAgree] = useState<AgreeState>(AGREE_INIT);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setErr(null);
    if (!email.trim() || !password) return setErr("필수 항목을 모두 입력해주세요");
    if (emailStatus === "taken") return setErr("이미 가입된 이메일이에요 — 다른 이메일을 사용해주세요");
    const pwErr = validatePassword(password);
    if (pwErr) return setErr(pwErr);
    if (password !== password2) return setErr("비밀번호가 일치하지 않아요 — 다시 확인해주세요");
    if (!verifiedPhone) return setErr("휴대전화 번호 인증을 완료해주세요");
    if (!agree.age || !agree.terms || !agree.privacy) return setErr("필수 항목에 모두 동의해주세요");

    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role: "owner",
        email: email.trim(),
        password,
        phone: verifiedPhone,
        agreeTerms: agree.terms && agree.privacy,
        agreeAge: agree.age,
        agreeMarketing: agree.marketing,
      }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "가입 실패");
      setLoading(false);
      return;
    }
    if (referral) {
      router.push(`/welcome/box?token=${encodeURIComponent(referral)}`);
    } else {
      router.push("/o/home");
    }
    router.refresh();
  }

  return (
    <main className="mobile-shell bg-canvas min-h-[100dvh] pb-10">
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-3 grid grid-cols-[40px_1fr_40px] items-center">
          <Link href="/o/login" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="로그인으로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
          <h1 className="text-[16px] font-bold text-ink tracking-title text-center">회원가입</h1>
          <span />
        </div>
      </div>

      <div className="px-6 pt-4 space-y-7">
        <EmailDupField role="owner" email={email} onChange={setEmail} status={emailStatus} onStatus={setEmailStatus} />

        <PasswordPair pw={password} pw2={password2} onPw={setPassword} onPw2={setPassword2} />

        <PhoneVerifyField role="owner" verifiedPhone={verifiedPhone} onVerified={setVerifiedPhone} />

        {/* 사업자 인증(확정 정책 9)은 가입 후 대기 화면에서 상호·사업자번호 제출로 진행 */}
        <p className="!mt-4 text-[12px] text-muted leading-[1.5]">
          가입 후 <span className="text-ink font-medium">상호·사업자등록번호를 제출</span>하면 운영팀이 확인해요 — 영업일 기준 2~3일
          이내 인증 완료 후 사장님 기능을 이용할 수 있습니다.
        </p>

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
      </div>
    </main>
  );
}
