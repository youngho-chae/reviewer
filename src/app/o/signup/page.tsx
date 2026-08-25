"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { validatePassword, PASSWORD_RULE_TEXT } from "@/lib/password";

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
  const inviteToken = sp.get("invite")?.trim() || null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState(""); // 비밀번호 확인 (2026-08-18 — 2회 기입)
  const [storeName, setStoreName] = useState("");
  const [category, setCategory] = useState("한식");
  const [area, setArea] = useState("");
  const [bizNumber, setBizNumber] = useState(""); // 사업자등록번호 10자리 (확정 정책 9 — 수기 인증)
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(null);
    if (!email || !password || !storeName || !area) { setErr("모든 항목을 입력해주세요"); setLoading(false); return; }
    // 비밀번호 정책 (2026-08-18) — 영문·숫자·특수문자 필수 (정본 src/lib/password.ts)
    const pwRuleErr = validatePassword(password);
    if (pwRuleErr) { setErr(pwRuleErr); setLoading(false); return; }
    if (password !== password2) { setErr("비밀번호가 일치하지 않아요 — 다시 확인해주세요"); setLoading(false); return; }
    if (bizNumber.length !== 10) { setErr("사업자등록번호 10자리를 입력해주세요"); setLoading(false); return; }
    if (!agreeTerms || !agreePrivacy) { setErr("이용약관과 개인정보 수집·이용에 동의해주세요"); setLoading(false); return; }
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "owner", email, password, storeName, category, area, bizNumber, agreeTerms: agreeTerms && agreePrivacy }),
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
      router.push("/o/home");
    }
    router.refresh();
  }

  return (
    <main className="mobile-shell bg-canvas px-5 pt-14 pb-10">
      <Link href="/o/login" className="cp-action text-muted text-[14px]">← 로그인으로</Link>
      <h1 className="mt-6 text-[20px] font-bold text-ink tracking-title">사장님 가입</h1>
      <p className="mt-2 text-[14px] text-muted">매장 정보를 입력하면 첫 캠페인을 만들 수 있어요.</p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="이메일" className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[16px]" />
        <div>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="비밀번호"
            className={`w-full h-12 px-4 rounded-md border focus:outline-none text-[16px] ${
              password && validatePassword(password) ? "border-error" : "border-hairline focus:border-brand"
            }`}
          />
          <p className={`mt-1 text-[12px] ${!password ? "text-muted" : validatePassword(password) ? "text-error" : "text-successStrong"}`}>
            {password ? validatePassword(password) ?? "사용할 수 있는 비밀번호예요." : PASSWORD_RULE_TEXT}
          </p>
        </div>
        <div>
          <input
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            type="password"
            placeholder="비밀번호 확인"
            className={`w-full h-12 px-4 rounded-md border focus:outline-none text-[16px] ${
              password2 && password !== password2 ? "border-error" : "border-hairline focus:border-brand"
            }`}
          />
          {password2 && password !== password2 && <p className="mt-1 text-[12px] text-error">비밀번호가 일치하지 않아요.</p>}
          {password2 && password === password2 && !validatePassword(password) && (
            <p className="mt-1 text-[12px] text-successStrong">비밀번호가 일치해요.</p>
          )}
        </div>
        <input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="매장명" className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[16px]" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full h-12 px-4 rounded-md border border-hairline bg-canvas focus:border-brand focus:outline-none text-[16px]">
          <option>한식</option><option>일식</option><option>양식</option><option>중식</option><option>카페</option><option>주점</option>
        </select>
        <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="동네 (예: 북촌)" className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[16px]" />
        {/* 사업자 인증 (확정 정책 9) — 남의 매장 캠페인 방지. 초기엔 수기 인증(영업일 2~3일) */}
        <input
          value={bizNumber}
          onChange={(e) => setBizNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
          inputMode="numeric"
          placeholder="사업자등록번호 (숫자 10자리)"
          className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[16px] tabular-nums"
        />
        <p className="text-[12px] text-muted leading-[1.5] px-1">
          가입 후 운영팀이 사업자 정보를 확인해요 — 영업일 기준 <span className="text-ink font-medium">2~3일 이내 인증 완료</span>를
          안내드리며, 인증 완료 후 사장님 화면을 이용할 수 있습니다.
        </p>

        {/* 필수 동의 — 약관/개인정보 (개인정보보호법상 명시적 동의) */}
        <div className="pt-1 space-y-2.5">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="mt-0.5 w-[18px] h-[18px] accent-[#9333EA]" />
            <span className="text-[13px] text-ink2 leading-[1.45]">
              (필수) <a href="/legal/terms" target="_blank" className="text-brand font-medium">이용약관</a>에 동의합니다
            </span>
          </label>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} className="mt-0.5 w-[18px] h-[18px] accent-[#9333EA]" />
            <span className="text-[13px] text-ink2 leading-[1.45]">
              (필수) <a href="/legal/privacy" target="_blank" className="text-brand font-medium">개인정보 수집·이용</a>에 동의합니다
            </span>
          </label>
        </div>

        {err && <div className="text-error text-[14px]">{err}</div>}
        <button disabled={loading} type="submit" className="w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:bg-sunken disabled:text-mutedSoft">{loading ? "처리 중..." : "가입하고 시작하기"}</button>
      </form>
    </main>
  );
}
