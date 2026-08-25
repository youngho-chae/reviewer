"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// 이메일·닉네임 중복 인라인 확인 (2026-08-18) — 입력 후 500ms 디바운스로
// /api/auth/check-availability 조회. 최종 판정은 signup API 409(정본) — 폼 확인은 UX 보조.
type DupStatus = "idle" | "checking" | "ok" | "taken";
function useAvailability(field: "email" | "nickname", value: string, enabled: boolean): DupStatus {
  const [status, setStatus] = useState<DupStatus>("idle");
  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }
    setStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/auth/check-availability", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ field, value: value.trim() }),
        });
        if (!res.ok) throw new Error();
        const j = await res.json();
        setStatus(j.available ? "ok" : "taken");
      } catch {
        setStatus("idle"); // 조회 실패 — 서버 최종 검증(409)에 위임
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [field, value, enabled]);
  return status;
}

// 체험자 가입 (2026-07-23 개편)
//  step 0: 시작 — 간편로그인(네이버·카카오) 또는 이메일 가입
//  step 1: 휴대폰 인증 (필수 — 휴대폰 번호 = 계정 PK, 인증번호 일치 시에만 진행)
//  step 2: 계정 정보 (소셜 경유면 비밀번호 없음·닉네임/이메일 프리필) + 약관 동의
//  완료: SNS 자기신고 입력은 폐지 — 채널 관리(/r/me/channels)로 이동해 연동·본인 인증을 유도한다.
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
  // 간편로그인 콜백 경유 — 신원은 httpOnly 증빙 쿠키, 프리필(닉네임·이메일)만 쿼리로 전달
  const socialProvider = sp.get("social") === "naver" || sp.get("social") === "kakao" ? sp.get("social")! : null;
  const socialLabel = socialProvider === "kakao" ? "카카오" : "네이버";

  const [step, setStep] = useState<0 | 1 | 2>(socialProvider ? 1 : 0);
  // 휴대폰 인증
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  // 계정 정보
  const [email, setEmail] = useState(sp.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState(sp.get("nick") ?? "");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 중복 인라인 확인 — 이메일은 형식이 갖춰졌을 때, 닉네임은 2자 이상일 때 조회
  const emailValid = /\S+@\S+\.\S+/.test(email.trim());
  const emailStatus = useAvailability("email", email, step === 2 && emailValid);
  const nickStatus = useAvailability("nickname", nickname, step === 2 && nickname.trim().length >= 2);

  async function sendOtp() {
    setLoading(true);
    setErr(null);
    setDemoCode(null);
    const res = await fetch("/api/auth/phone/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const j = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setErr(j.error || "인증번호 발송에 실패했어요");
      return;
    }
    setOtpSent(true);
    setOtp("");
    if (j.demo && j.code) setDemoCode(j.code); // SMS 키 미설정 — 데모 모드 배너로 코드 노출
  }

  async function verifyOtp() {
    setLoading(true);
    setErr(null);
    const res = await fetch("/api/auth/phone/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, code: otp }),
    });
    const j = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setErr(j.error || "인증에 실패했어요");
      return;
    }
    setStep(2);
  }

  async function submit() {
    setErr(null);
    if (!nickname.trim()) {
      setErr("닉네임을 입력해주세요");
      return;
    }
    if (!socialProvider) {
      if (!email || !password) {
        setErr("이메일과 비밀번호를 입력해주세요");
        return;
      }
      if (password.length < 6) {
        setErr("비밀번호는 6자 이상이어야 해요");
        return;
      }
    }
    if (email.trim() && emailStatus === "taken") {
      setErr("이미 가입된 이메일이에요 — 로그인하거나 다른 이메일을 사용해주세요");
      return;
    }
    if (nickStatus === "taken") {
      setErr("이미 사용 중인 닉네임이에요 — 다른 닉네임을 입력해주세요");
      return;
    }
    if (!agreeTerms || !agreePrivacy) {
      setErr("이용약관과 개인정보 수집·이용에 동의해주세요");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role: "reviewer",
        phone,
        nickname: nickname.trim(),
        agreeTerms: agreeTerms && agreePrivacy,
        ...(socialProvider ? { social: true, email: email.trim() || undefined } : { email, password }),
      }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "가입 실패");
      setLoading(false);
      return;
    }
    // 가입 완료 — SNS 채널 연동·본인 인증으로 유도 (초대 경유면 웰컴 박스 우선)
    if (inviteToken) {
      router.push(`/welcome/box?token=${encodeURIComponent(inviteToken)}`);
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
          {/* 간편로그인 — 기존 계정이면 즉시 로그인, 처음이면 휴대폰 인증 후 가입으로 이어진다 */}
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

  return (
    <main className="mobile-shell px-6 pt-12 pb-10 bg-canvas min-h-[100dvh]">
      <button
        onClick={() => {
          setErr(null);
          if (step === 2) setStep(1);
          else if (!socialProvider) setStep(0);
          else router.push("/r/signup");
        }}
        className="text-brand text-[14px]"
      >
        ← 이전
      </button>
      <div className="mt-4 text-[12px] text-muted">{step} / 2</div>

      {socialProvider && (
        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-brandSoft text-brand text-[13px] font-semibold">
          {socialLabel} 계정으로 가입 중
        </div>
      )}

      {/* ── step 1: 휴대폰 인증 (필수 — 번호당 계정 1개) ── */}
      {step === 1 && (
        <>
          <h1 className="mt-2 text-[20px] font-bold tracking-title text-ink">휴대폰 인증</h1>
          <p className="mt-3 text-[16px] text-ink2 leading-[1.5]">
            휴대폰 번호로 본인을 확인해요.
            <br />
            번호 하나당 계정 하나만 만들 수 있어요.
          </p>
          <div className="mt-8 space-y-3">
            <div className="flex gap-2">
              <input
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 11));
                  setOtpSent(false);
                  setDemoCode(null);
                }}
                inputMode="numeric"
                placeholder="휴대폰 번호 (숫자만)"
                className="flex-1 h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[16px] tabular-nums"
              />
              <button
                onClick={sendOtp}
                disabled={loading || phone.length < 10}
                className="cp-action shrink-0 h-12 px-4 rounded-md bg-ink text-white text-[14px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
              >
                {loading && !otpSent ? "발송 중..." : otpSent ? "재발송" : "인증번호 받기"}
              </button>
            </div>

            {otpSent && (
              <>
                {demoCode && (
                  <div className="rounded-md bg-warningSoft px-4 py-3 text-[13px] text-ink2 leading-[1.55]">
                    <b>데모 모드</b> — SMS 키가 설정되지 않아 실제 문자는 발송되지 않아요. 인증번호:{" "}
                    <b className="tabular-nums text-[15px]">{demoCode}</b>
                  </div>
                )}
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  placeholder="인증번호 6자리"
                  className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[18px] tracking-[0.3em] text-center tabular-nums"
                />
                <p className="text-[12px] text-muted">인증번호는 5분간 유효해요 · 오지 않으면 [재발송]을 눌러주세요.</p>
              </>
            )}

            {err && <div className="text-error text-[14px]">{err}</div>}
            <button
              onClick={verifyOtp}
              disabled={loading || !otpSent || otp.length !== 6}
              className="cp-action w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
            >
              {loading && otpSent ? "확인 중..." : "인증하고 다음"}
            </button>
          </div>
        </>
      )}

      {/* ── step 2: 계정 정보 + 약관 ── */}
      {step === 2 && (
        <>
          <h1 className="mt-2 text-[20px] font-bold tracking-title text-ink">계정 만들기</h1>
          <p className="mt-3 text-[16px] text-ink2 leading-[1.5]">
            {socialProvider
              ? `${socialLabel} 계정으로 로그인하게 돼요 — 닉네임만 정하면 끝!`
              : "이메일과 닉네임만 있으면 바로 시작할 수 있어요."}
          </p>
          <div className="mt-8 space-y-3">
            <div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder={socialProvider ? "이메일 (선택 — 소셜 계정 이메일 사용)" : "이메일"}
                className={`w-full h-12 px-4 rounded-md border focus:outline-none text-[16px] ${
                  emailStatus === "taken" ? "border-error" : "border-hairline focus:border-brand"
                }`}
              />
              {emailStatus === "taken" && (
                <p className="mt-1 text-[12px] text-error">이미 가입된 이메일이에요 — 로그인하거나 다른 이메일을 사용해주세요.</p>
              )}
              {emailStatus === "ok" && <p className="mt-1 text-[12px] text-successStrong">사용할 수 있는 이메일이에요.</p>}
            </div>
            {!socialProvider && (
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="비밀번호 (6자 이상)"
                className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[16px]"
              />
            )}
            <div>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="닉네임"
                className={`w-full h-12 px-4 rounded-md border focus:outline-none text-[16px] ${
                  nickStatus === "taken" ? "border-error" : "border-hairline focus:border-brand"
                }`}
              />
              {nickStatus === "taken" && (
                <p className="mt-1 text-[12px] text-error">이미 사용 중인 닉네임이에요 — 다른 닉네임을 입력해주세요.</p>
              )}
              {nickStatus === "ok" && <p className="mt-1 text-[12px] text-successStrong">사용할 수 있는 닉네임이에요.</p>}
            </div>

            {/* 필수 동의 — 약관/개인정보 (개인정보보호법상 명시적 동의) */}
            <div className="pt-2 space-y-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="mt-0.5 w-4.5 h-4.5 accent-[#9333EA]" />
                <span className="text-[13px] text-ink2 leading-[1.45]">
                  (필수) <a href="/legal/terms" target="_blank" className="text-brand underline">이용약관</a>에 동의합니다
                </span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} className="mt-0.5 w-4.5 h-4.5 accent-[#9333EA]" />
                <span className="text-[13px] text-ink2 leading-[1.45]">
                  (필수) <a href="/legal/privacy" target="_blank" className="text-brand underline">개인정보 수집·이용</a>에 동의합니다
                </span>
              </label>
            </div>

            {err && <div className="text-error text-[14px]">{err}</div>}
            <button
              disabled={loading}
              onClick={submit}
              className="cp-action w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:opacity-50"
            >
              {loading ? "처리 중..." : "가입하고 시작하기"}
            </button>
            <p className="text-[12px] text-muted leading-[1.5] text-center">
              가입 후 SNS 채널을 연동·인증하면 등급이 산정되고 지원 금액이 올라가요.
            </p>
          </div>
        </>
      )}
    </main>
  );
}
