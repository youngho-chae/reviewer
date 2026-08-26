"use client";
import { useState } from "react";
import Icon from "@/components/Icon";
import { validatePassword, PASSWORD_RULE_TEXT } from "@/lib/password";

// 회원가입 공용 필드 (2026-08-18 와이어프레임 개편) — 체험자/사장님 가입 폼이 공유.
//  · EmailDupField  : 이메일 + [중복 확인] 버튼 (role별 풀 — check-availability)
//  · PasswordPair   : 비밀번호/재입력 2회 + 표시 토글(eye) + 규칙 안내
//  · PhoneVerifyField: 휴대전화 번호 + [인증번호 전송] → 인증번호 + [인증하기] (인라인)
//  · ReferralField  : 추천인 코드 (선택 — 초대 토큰, ?invite 프리필)
//  · AgreeGroup     : 전체 동의 + [필수] 만 14세/이용약관/개인정보 + [선택] 마케팅

export const FIELD_LABEL = "text-[14px] font-bold text-ink";
const INPUT = "w-full h-12 px-4 rounded-md border focus:outline-none text-[16px]";
const SIDE_BTN =
  "cp-action shrink-0 h-12 px-4 rounded-md text-[14px] font-bold disabled:bg-sunken disabled:text-mutedSoft";

export function Required() {
  return <span className="text-error ml-0.5">*</span>;
}

// ── 이메일 + [중복 확인] ──────────────────────────────────────────────────────
export type EmailStatus = "idle" | "checking" | "ok" | "taken";

export function EmailDupField({
  role,
  email,
  onChange,
  status,
  onStatus,
  placeholder = "이메일을 입력해 주세요.",
}: {
  role: "reviewer" | "owner";
  email: string;
  onChange: (v: string) => void;
  status: EmailStatus;
  onStatus: (s: EmailStatus) => void;
  placeholder?: string;
}) {
  const valid = /\S+@\S+\.\S+/.test(email.trim());
  async function check() {
    onStatus("checking");
    try {
      const res = await fetch("/api/auth/check-availability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ field: "email", value: email.trim(), role }),
      });
      if (!res.ok) throw new Error();
      onStatus((await res.json()).available ? "ok" : "taken");
    } catch {
      onStatus("idle"); // 조회 실패 — 서버 최종 검증(409)에 위임
    }
  }
  return (
    <div>
      <div className={FIELD_LABEL}>
        이메일
        <Required />
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={email}
          onChange={(e) => {
            onChange(e.target.value);
            onStatus("idle"); // 값이 바뀌면 확인 결과 무효
          }}
          type="email"
          placeholder={placeholder}
          className={`flex-1 min-w-0 h-12 px-4 rounded-md border focus:outline-none text-[16px] ${
            status === "taken" ? "border-error" : "border-hairline focus:border-brand"
          }`}
        />
        <button type="button" onClick={check} disabled={!valid || status === "checking"} className={`${SIDE_BTN} bg-ink text-white`}>
          {status === "checking" ? "확인 중..." : "중복 확인"}
        </button>
      </div>
      {status === "taken" && (
        <p className="mt-1.5 text-[12px] text-error">이미 가입된 이메일이에요 — 로그인하거나 다른 이메일을 사용해주세요.</p>
      )}
      {status === "ok" && <p className="mt-1.5 text-[12px] text-successStrong">사용할 수 있는 이메일이에요.</p>}
    </div>
  );
}

