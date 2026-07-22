"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SBUI, sbNum } from "@/lib/storyboard";

// 날짜·시간 선택지 — 서버가 캠페인 스케줄·차단·정원 기준으로 계산해 전달 (reservation.ts ReservationPicker)
export type RsvPicker = {
  dates: Array<{ date: string; label: string; disabled: boolean }>;
  slotsByDate: Record<string, Array<{ time: string; label: string; disabled: boolean; reason?: string }>>;
};

/**
 * 예약 방문 패널 (2026-07-22 예약형 체험 시스템) — 예약형 체험권 전용.
 *  - 예약 일시 + 상태(예약 대기/일정 재요청/예약 확정) 표시 + 조율 이력
 *  - [예약 변경하기]: 대기 중 1회만 (§3-3) — 소진·재요청·확정 후에는 비활성
 *  - 확정 후에는 이력을 접힌 형태로 제공 (§9-2 — QR 화면은 최종 일정·인증 중심)
 */
export default function ReservationPanel({
  passId,
  date,
  time,
  label,
  statusLabel,
  confirmed,
  changeUsed,
  counterUsed,
  picker,
  historyLines = [],
}: {
  passId: string;
  date: string;
  time: string;
  label: string; // 서버 포맷 "7월 18일 (토) 오후 2시"
  statusLabel: string; // 예약 대기 / 일정 재요청 / 예약 확정 (§15-1)
  confirmed: boolean;
  changeUsed: boolean; // 희망 일정 변경 1회 소진 (§3-3)
  counterUsed: boolean; // 제안 후 기타 재요청 소진 — 이후 변경 불가
  picker: RsvPicker;
  historyLines?: Array<{ prefix: string; timeLabel: string; note?: string }>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [newDate, setNewDate] = useState(date);
  const [newTime, setNewTime] = useState(time);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const canChange = !confirmed && !changeUsed && !counterUsed;
  const slots = picker.slotsByDate[newDate] ?? [];

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

  const historyBlock =
    historyLines.length > 1 ? (
      <div className="rounded-sm bg-sunken px-3 py-2 space-y-1">
        {historyLines.map((h, i) => (
          <div key={i} className="text-[12px] text-ink2 leading-[1.5]">
            <span className={h.prefix.startsWith("사장님") ? "font-semibold text-brand" : "font-semibold text-ink"}>{h.prefix}</span>
            {h.timeLabel && <span className="tabular-nums"> · {sbNum(SBUI.dateTime, h.timeLabel)}</span>}
            {h.note && <div className="text-[11px] text-muted pl-2">💬 {h.note}</div>}
          </div>
        ))}
      </div>
    ) : null;

  return (
    <div className="mx-5 mt-4 rounded-md border border-hairline p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12px] text-muted">방문 예약</div>
          <div className="mt-0.5 text-[15px] font-bold text-ink tabular-nums">
            📅 {sbNum(SBUI.dateTime, label)}
          </div>
        </div>
        <span
          className={`shrink-0 inline-flex items-center px-2 py-1 rounded-pill text-[11px] font-semibold ${
            confirmed ? "bg-successSoft text-successStrong" : "bg-sunken text-muted"
          }`}
        >
          {statusLabel}
        </span>
      </div>
      <p className="mt-1.5 text-[12px] text-muted leading-[1.5]">
        {confirmed
          ? "예약이 확정되었어요 · 예약 시간에 방문해 QR을 제시해주세요. 취소는 방문 전날까지 가능해요."
          : "사장님이 예약을 확인하면 알림을 드려요."}
      </p>

      {/* 조율 이력 (§9-2) — 확정(QR 발급) 후에는 접힌 형태, 확정 전에는 펼쳐 노출 */}
      {historyBlock &&
        (confirmed ? (
          <details className="mt-2.5">
            <summary className="cp-action text-[12px] font-semibold text-muted cursor-pointer">예약 조율 이력 보기</summary>
            <div className="mt-1.5">{historyBlock}</div>
          </details>
        ) : (
          <div className="mt-2.5">{historyBlock}</div>
        ))}

      {/* 예약 변경 — 예약 대기 중 1회만 (§3-3). 소진·재요청·확정 후 비활성 */}
      {canChange && !editing && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="cp-action mt-3 h-9 px-3.5 rounded-sm border border-hairline bg-canvas text-[13px] font-semibold text-ink"
        >
          예약 변경하기
        </button>
      )}
      {!confirmed && (changeUsed || counterUsed) && (
        <button disabled className="mt-3 h-9 px-3.5 rounded-sm bg-sunken text-[13px] font-semibold text-mutedSoft">
          예약 변경하기
        </button>
      )}
      {!confirmed && changeUsed && (
        <p className="mt-1.5 text-[11px] text-muted">예약 변경은 1회만 가능해요 · 일정이 어려우면 취소 후 다시 신청해주세요.</p>
      )}

      {canChange && editing && (
        <div className="mt-3">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={newDate}
              onChange={(e) => {
                setNewDate(e.target.value);
                setNewTime("");
              }}
              aria-label="변경할 방문 날짜"
              className="h-10 px-3 rounded-sm border border-hairline bg-canvas text-[13px] text-ink"
            >
              {picker.dates.map((d) => (
                <option key={d.date} value={d.date} disabled={d.disabled}>
                  {d.label}
                  {d.disabled ? " (예약 불가)" : ""}
                </option>
              ))}
            </select>
            <select
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              aria-label="변경할 방문 시간"
              className={`h-10 px-3 rounded-sm border border-hairline bg-canvas text-[13px] ${newTime ? "text-ink" : "text-mutedSoft"}`}
            >
              <option value="">시간 선택</option>
              {slots.map((t) => (
                <option key={t.time} value={t.time} disabled={t.disabled}>
                  {t.label}
                  {t.disabled ? " (마감)" : ""}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            변경은 1회만 가능해요 · 변경하면 예약이 다시 확인 대기 상태가 되고, 체험권 기한도 새 방문일로 조정돼요.
          </p>
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
              disabled={busy || !newDate || !newTime}
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
