"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export interface RsvDateOption {
  date: string;
  label: string; // "7월 18일 (토)"
  disabled: boolean;
}
export interface RsvSlotOption {
  time: string;
  label: string; // "오후 2시" (12시간제 — §7-2)
  disabled: boolean;
  reason?: string;
}
// 날짜·시간 선택지 — 서버가 캠페인 스케줄·차단·정원 기준으로 계산해 전달 (reservation.ts ReservationPicker)
export type RsvPicker = {
  dates: RsvDateOption[];
  slotsByDate: Record<string, RsvSlotOption[]>;
};

// 예약 유의 불릿 (2026-07-23 시안) — 예약 대기·제안 화면 공용
export function ReservationNotes() {
  return (
    <ul className="mt-4 space-y-1.5 text-[13px] text-muted leading-[1.55]">
      <li className="flex gap-2"><span className="shrink-0">·</span><span>예약 변경은 1번만 가능해요.</span></li>
      <li className="flex gap-2"><span className="shrink-0">·</span><span>사장님 승인 후 알림과 함께 체험권 QR이 발급돼요.</span></li>
      <li className="flex gap-2">
        <span className="shrink-0">·</span>
        <span>사장님이 다른 방문 시간을 제안하고 일정이 맞지 않아 취소하는 경우 패널티나 재신청 제한이 없어요.</span>
      </li>
    </ul>
  );
}

/**
 * 예약 변경 (2026-07-23 시안 — 예약 대기 화면) — [예약 변경] 대형 버튼 + 인라인 일시 선택.
 * 변경은 사장님이 제안하기 전(requested) **1회만** 가능하다(§3-3) — 소진·재요청 후엔 비활성.
 */
export default function ReservationPanel({
  passId,
  date,
  time,
  changeUsed,
  counterUsed,
  picker,
}: {
  passId: string;
  date: string;
  time: string;
  changeUsed: boolean; // 희망 일정 변경 1회 소진 (§3-3)
  counterUsed: boolean; // 제안 후 기타 재요청 소진 — 이후 변경 불가
  picker: RsvPicker;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [newDate, setNewDate] = useState(date);
  const [newTime, setNewTime] = useState(time);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const canChange = !changeUsed && !counterUsed;
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

  return (
    <div className="mt-5">
      {!editing ? (
        <button
          type="button"
          onClick={() => canChange && setEditing(true)}
          disabled={!canChange}
          className="cp-action w-full h-[52px] rounded-md bg-ink text-white text-[16px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
        >
          예약 변경
        </button>
      ) : (
        <div className="rounded-md border border-hairline p-4">
          <div className="text-[13px] font-bold text-ink">변경할 방문 일시</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <select
              value={newDate}
              onChange={(e) => {
                setNewDate(e.target.value);
                setNewTime("");
              }}
              aria-label="변경할 방문 날짜"
              className="h-11 px-3 rounded-sm border border-hairline bg-canvas text-[13px] text-ink"
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
              className={`h-11 px-3 rounded-sm border border-hairline bg-canvas text-[13px] ${newTime ? "text-ink" : "text-mutedSoft"}`}
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
          {err && <p className="mt-2 text-[12px] text-error">{err}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="cp-action h-11 px-4 rounded-md bg-sunken text-[14px] font-semibold text-ink"
            >
              취소
            </button>
            <button
              type="button"
              onClick={change}
              disabled={busy || !newDate || !newTime}
              className="cp-action flex-1 h-11 rounded-md bg-ink text-white text-[14px] font-bold disabled:opacity-60"
            >
              {busy ? "변경 중..." : "이 일시로 변경 (1회)"}
            </button>
          </div>
        </div>
      )}
      {!canChange && (
        <p className="mt-2 text-[12px] text-muted">
          {counterUsed ? "재요청한 일정은 변경할 수 없어요 — 사장님 응답을 기다려주세요." : "예약 변경 1회를 이미 사용했어요."}
        </p>
      )}
      <ReservationNotes />
    </div>
  );
}
