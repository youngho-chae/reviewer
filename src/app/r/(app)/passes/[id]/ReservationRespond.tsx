"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RESERVATION_TIME_SLOTS,
  reservationDateOptions,
  fmtReservationDateLabel,
} from "@/lib/reservation";
import { SBUI, sbNum } from "@/lib/storyboard";

/**
 * 사장님 시간 제안 응답 (2026-07-16 예약형 v2) — 체험권 상세(확정 전)에서 노출.
 * 라디오 최대 4행: 제안 슬롯(최대 3) + 기타(직접 입력).
 *  - 제안 슬롯 수락  → 예약 확정 + 체험권(QR) 활성화
 *  - 기타 직접 입력 → 새 희망 시간으로 재요청 (확인 대기 복귀)
 *  - 거절           → 이용 취소 (패널티·재신청 제한 없음)
 */
export default function ReservationRespond({
  passId,
  slots,
  note,
  endAt,
}: {
  passId: string;
  slots: Array<{ date: string; time: string; label: string }>; // 최대 3
  note?: string;
  endAt: number;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<string>(""); // "0"|"1"|"2"|"etc"
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");
  const [declining, setDeclining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dates = useMemo(() => reservationDateOptions(endAt), [endAt]);

  const isEtc = choice === "etc";
  const canSubmit = !busy && choice !== "" && (!isEtc || (!!customDate && !!customTime));

  async function respond(body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/passes/reservation-respond", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passId, ...body }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "처리에 실패했어요.");
      setBusy(false);
      return;
    }
    setBusy(false);
    router.refresh();
  }

  function submit() {
    if (!canSubmit) return;
    if (isEtc) {
      respond({ action: "counter", date: customDate, time: customTime });
    } else {
      const sl = slots[Number(choice)];
      respond({ action: "accept", date: sl.date, time: sl.time });
    }
  }

  return (
    <div className="mx-5 mt-4 rounded-md border border-brand p-4">
      <div className="text-[15px] font-bold text-ink">사장님이 다른 방문 시간을 제안했어요</div>
      {note && (
        <div className="mt-2 rounded-sm bg-sunken px-3 py-2.5 text-[13px] text-ink2 leading-[1.55] whitespace-pre-line">
          💬 {note}
        </div>
      )}

      {/* 라디오 — 제안 슬롯(최대 3) + 기타(직접 입력) = 최대 4행 */}
      <div className="mt-3 space-y-2">
        {slots.map((sl, i) => {
          const isSel = choice === String(i);
          return (
            <button
              key={`${sl.date}T${sl.time}`}
              type="button"
              onClick={() => setChoice(String(i))}
              aria-pressed={isSel}
              className={`w-full rounded-md px-4 py-3 flex items-center gap-3 bg-canvas text-left ${
                isSel ? "border-[1.5px] border-brand" : "border border-hairline"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full shrink-0 ${
                  isSel ? "border-[6px] border-brand bg-canvas" : "border-[1.5px] border-borderStrong bg-canvas"
                }`}
              />
              <span className="text-[15px] font-semibold text-ink tabular-nums">
                📅 {sbNum(SBUI.dateTime, sl.label)}
              </span>
            </button>
          );
        })}
        {/* 기타 행 — 내부에 select가 있어 button 중첩 대신 role="radio" 컨테이너로 구성 */}
        <div
          role="radio"
          aria-checked={isEtc}
          tabIndex={0}
          onClick={() => setChoice("etc")}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setChoice("etc")}
          className={`w-full rounded-md px-4 py-3 bg-canvas text-left cursor-pointer ${
            isEtc ? "border-[1.5px] border-brand" : "border border-hairline"
          }`}
        >
          <span className="flex items-center gap-3">
            <span
              className={`w-5 h-5 rounded-full shrink-0 ${
                isEtc ? "border-[6px] border-brand bg-canvas" : "border-[1.5px] border-borderStrong bg-canvas"
              }`}
            />
            <span className="text-[15px] font-semibold text-ink">기타 — 다른 시간을 직접 입력할게요</span>
          </span>
          {isEtc && (
            <div className="mt-2.5 grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
              <select
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                aria-label="기타 방문 날짜"
                className={`h-10 px-3 rounded-sm border border-hairline bg-canvas text-[13px] ${customDate ? "text-ink" : "text-mutedSoft"}`}
              >
                <option value="">날짜 선택</option>
                {dates.map((d) => (
                  <option key={d} value={d}>
                    {fmtReservationDateLabel(d)}
                  </option>
                ))}
              </select>
              <select
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                aria-label="기타 방문 시간"
                className={`h-10 px-3 rounded-sm border border-hairline bg-canvas text-[13px] ${customTime ? "text-ink" : "text-mutedSoft"}`}
              >
                <option value="">시간 선택</option>
                {RESERVATION_TIME_SLOTS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
      <p className="mt-2 text-[12px] text-muted leading-[1.5]">
        {isEtc
          ? "직접 입력한 시간은 사장님이 다시 확인한 뒤 확정돼요."
          : "제안된 시간을 수락하면 예약이 확정되고 체험권(QR)이 열려요."}
      </p>

      {err && <p className="mt-2 text-[12px] text-error">{err}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="cp-action mt-3 w-full h-11 rounded-md bg-brand text-white text-[15px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
      >
        {busy ? "처리 중..." : isEtc ? "이 시간으로 다시 요청하기" : "이 시간으로 예약 확정하기"}
      </button>

      {/* 거절 — 이용 취소 (패널티·재신청 제한 없음) */}
      {!declining ? (
        <button
          type="button"
          onClick={() => setDeclining(true)}
          className="cp-action mt-2 w-full h-10 rounded-md text-[13px] font-semibold text-muted"
        >
          제안된 시간이 모두 안 맞아요 (신청 취소)
        </button>
      ) : (
        <div className="mt-2 rounded-md bg-sunken px-3.5 py-3">
          <p className="text-[13px] text-ink2 leading-[1.5]">
            신청을 취소할까요? 일정이 맞지 않은 취소라 <b>패널티나 재신청 제한이 없어요</b> — 언제든 다시 신청할 수 있어요.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => setDeclining(false)}
              className="cp-action h-9 px-3.5 rounded-sm bg-canvas border border-hairline text-[13px] font-semibold text-ink"
            >
              돌아가기
            </button>
            <button
              type="button"
              onClick={() => respond({ action: "decline" })}
              disabled={busy}
              className="cp-action h-9 px-4 rounded-sm bg-errorSoft text-error text-[13px] font-bold disabled:opacity-60"
            >
              {busy ? "취소 중..." : "거절하고 취소하기"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
