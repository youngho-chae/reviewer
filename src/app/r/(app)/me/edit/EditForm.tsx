"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { validatePassword, PASSWORD_RULE_TEXT } from "@/lib/password";

// 회원 정보 수정 폼 (2026-08-18) — 섹션별 독립 저장 (PATCH /api/reviewer/account).
//  ① 닉네임 — 변경 시 중복확인 (가입과 동일: 500ms 디바운스 · 본인 현재 닉네임은 스킵)
//  ② 휴대폰 번호 — 새 번호 재인증 필수 (기존 OTP 발송/검증 API 재사용 → 증빙 쿠키 → PATCH)
//  ③ 비밀번호 변경 — 새 비밀번호 2회 기입 일치 + 규칙 검증 (간편로그인 계정은 비노출)

function fmtPhone(p: string): string {
  if (p.length === 11) return `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}`;
  if (p.length === 10) return `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}`;
  return p;
}

export default function EditForm({ nickname: initialNick, phone: currentPhone, isSocial }: {
  nickname: string;
  phone: string;
  isSocial: boolean;
}) {
  const router = useRouter();

  // ── 닉네임 ──
  const [nick, setNick] = useState(initialNick);
  const [nickStatus, setNickStatus] = useState<"idle" | "checking" | "ok" | "taken">("idle");
  const [nickMsg, setNickMsg] = useState<string | null>(null);
  const [nickBusy, setNickBusy] = useState(false);
  const nickChanged = nick.trim() !== initialNick && nick.trim().length >= 2;
  useEffect(() => {
    if (!nickChanged) {
      setNickStatus("idle");
      return;
    }
    setNickStatus("checking");
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/auth/check-availability", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ field: "nickname", value: nick.trim() }),
        });
        if (!res.ok) throw new Error();
        setNickStatus((await res.json()).available ? "ok" : "taken");
      } catch {
        setNickStatus("idle"); // 조회 실패 — 서버 최종 검증(409)에 위임
      }
    }, 500);
    return () => clearTimeout(t);
  }, [nick, nickChanged]);

  async function saveNick() {
    setNickBusy(true);
    setNickMsg(null);
    const res = await fetch("/api/reviewer/account", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname: nick.trim() }),
    });
    const j = await res.json().catch(() => ({}));
    setNickBusy(false);
    if (!res.ok) {
      setNickMsg(j.error || "변경에 실패했어요");
      return;
    }
    setNickMsg("닉네임이 변경되었습니다.");
    router.refresh();
  }

  // ── 휴대폰 번호 ──
  const [phoneEditing, setPhoneEditing] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [phoneMsg, setPhoneMsg] = useState<string | null>(null);
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [phoneBusy, setPhoneBusy] = useState(false);

  async function sendOtp() {
    setPhoneBusy(true);
    setPhoneErr(null);
    setDemoCode(null);
    const res = await fetch("/api/auth/phone/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: newPhone }),
    });
    const j = await res.json().catch(() => ({}));
    setPhoneBusy(false);
    if (!res.ok) {
      setPhoneErr(j.error || "인증번호 발송에 실패했어요");
      return;
    }
    setOtpSent(true);
    setOtp("");
    if (j.demo && j.code) setDemoCode(j.code);
  }

  async function verifyAndChange() {
    setPhoneBusy(true);
    setPhoneErr(null);
    // 1) OTP 검증 — 성공 시 증빙 쿠키 발급 (가입 플로우와 동일 API)
    const v = await fetch("/api/auth/phone/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: newPhone, code: otp }),
    });
    if (!v.ok) {
      const j = await v.json().catch(() => ({}));
      setPhoneErr(j.error || "인증에 실패했어요");
      setPhoneBusy(false);
      return;
    }
    // 2) 번호 변경 — 서버가 증빙 쿠키 재검증
    const res = await fetch("/api/reviewer/account", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: newPhone }),
    });
    const j = await res.json().catch(() => ({}));
    setPhoneBusy(false);
    if (!res.ok) {
      setPhoneErr(j.error || "번호 변경에 실패했어요");
      return;
    }
    setPhoneEditing(false);
    setNewPhone("");
    setOtpSent(false);
    setOtp("");
    setDemoCode(null);
    setPhoneMsg("휴대폰 번호가 변경되었습니다.");
    router.refresh();
  }

  // ── 비밀번호 변경 ──
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErrMsg, setPwErrMsg] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  async function savePw() {
    setPwErrMsg(null);
    setPwMsg(null);
    const ruleErr = validatePassword(pw);
    if (ruleErr) {
      setPwErrMsg(ruleErr);
      return;
    }
    if (pw !== pw2) {
      setPwErrMsg("비밀번호가 일치하지 않아요 — 다시 확인해주세요");
      return;
    }
    setPwBusy(true);
    const res = await fetch("/api/reviewer/account", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    const j = await res.json().catch(() => ({}));
    setPwBusy(false);
    if (!res.ok) {
      setPwErrMsg(j.error || "변경에 실패했어요");
      return;
    }
    setPw("");
    setPw2("");
    setPwMsg("비밀번호가 변경되었습니다.");
  }

  const inputCls = "w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[16px]";

  return (
    <div className="px-5 mt-6 space-y-3">
      {/* ① 닉네임 */}
      <section className="rounded-lg border border-hairline bg-canvas p-4">
        <div className="text-[13px] font-bold text-ink">닉네임</div>
        <div className="mt-2 flex gap-2">
          <input
            value={nick}
            onChange={(e) => {
              setNick(e.target.value);
              setNickMsg(null);
            }}
            placeholder="닉네임"
            className={`flex-1 h-12 px-4 rounded-md border focus:outline-none text-[16px] ${
              nickStatus === "taken" ? "border-error" : "border-hairline focus:border-brand"
            }`}
          />
          <button
            type="button"
            onClick={saveNick}
            disabled={nickBusy || !nickChanged || nickStatus === "taken" || nickStatus === "checking"}
            className="cp-action shrink-0 h-12 px-4 rounded-md bg-ink text-white text-[14px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
          >
            {nickBusy ? "저장 중..." : "변경 저장"}
          </button>
        </div>
        {nickStatus === "taken" && <p className="mt-1.5 text-[12px] text-error">이미 사용 중인 닉네임이에요 — 다른 닉네임을 입력해주세요.</p>}
        {nickStatus === "ok" && <p className="mt-1.5 text-[12px] text-successStrong">사용할 수 있는 닉네임이에요.</p>}
        {nickMsg && <p className={`mt-1.5 text-[12px] ${nickMsg.includes("변경되었") ? "text-successStrong" : "text-error"}`}>{nickMsg}</p>}
      </section>

      {/* ② 휴대폰 번호 — 변경 시 새 번호 재인증 필수 */}
      <section className="rounded-lg border border-hairline bg-canvas p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] font-bold text-ink">휴대폰 번호</div>
            <div className="mt-1 text-[16px] font-semibold text-ink tabular-nums">{fmtPhone(currentPhone) || "-"}</div>
          </div>
          {!phoneEditing && (
            <button
              type="button"
              onClick={() => {
                setPhoneEditing(true);
                setPhoneMsg(null);
              }}
              className="cp-action shrink-0 h-10 px-3.5 rounded-md border border-hairline bg-canvas text-[13px] font-semibold text-ink"
            >
              번호 변경
            </button>
          )}
        </div>
        {phoneMsg && <p className="mt-1.5 text-[12px] text-successStrong">{phoneMsg}</p>}

        {phoneEditing && (
          <div className="mt-3 space-y-2.5">
            <p className="text-[12px] text-muted">새 번호로 인증번호를 받아 본인 확인 후 변경돼요.</p>
            <div className="flex gap-2">
              <input
                value={newPhone}
                onChange={(e) => {
                  setNewPhone(e.target.value.replace(/\D/g, "").slice(0, 11));
                  setOtpSent(false);
                  setDemoCode(null);
                }}
                inputMode="numeric"
                placeholder="새 휴대폰 번호 (숫자만)"
                className="flex-1 h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[16px] tabular-nums"
              />
              <button
                type="button"
                onClick={sendOtp}
                disabled={phoneBusy || newPhone.length < 10}
                className="cp-action shrink-0 h-12 px-4 rounded-md bg-ink text-white text-[14px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
              >
                {otpSent ? "재발송" : "인증번호 받기"}
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
              </>
            )}
            {phoneErr && <p className="text-[12px] text-error">{phoneErr}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setPhoneEditing(false);
                  setPhoneErr(null);
                }}
                disabled={phoneBusy}
                className="cp-action h-11 px-4 rounded-md bg-sunken text-[14px] font-semibold text-ink disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={verifyAndChange}
                disabled={phoneBusy || !otpSent || otp.length !== 6}
                className="cp-action flex-1 h-11 rounded-md bg-brand text-white text-[14px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
              >
                {phoneBusy ? "처리 중..." : "인증하고 변경"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ③ 비밀번호 변경 — 간편로그인 계정은 비밀번호 미사용이라 비노출 */}
      {!isSocial && (
        <section className="rounded-lg border border-hairline bg-canvas p-4">
          <div className="text-[13px] font-bold text-ink">비밀번호 변경</div>
          <div className="mt-2 space-y-2.5">
            <div>
              <input
                value={pw}
                onChange={(e) => {
                  setPw(e.target.value);
                  setPwMsg(null);
                }}
                type="password"
                placeholder="새 비밀번호"
                className={`w-full h-12 px-4 rounded-md border focus:outline-none text-[16px] ${
                  pw && validatePassword(pw) ? "border-error" : "border-hairline focus:border-brand"
                }`}
              />
              <p className={`mt-1 text-[12px] ${!pw ? "text-muted" : validatePassword(pw) ? "text-error" : "text-successStrong"}`}>
                {pw ? validatePassword(pw) ?? "사용할 수 있는 비밀번호예요." : PASSWORD_RULE_TEXT}
              </p>
            </div>
            <div>
              <input
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                type="password"
                placeholder="새 비밀번호 확인"
                className={`w-full h-12 px-4 rounded-md border focus:outline-none text-[16px] ${
                  pw2 && pw !== pw2 ? "border-error" : "border-hairline focus:border-brand"
                }`}
              />
              {pw2 && pw !== pw2 && <p className="mt-1 text-[12px] text-error">비밀번호가 일치하지 않아요.</p>}
              {pw2 && pw === pw2 && !validatePassword(pw) && (
                <p className="mt-1 text-[12px] text-successStrong">비밀번호가 일치해요.</p>
              )}
            </div>
            {pwErrMsg && <p className="text-[12px] text-error">{pwErrMsg}</p>}
            {pwMsg && <p className="text-[12px] text-successStrong">{pwMsg}</p>}
            <button
              type="button"
              onClick={savePw}
              disabled={pwBusy || !pw || !pw2}
              className="cp-action w-full h-11 rounded-md bg-ink text-white text-[14px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
            >
              {pwBusy ? "변경 중..." : "비밀번호 변경"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