// ── 비밀번호 + 재입력 (표시 토글) ─────────────────────────────────────────────
export function PasswordPair({
  pw,
  pw2,
  onPw,
  onPw2,
}: {
  pw: string;
  pw2: string;
  onPw: (v: string) => void;
  onPw2: (v: string) => void;
}) {
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const ruleErr = pw ? validatePassword(pw) : null;
  return (
    <div>
      <div className={FIELD_LABEL}>
        비밀번호
        <Required />
      </div>
      <div className="mt-2 relative">
        <input
          value={pw}
          onChange={(e) => onPw(e.target.value)}
          type={show1 ? "text" : "password"}
          placeholder={PASSWORD_RULE_TEXT}
          className={`${INPUT} pr-12 ${pw && ruleErr ? "border-error" : "border-hairline focus:border-brand"}`}
        />
        <button
          type="button"
          onClick={() => setShow1((v) => !v)}
          aria-label={show1 ? "비밀번호 숨기기" : "비밀번호 표시"}
          className="cp-action absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-mutedSoft"
        >
          <Icon name={show1 ? "eye" : "eye-off"} variant="border" size={20} />
        </button>
      </div>
      {pw && (
        <p className={`mt-1 text-[12px] ${ruleErr ? "text-error" : "text-successStrong"}`}>
          {ruleErr ?? "사용할 수 있는 비밀번호예요."}
        </p>
      )}
      <div className="mt-2 relative">
        <input
          value={pw2}
          onChange={(e) => onPw2(e.target.value)}
          type={show2 ? "text" : "password"}
          placeholder="비밀번호 재입력"
          className={`${INPUT} pr-12 ${pw2 && pw !== pw2 ? "border-error" : "border-hairline focus:border-brand"}`}
        />
        <button
          type="button"
          onClick={() => setShow2((v) => !v)}
          aria-label={show2 ? "비밀번호 숨기기" : "비밀번호 표시"}
          className="cp-action absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-mutedSoft"
        >
          <Icon name={show2 ? "eye" : "eye-off"} variant="border" size={20} />
        </button>
      </div>
      {pw2 && pw !== pw2 && <p className="mt-1 text-[12px] text-error">비밀번호가 일치하지 않아요.</p>}
      {pw2 && pw === pw2 && !ruleErr && <p className="mt-1 text-[12px] text-successStrong">비밀번호가 일치해요.</p>}
    </div>
  );
}

// ── 휴대전화 번호 + 인증번호 (인라인 인증) ────────────────────────────────────
export function PhoneVerifyField({
  role,
  verifiedPhone,
  onVerified,
}: {
  role: "reviewer" | "owner";
  verifiedPhone: string | null;
  onVerified: (phone: string | null) => void;
}) {
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setErr(null);
    setDemoCode(null);
    const res = await fetch("/api/auth/phone/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, role }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(j.error || "인증번호 발송에 실패했어요");
      return;
    }
    setOtpSent(true);
    setOtp("");
    if (j.demo && j.code) setDemoCode(j.code);
  }

  async function verify() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/auth/phone/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, code: otp }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(j.error || "인증에 실패했어요");
      return;
    }
    onVerified(phone); // 증빙 쿠키 발급됨 — 가입 API가 재검증
  }

  if (verifiedPhone) {
    return (
      <div>
        <div className={FIELD_LABEL}>
          휴대전화 번호
          <Required />
        </div>
        <div className="mt-2 h-12 px-4 rounded-md bg-sunken flex items-center justify-between">
          <span className="text-[16px] font-semibold text-ink tabular-nums">{verifiedPhone}</span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-1 rounded-pill bg-successSoft text-successStrong text-[11px] font-bold">
              ✓ 인증 완료
            </span>
            <button
              type="button"
              onClick={() => {
                onVerified(null);
                setPhone("");
                setOtpSent(false);
                setOtp("");
                setDemoCode(null);
              }}
              className="cp-action text-[12px] text-muted underline"
            >
              변경
            </button>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className={FIELD_LABEL}>
          휴대전화 번호
          <Required />
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value.replace(/\D/g, "").slice(0, 11));
              setOtpSent(false);
              setDemoCode(null);
            }}
            inputMode="numeric"
            placeholder="-없이 숫자만 입력"
            className={`flex-1 min-w-0 ${INPUT} border-hairline focus:border-brand tabular-nums`}
          />
          <button type="button" onClick={send} disabled={busy || phone.length < 10} className={`${SIDE_BTN} bg-ink text-white`}>
            {otpSent ? "재전송" : "인증번호 전송"}
          </button>
        </div>
        {demoCode && (
          <div className="mt-2 rounded-md bg-warningSoft px-4 py-3 text-[13px] text-ink2 leading-[1.55]">
            <b>데모 모드</b> — SMS 키가 설정되지 않아 실제 문자는 발송되지 않아요. 인증번호:{" "}
            <b className="tabular-nums text-[15px]">{demoCode}</b>
          </div>
        )}
      </div>
      <div>
        <div className={FIELD_LABEL}>인증번호</div>
        <div className="mt-2 flex gap-2">
          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="인증번호를 입력해 주세요."
            className={`flex-1 min-w-0 ${INPUT} border-hairline focus:border-brand tabular-nums`}
          />
          <button
            type="button"
            onClick={verify}
            disabled={busy || !otpSent || otp.length !== 6}
            className={`${SIDE_BTN} border border-hairline bg-canvas text-ink disabled:border-0`}
          >
            인증하기
          </button>
        </div>
        {err && <p className="mt-1.5 text-[12px] text-error">{err}</p>}
      </div>
    </div>
  );
}

