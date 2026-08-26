"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// 사업자등록 진위확인 폼 (2026-08-18 개편 — 구 수기 제출 대체, 즉시 승인)
//  ① 계정 성격 셀렉트: 사장님(기본) | 마케터
//  ② 사업자등록번호 + [조회] → 공공데이터포털 국세청 상태조회 API 검증 (biz-verify)
//  ③ 사업장명(사업자명)은 비활성 — 진위 검증 시 자동 기입 (API가 상호를 제공하지
//     않는 실키 모드에서만 needName 응답으로 입력을 활성화해 보완)
//  ④ 진위 확인되면 관리자 승인 없이 즉시 verified → refresh로 사장님 화면 진입
export default function BizInfoForm() {
  const router = useRouter();
  const [operatorType, setOperatorType] = useState<"owner" | "marketer">("owner");
  const [bizNumber, setBizNumber] = useState("");
  const [bizName, setBizName] = useState("");
  const [nameEditable, setNameEditable] = useState(false); // 실 API 상호 미제공 시에만 활성화
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null); // 승인 완료 안내 (statusLabel)

  async function verify() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/owner/biz-verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bizNumber, operatorType, ...(nameEditable ? { storeName: bizName } : {}) }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(j.error || "진위확인에 실패했어요");
      return;
    }
    if (j.needName) {
      // 번호는 유효하지만 국세청 응답에 상호가 없음 — 사업장명 입력을 열어 보완 후 재조회
      setNameEditable(true);
      setErr("번호가 확인됐어요 — 사업장명을 입력하고 다시 [조회]를 눌러주세요.");
      return;
    }
    setBizName(j.bizName || "");
    setDone(j.statusLabel || "확인 완료");
    // 즉시 승인 완료 — 잠시 안내 후 사장님 화면으로
    setTimeout(() => router.refresh(), 900);
  }

  return (
    <div className="mt-8 text-left space-y-4">
      {/* 계정 성격 — 기본 사장님 */}
      <div>
        <div className="text-[14px] font-bold text-ink">가입 유형<span className="text-error ml-0.5">*</span></div>
        <select
          value={operatorType}
          onChange={(e) => setOperatorType(e.target.value === "marketer" ? "marketer" : "owner")}
          className="mt-2 w-full h-12 px-4 rounded-md border border-hairline bg-canvas focus:border-brand focus:outline-none text-[16px]"
        >
          <option value="owner">사장님 (사업장을 직접 운영해요)</option>
          <option value="marketer">마케터 (사업장을 대신 관리해요)</option>
        </select>
      </div>

      <p className="text-[13px] text-ink2 leading-[1.55]">
        운영중이신 또는 관리중이신 사업장의 <b className="text-ink">사업자등록번호를 조회해 주세요.</b>
      </p>

      <div>
        <div className="text-[14px] font-bold text-ink">사업자등록번호<span className="text-error ml-0.5">*</span></div>
        <div className="mt-2 flex gap-2">
          <input
            value={bizNumber}
            onChange={(e) => {
              setBizNumber(e.target.value.replace(/\D/g, "").slice(0, 10));
              setDone(null);
              setNameEditable(false);
              setBizName("");
            }}
            inputMode="numeric"
            placeholder="숫자 10자리"
            className="flex-1 min-w-0 h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[16px] tabular-nums"
            disabled={!!done}
          />
          <button
            type="button"
            onClick={verify}
            disabled={busy || bizNumber.length !== 10 || !!done}
            className="cp-action shrink-0 h-12 px-5 rounded-md bg-ink text-white text-[14px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
          >
            {busy ? "조회 중..." : "조회"}
          </button>
        </div>
      </div>

      <div>
        <div className="text-[14px] font-bold text-ink">사업장명 (사업자명)</div>
        <input
          value={bizName}
          onChange={(e) => setBizName(e.target.value)}
          disabled={!nameEditable}
          placeholder="사업자등록번호 조회 시 자동으로 채워져요."
          className={`mt-2 w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[16px] ${
            nameEditable ? "" : "bg-sunken text-ink"
          }`}
        />
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
