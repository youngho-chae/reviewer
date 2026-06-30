"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewDecisionActions({ passId }: { passId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function decide(decision: "approve" | "reject") {
    setBusy(decision);
    setErr(null);
    try {
      const res = await fetch("/api/admin/reviews/decide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passId, decision, reason: decision === "reject" ? reason : undefined }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        setErr(error || "처리 실패");
        setBusy(null);
        return;
      }
      router.refresh(); // 처리되면 목록에서 사라짐
    } catch {
      setErr("네트워크 오류");
      setBusy(null);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-hairlineSoft">
      {!rejecting ? (
        <div className="flex gap-2">
          <button
            onClick={() => decide("approve")}
            disabled={busy !== null}
            className="flex-1 h-10 rounded-pill bg-brand text-white text-[14px] font-semibold disabled:opacity-50"
          >
            {busy === "approve" ? "처리 중..." : "검수 통과"}
          </button>
          <button
            onClick={() => setRejecting(true)}
            disabled={busy !== null}
            className="flex-1 h-10 rounded-pill border border-error text-error text-[14px] font-semibold disabled:opacity-50"
          >
            반려
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="반려 사유 (선택, 체험자 알림에 표시)"
            maxLength={100}
            className="w-full h-10 px-3 rounded-md border border-hairline focus:border-error focus:outline-none text-[13px]"
          />
          <div className="flex gap-2">
            <button
              onClick={() => decide("reject")}
              disabled={busy !== null}
              className="flex-1 h-10 rounded-pill bg-error text-white text-[14px] font-semibold disabled:opacity-50"
            >
              {busy === "reject" ? "처리 중..." : "반려 확정"}
            </button>
            <button
              onClick={() => { setRejecting(false); setReason(""); }}
              disabled={busy !== null}
              className="flex-1 h-10 rounded-pill border border-hairline text-ink text-[14px] disabled:opacity-50"
            >
              취소
            </button>
          </div>
        </div>
      )}
      {err && <div className="mt-2 text-[12px] text-error">{err}</div>}
    </div>
  );
}