// ── 추천인 코드 (선택 — 초대 토큰) ───────────────────────────────────────────
export function ReferralField({ code, onChange }: { code: string; onChange: (v: string) => void }) {
  const [tipOpen, setTipOpen] = useState(false);
  return (
    <div>
      <div className={`${FIELD_LABEL} flex items-center gap-1.5`}>
        추천인 코드
        <button
          type="button"
          onClick={() => setTipOpen((v) => !v)}
          aria-label="추천인 코드 안내"
          className="cp-action w-5 h-5 rounded-full border border-hairline text-[11px] text-muted grid place-items-center"
        >
          ?
        </button>
      </div>
      {tipOpen && (
        <p className="mt-1.5 text-[12px] text-muted leading-[1.5]">
          초대한 분에게 받은 코드를 입력하면 가입 후 웰컴 혜택을 받을 수 있어요. (선택)
        </p>
      )}
      <input
        value={code}
        onChange={(e) => onChange(e.target.value.trim())}
        placeholder="추천 코드를 입력해 주세요."
        className={`mt-2 ${INPUT} border-hairline focus:border-brand`}
      />
    </div>
  );
}

// ── 약관 동의 그룹 — 전체 동의 + 필수 3 + 선택 1 ─────────────────────────────
export interface AgreeState {
  age: boolean; // [필수] 만 14세 이상
  terms: boolean; // [필수] 서비스 이용약관
  privacy: boolean; // [필수] 개인정보 수집/이용
  marketing: boolean; // [선택] 광고성 정보 수신·마케팅 활용
}
export const AGREE_INIT: AgreeState = { age: false, terms: false, privacy: false, marketing: false };

export function AgreeGroup({ value, onChange }: { value: AgreeState; onChange: (v: AgreeState) => void }) {
  const all = value.age && value.terms && value.privacy && value.marketing;
  const rows: { key: keyof AgreeState; required: boolean; node: React.ReactNode }[] = [
    { key: "age", required: true, node: <>만 14세 이상입니다.</> },
    {
      key: "terms",
      required: true,
      node: (
        <>
          <a href="/legal/terms" target="_blank" className="underline font-semibold text-ink">서비스 이용약관</a>에 동의합니다.
        </>
      ),
    },
    {
      key: "privacy",
      required: true,
      node: (
        <>
          <a href="/legal/privacy" target="_blank" className="underline font-semibold text-ink">개인정보 수집/이용</a>에 동의합니다.
        </>
      ),
    },
    { key: "marketing", required: false, node: <>광고성 정보 수신 및 마케팅 활용에 동의합니다.</> },
  ];
  return (
    <div className="rounded-lg border border-hairline p-4">
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={all}
          onChange={(e) =>
            onChange({ age: e.target.checked, terms: e.target.checked, privacy: e.target.checked, marketing: e.target.checked })
          }
          className="w-5 h-5 accent-[#9333EA]"
        />
        <span className="text-[15px] font-bold text-ink">아래 항목에 전체 동의</span>
      </label>
      <div className="mt-3.5 pt-3.5 border-t border-hairlineSoft space-y-3">
        {rows.map((r) => (
          <label key={r.key} className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={value[r.key]}
              onChange={(e) => onChange({ ...value, [r.key]: e.target.checked })}
              className="w-4.5 h-4.5 accent-[#9333EA]"
            />
            <span className="text-[13px] text-ink2 leading-[1.45]">
              <b className={r.required ? "text-ink" : "text-muted"}>[{r.required ? "필수" : "선택"}]</b> {r.node}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
