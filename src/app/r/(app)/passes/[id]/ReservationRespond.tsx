"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SBUI, sbNum } from "@/lib/storyboard";
import { ReservationNotes, type RsvPicker } from "./ReservationPanel";

/**
 * 사장님 시간 제안 응답 (2026-07-23 시안) — 예약 대기(제안 도착) 화면.
 *  오렌지 카드(제안 안내) + 사장님 추가 안내사항 + 라디오 최대 4행(제안 3 + 기타 직접 입력, 우측 라디오)
 *  → [예약 확정하기] / [제안한 시간이 모두 맞지않아 취소할게요] (취소 = 무패널티 — proposal_declined)
 */
export default function ReservationRespond({
  passId,
  slots,
  note,
  picker,
  counterUsed = false,
}: {
  passId: string;
  slots: Array<{ date: string; time: string; label: string }>; // 최대 3
  note?: string;
  // 기타(직접 입력) 선택지 — 서버가 캠페인 스케줄·차단·정원 기준으로 계산 (§3-2)
  picker: RsvPicker;
  // 재제안 1회 소진 여부 — 소진 시 기타(직접 입력) 행 미노출 (수락/거절만)
  counterUsed?: boolean;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<string>(""); // "0"|"1"|"2"|"etc"
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");
  const [declining, setDeclining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const customSlots = picker.slotsByDate[customDate] ?? [];

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

  // 우측 라디오 원 (2026-07-23 시안)
  const radio = (selected: boolean) => (
    <span
      className={`w-6 h-6 rounded-full shrink-0 ${
        selected ? "border-[7px] border-brand bg-canvas" : "border-[1.5px] border-borderStrong bg-canvas"
      }`}
    />
  );

  return (
    <div className="mt-5">
      {/* 제안 도착 안내 — 오렌지 카드 (아이콘 원형 + 제목 + 설명) */}
      <div className="rounded-lg bg-warningSoft px-4 py-4 flex items-start gap-3">
        <span className="w-11 h-11 rounded-full bg-canvas grid place-items-center text-[20px] shrink-0" aria-hidden>
          🗓
        </span>
        <div className="min-w-0">
          <div className="text-[15px] font-bold text-[#FF6B00]">사장님이 다른 방문 시간을 제안했어요</div>
          <p className="mt-1 text-[13px] text-ink2 leading-[1.55]">
            제안된 시간을 수락하면 예약이 확정되고 체험권 QR이 발급돼요.
          </p>
        </div>
      </div>

      {/* 사장님 추가 안내사항 — 원문 노출 */}
      {note && (
        <div className="mt-3 rounded-lg bg-sunken px-4 py-3.5">
          <div className="text-[13px] font-bold text-ink">💬 사장님 추가 안내사항</div>
          <p className="mt-1.5 text-[13px] text-ink2 leading-[1.6] whitespace-pre-line">{note}</p>
        </div>
      )}

      {/* 라디오 — 제안 슬롯(최대 3) + 기타(직접 입력) = 최대 4행, 라디오는 우측 */}
      <div className="mt-4 space-y-2.5">
        {slots.map((sl, i) => {
          const isSel = choice === String(i);
          return (
            <button
              key={`${sl.date}T${sl.time}`}
              type="button"
              onClick={() => setChoice(String(i))}
              aria-pressed={isSel}
              className={`w-full rounded-lg px-4 py-4 flex items-center justify-between gap-3 bg-canvas text-left ${
                isSel ? "border-[1.5px] border-brand" : "border border-hairline"
              }`}
            >
              <span className="text-[15px] font-semibold text-ink tabular-nums">{sbNum(SBUI.dateTime, sl.label)}</span>
              {radio(isSel)}
            </button>
          );
        })}
        {/* 기타 행 — 재제안은 1회만 가능(v3). 소진 시 미노출 (수락 또는 취소만) */}
        {!counterUsed && (
          <div
            role="radio"
            aria-checked={isEtc}
            tabIndex={0}
            onClick={() => setChoice("etc")}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setChoice("etc")}
            className={`w-full rounded-lg px-4 py-4 bg-canvas text-left cursor-pointer ${
              isEtc ? "border-[1.5px] border-brand" : "border border-hairline"
            }`}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="text-[15px] font-semibold text-ink">다른 시간을 직접 입력할게요</span>
              {radio(isEtc)}
            </span>
            {isEtc && (
              <div className="mt-3 grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                <select
                  value={customDate}
                  onChange={(e) => {
                    setCustomDate(e.target.value);
                    setCustomTime("");
                  }}
                  aria-label="기타 방문 날짜"
                  className={`h-11 px-3 rounded-sm border border-hairline bg-canvas text-[13px] ${customDate ? "text-ink" : "text-mutedSoft"}`}
                >
                  <option value="">날짜 선택</option>
                  {picker.dates.map((d) => (
                    <option key={d.date} value={d.date} disabled={d.disabled}>
                      {d.label}
                      {d.disabled ? " (예약 불가)" : ""}
                    </option>
                  ))}
                </select>
                <select
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  aria-label="기타 방문 시간"
                  className={`h-11 px-3 rounded-sm border border-hairline bg-canvas text-[13px] ${customTime ? "text-ink" : "text-mutedSoft"}`}
                >
                  <option value="">시간 선택</option>
                  {customSlots.map((t) => (
                    <option key={t.time} value={t.time} disabled={t.disabled}>
                      {t.label}
                      {t.disabled ? " (마감)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {err && <p className="mt-3 text-[13px] text-error">{err}</p>}

      {/* CTA — 수락 = 즉시 확정·QR / 기타 = 재요청(1회) */}
      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="cp-action mt-4 w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
      >
        {busy ? "처리 중..." : isEtc ? "이 시간으로 다시 요청하기" : "예약 확정하기"}
      </button>

      {/* 취소 — 제안 시간 모두 불가 (무패널티 — proposal_declined) */}
      {!declining ? (
        <button
          type="button"
          onClick={() => setDeclining(true)}
          className="cp-action mt-2 w-full h-[52px] rounded-md border border-hairline bg-canvas text-[15px] font-semibold text-ink"
        >
          제안한 시간이 모두 맞지않아 취소할게요
        </button>
      ) : (
        <div className="mt-2 rounded-md bg-sunken px-4 py-3.5">
          <p className="text-[13px] text-ink2 leading-[1.5]">
            신청을 취소할까요? 일정이 맞지 않은 취소라 <b>패널티나 재신청 제한이 없어요</b> — 언제든 다시 신청할 수 있어요.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => setDeclining(false)}
              className="cp-action h-10 px-4 rounded-sm bg-canvas border border-hairline text-[13px] font-semibold text-ink"
            >
              돌아가기
            </button>
            <button
              type="button"
              onClick={() => respond({ action: "decline" })}
              disabled={busy}
              className="cp-action h-10 px-4 rounded-sm bg-errorSoft text-error text-[13px] font-bold disabled:opacity-60"
            >
              {busy ? "취소 중..." : "취소하기"}
            </button>
          </div>
        </div>
      )}

      <ReservationNotes />
    </div>
  );
}
