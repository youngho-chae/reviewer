"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RESERVATION_TIME_SLOTS,
  RESERVATION_STATUS_LABEL,
  reservationDateOptions,
  fmtReservationDateLabel,
  fmtReservationLabel,
} from "@/lib/reservation";
import { SBUI, sbNum } from "@/lib/storyboard";

/**
 * 예약 방문 패널 (2026-07-16 리뷰노트 벤치마크) — active 예약형 체험권 전용.
 *  - 예약 일시 + 상태(확인 대기/확정) 표시
 *  - [예약 변경]: 새 일시 선택 → POST /api/passes/reservation → 확인 대기로 복귀·기한 재계산
 * 예약은 일정 조율일 뿐 사용 게이트가 아니다 — 미확정이어도 QR 사용은 가능(운영정책서 §15).
 */
export default function ReservationPanel({
  passId,
  date,
  time,
  status,
  endAt,
}: {
  passId: string;
  date: string;
  time: string;
  status: "requested" | "proposed" | "confirmed";
  endAt: number; // 캠페인 종료일 — 변경 가능 날짜 한도
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [newDate, setNewDate] = useState(date);
  const [newTime, setNewTime] = useState(time);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dates = useMemo(() => reservationDateOptions(endAt), [endAt]);

  async function change() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/passes/reservation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passId, date: newDate, time: newTime }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "예약 변경에 실패했어요.");
      setBusy(false);
      return;
    }
    setBusy(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="mx-5 mt-4 rounded-md border border-hairline p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12px] text-muted">방문 예약</div>
          <div className="mt-0.5 text-[15px] font-bold text-ink tabular-nums">
            📅 {sbNum(SBUI.dateTime, fmtReservationLabel(date, time))}
          </div>
        </div>
        <span
          className={`shrink-0 inline-flex items-center px-2 py-1 rounded-pill text-[11px] font-semibold ${
            status === "confirmed" ? "bg-successSoft text-successStrong" : "bg-sunken text-muted"
          }`}
        >
          {RESERVATION_STATUS_LABEL[status]}
        </span>
      </div>
      <p className="mt-1.5 text-[12px] text-muted leading-[1.5]">
        {status === "confirmed"
          ? "예약이 확인되었어요 · 예약 시간에 방문해 QR을 제시해주세요."
          : "사장님이 예약을 확인하면 알림을 드려요."}
      </p>

      {!editing ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="cp-action mt-3 h-9 px-3.5 rounded-sm border border-hairline bg-canvas text-[13px] font-semibold text-ink"
        >
          예약 변경
        </button>
      ) : (
        <div className="mt-3">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              aria-label="변경할 방문 날짜"
              className="h-10 px-3 rounded-sm border border-hairline bg-canvas text-[13px] text-ink"
            >
              {dates.map((d) => (
                <option key={d} value={d}>
                  {fmtReservationDateLabel(d)}
                </option>
              ))}
            </select>
            <select
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              aria-label="변경할 방문 시간"
              className="h-10 px-3 rounded-sm border border-hairline bg-canvas text-[13px] text-ink"
            >
              {RESERVATION_TIME_SLOTS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1.5 text-[11px] text-muted">변경하면 예약이 다시 확인 대기 상태가 되고, 체험권 기한도 새 방문일로 조정돼요.</p>
          {err && <p className="mt-1.5 text-[12px] text-error">{err}</p>}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="cp-action h-9 px-3.5 rounded-sm bg-sunken text-[13px] font-semibold text-ink"
            >
              취소
            </button>
            <button
              type="button"
              onClick={change}
              disabled={busy}
              className="cp-action h-9 px-4 rounded-sm bg-brand text-white text-[13px] font-bold disabled:opacity-60"
            >
              {busy ? "변경 중..." : "이 일시로 변경"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
