"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// 사업자등록 진위확인 폼 (2026-08-18 개편 · 2차: 사업장명 선입력 + 버튼형 가입 유형)
//  ① 가입 유형 = 버튼 2개 [사장님(기본)|마케터] — 드랍박스 폐기
//  ② 사업장명(사업자명) 직접 입력 → ③ 사업자등록번호 + [조회] (사업장명 입력 후 활성)
//  ④ 국세청 상태조회 API(biz-verify)로 진위 확인되면 관리자 승인 없이 즉시 verified
export default function BizInfoForm() {
  const router = useRouter();
  const [operatorType, setOperatorType] = useState<"owner" | "marketer">("owner");
  const [bizName, setBizName] = useState("");
  const [bizNumber, setBizNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null); // 승인 완료 안내 (statusLabel)

  async function verify() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/owner/biz-verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bizNumber, operatorType, storeName: bizName }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(j.error || "진위확인에 실패했어요");
      return;
    }
    setDone(j.statusLabel || "확인 완료");
    // 즉시 승인 완료 — 잠시 안내 후 사장님 화면으로
    setTimeout(() => router.refresh(), 900);
  }

  return (
    <div className="mt-8 text-left space-y-4">
      {/* 가입 유형 — 버튼 2개, 기본 사장님 */}
      <div>
        <div className="text-[14px] font-bold text-ink">가입 유형<span className="text-error ml-0.5">*</span></div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              { key: "owner", label: "사장님", sub: "사업장을 직접 운영해요" },
              { key: "marketer", label: "마케터", sub: "사업장을 대신 관리해요" },
            ] as const
          ).map((t) => {
            const active = operatorType === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setOperatorType(t.key)}
                aria-pressed={active}
                disabled={!!done}
                className={`cp-action rounded-lg px-3 py-3.5 text-left ${
                  active ? "border-[1.5px] border-brand bg-brandSoft" : "border border-hairline bg-canvas"
                }`}
              >
                <span className={`block text-[15px] font-bold ${active ? "text-brand" : "text-ink"}`}>{t.label}</span>
                <span className="mt-0.5 block text-[12px] text-muted leading-[1.4]">{t.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[13px] text-ink2 leading-[1.55]">
        운영중이신 또는 관리중이신 사업장의 <b className="text-ink">사업자등록번호를 조회해 주세요.</b>
      </p>

      {/* 사업장명 — 직접 입력 (진위 조회 전 필수) */}
      <div>
        <div className="text-[14px] font-bold text-ink">사업장명 (사업자명)<span className="text-error ml-0.5">*</span></div>
        <input
          value={bizName}
          onChange={(e) => setBizName(e.target.value)}
          disabled={!!done}
          placeholder="사업자등록증의 상호를 입력해 주세요."
          className="mt-2 w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[16px]"
        />
      </div>

      <div>
        <div className="text-[14px] font-bold text-ink">사업자등록번호<span className="text-error ml-0.5">*</span></div>
        <div className="mt-2 flex gap-2">
          <input
            value={bizNumber}
            onChange={(e) => {
              setBizNumber(e.target.value.replace(/\D/g, "").slice(0, 10));
              setErr(null);
            }}
            inputMode="numeric"
            placeholder="숫자 10자리"
            className="flex-1 min-w-0 h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[16px] tabular-nums"
            disabled={!!done}
          />
          <button
            type="button"
            onClick={verify}
            disabled={busy || !bizName.trim() || bizNumber.length !== 10 || !!done}
            className="cp-action shrink-0 h-12 px-5 rounded-md bg-ink text-white text-[14px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
          >
            {busy ? "조회 중..." : "조회"}
          </button>
        </div>
        {!bizName.trim() && bizNumber.length === 10 && (
          <p className="mt-1.5 text-[12px] text-muted">사업장명을 먼저 입력하면 조회할 수 있어요.</p>
        )}
      </div>

      {err && <p className="text-[13px] text-error leading-[1.5]">{err}</p>}
      {done && (
        <div className="rounded-md bg-successSoft px-4 py-3 text-[13px] text-ink leading-[1.55]">
          <b className="text-successStrong">✓ 사업자 확인 완료 ({done})</b> — 인증이 즉시 승인되었어요. 사장님 화면으로 이동합니다.
        </div>
      )}
    </div>
  );
}
