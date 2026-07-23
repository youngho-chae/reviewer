"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// 운영자 수동 예약 취소 (§13-1) — 사유는 내부 기록·체험자 서브 문구 병기, 12h 재신청 제한 없음
export default function AdminReservationCancel({ passId }: { passId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/admin/reservations/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passId, reason: reason.trim() || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "처리에 실패했습니다.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cp-action mt-2.5 h-8 px-3 rounded-sm border border-hairline bg-canvas text-[12px] font-semibold text-muted"
      >
        운영자 취소
      </button>
    );
  }
  return (
    <div className="mt-2.5 rounded-sm bg-sunken px-3 py-2.5">
      <p className="text-[12px] text-ink2 leading-[1.5]">
        체험자에게는 “운영 정책에 따라 예약이 취소됐어요” 문구로 안내됩니다 (재신청 제한 없음).
      </p>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, 100))}
        placeholder="내부 기록용 사유 (선택)"
        className="mt-2 w-full h-9 px-3 rounded-sm border border-hairline bg-canvas text-[13px] text-ink placeholder:text-mutedSoft"
      />
      {err && <p className="mt-1.5 text-[12px] text-error">{err}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="cp-action h-8 px-3 rounded-sm border border-hairline bg-canvas text-[12px] font-semibold text-ink"
        >
          돌아가기
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          className="cp-action h-8 px-3.5 rounded-sm bg-errorSoft text-error text-[12px] font-bold disabled:opacity-60"
        >
          {busy ? "취소 중..." : "예약 취소"}
        </button>
      </div>
    </div>
  );
}
