"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PassStatus } from "@/lib/types";

// 체험권 정정 액션 (2026-09-07 감사 개편) — /api/admin/passes/fix + 노쇼 정정.
// 상태별 가능한 액션만 노출, 모든 처분은 사유 필수(감사 로그 기록).
const ACTIONS: { key: string; label: string; allowed: (st: PassStatus) => boolean; needAmount?: boolean }[] = [
  { key: "fix_amount", label: "결제액 정정", allowed: (st) => ["used", "review_submitted", "completed", "rejected"].includes(st), needAmount: true },
  { key: "revert_use", label: "사용 처리 취소", allowed: (st) => st === "used" },
  { key: "reopen_review", label: "검수 재개", allowed: (st) => st === "completed" || st === "rejected" },
  { key: "allow_resubmit", label: "재제출 허용(기한 연장)", allowed: (st) => st === "rejected" },
  { key: "force_cancel", label: "강제 취소", allowed: (st) => st === "active" },
];

export default function PassFixActions({
  passId,
  status,
  paidAmount,
  reviewerId,
  reviewerExists,
  noShowCount,
}: {
  passId: string;
  status: PassStatus;
  paidAmount: number | null;
  reviewerId: string;
  reviewerExists: boolean;
  noShowCount: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null); // action key 또는 "noshow"
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState(paidAmount != null ? String(paidAmount) : "");
  const [delta, setDelta] = useState("-1");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const available = ACTIONS.filter((a) => a.allowed(status));
  if (available.length === 0 && !reviewerExists) return null;

  async function run() {
    setBusy(true);
    setErr(null);
    const isNoshow = open === "noshow";
    const res = await fetch(isNoshow ? "/api/admin/reviewers/adjust" : "/api/admin/passes/fix", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        isNoshow
          ? { reviewerId, noShowDelta: Number(delta), reason }
          : { passId, action: open, reason, ...(open === "fix_amount" ? { paidAmount: Number(amount) } : {}) },
      ),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(j.error || "처리 실패");
      return;
    }
    setOpen(null);
    setReason("");
    router.refresh();
  }

  const current = ACTIONS.find((a) => a.key === open);

  return (
    <div className="mt-3 pt-3 border-t border-hairlineSoft">
      <div className="flex gap-1.5 flex-wrap">
        {available.map((a) => (
          <button
            key={a.key}
            onClick={() => {
              setOpen(open === a.key ? null : a.key);
              setErr(null);
            }}
            className={`cp-action px-2.5 py-1.5 rounded-md text-[12px] font-semibold border ${
              open === a.key ? "border-brand text-brand bg-brandSoft" : "border-hairline text-ink2"
            }`}
          >
            {a.label}
          </button>
        ))}
        {reviewerExists && noShowCount != null && (
          <button
            onClick={() => {
              setOpen(open === "noshow" ? null : "noshow");
              setErr(null);
            }}
            className={`cp-action px-2.5 py-1.5 rounded-md text-[12px] font-semibold border ${
              open === "noshow" ? "border-brand text-brand bg-brandSoft" : "border-hairline text-ink2"
            }`}
          >
            노쇼 정정 (현재 {noShowCount})
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2.5 rounded-md bg-sunken p-3 space-y-2">
          {current?.needAmount && (
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="정정할 결제 금액 (원)"
              className="w-full h-10 px-3 rounded-md border border-hairline focus:border-brand focus:outline-none text-[14px] tabular-nums"
            />
          )}
          {open === "noshow" && (
            <select
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-hairline focus:border-brand focus:outline-none text-[14px] bg-canvas"
            >
              <option value="-1">노쇼 −1 (귀책 정정 — 매장 사정 만료 등)</option>
              <option value="-2">노쇼 −2</option>
              <option value="1">노쇼 +1 (수기 반영)</option>
            </select>
          )}
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="정정 사유 (필수 — 감사 로그에 기록됩니다)"
            maxLength={300}
            className="w-full h-10 px-3 rounded-md border border-hairline focus:border-brand focus:outline-none text-[14px]"
          />
          {err && <p className="text-[12px] text-error">{err}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => setOpen(null)}
              disabled={busy}
              className="cp-action h-10 px-4 rounded-md bg-canvas border border-hairline text-[13px] font-semibold text-ink"
            >
              닫기
            </button>
            <button
              onClick={run}
              disabled={busy || !reason.trim()}
              className="cp-action flex-1 h-10 rounded-md bg-brand text-white text-[13px] font-bold disabled:opacity-50"
            >
              {busy ? "처리 중..." : `${open === "noshow" ? "노쇼 정정" : current?.label} 실행`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
