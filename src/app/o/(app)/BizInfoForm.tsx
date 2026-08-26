"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// 사업자 정보 제출 폼 (2026-08-18) — 가입 항목 축소로 상호·사업자등록번호를
// 가입 대신 인증 대기 화면에서 받는다 (POST /api/owner/biz-info → 운영팀 수기 인증).
export default function BizInfoForm() {
  const router = useRouter();
  const [storeName, setStoreName] = useState("");
  const [bizNumber, setBizNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/owner/biz-info", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ storeName, bizNumber }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(j.error || "제출에 실패했어요");
      return;
    }
    router.refresh(); // 제출 후 "확인 중" 안내 화면으로 전환
  }

  return (
    <div className="mt-8 text-left space-y-3">
      <div>
        <div className="text-[14px] font-bold text-ink">상호 (매장명)<span className="text-error ml-0.5">*</span></div>
        <input
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          placeholder="사업자등록증의 상호를 입력해 주세요."
          className="mt-2 w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[16px]"
        />
      </div>
      <div>
        <div className="text-[14px] font-bold text-ink">사업자등록번호<span className="text-error ml-0.5">*</span></div>
        <input
          value={bizNumber}
          onChange={(e) => setBizNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
          inputMode="numeric"
          placeholder="숫자 10자리"
          className="mt-2 w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[16px] tabular-nums"
        />
      </div>
      {err && <p className="text-[13px] text-error">{err}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={busy || !storeName.trim() || bizNumber.length !== 10}
        className="cp-action w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
      >
        {busy ? "제출 중..." : "인증 요청하기"}
      </button>
    </div>
  );
}
