"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// 출금 신청 지급/반려 액션 — POST /api/admin/points (requested → paid | rejected)
export default function ProcessWithdrawalButtons({ withdrawalId }: { withdrawalId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function decide(decision: "paid" | "reject") {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/admin/points", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ withdrawalId, decision, reason: decision === "reject" ? reason.trim() : undefined }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "처리 실패");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3">
      {rejecting ? (
        <div className="space-y-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="반려 사유 (체험자에게 그대로 안내 · 포인트 전액 복구)"
            className="w-full h-10 px-3 rounded-sm border border-hairline text-[13px] focus:border-brand focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className="cp-action h-10 px-4 rounded-sm bg-sunken text-[13px] font-semibold text-ink"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => decide("reject")}
              disabled={busy}
              className="cp-action flex-1 h-10 rounded-sm bg-error text-white text-[13px] font-bold disabled:opacity-60"
            >
              {busy ? "처리 중..." : "반려 확정 (포인트 복구)"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRejecting(true)}
            disabled={busy}
            className="cp-action h-10 px-4 rounded-sm border border-hairline text-[13px] font-semibold text-error disabled:opacity-60"
          >
            반려
          </button>
          <button
            type="button"
            onClick={() => decide("paid")}
            disabled={busy}
            className="cp-action flex-1 h-10 rounded-sm bg-brand text-white text-[13px] font-bold disabled:opacity-60"
          >
            {busy ? "처리 중..." : "지급 완료 처리"}
          </button>
        </div>
      )}
      {err && <p className="mt-1.5 text-[12px] text-error">{err}</p>}
    </div>
  );
}
