"use client";
import { useMemo, useState } from "react";
import { SBUI, sbNum } from "@/lib/storyboard";
import type { ReservationPicker } from "@/lib/reservation";

// 예약 신청 바텀시트 (2026-07-23 시안) — "언제 방문할까요?"
//  요약(참여 채널·등급·지원 금액) + [예약 날짜]→캘린더 모달 + [예약 시간]→오전/오후 칩 모달 + 인원 스테퍼.
//  예약 가능 시작일(opensAt)은 캘린더에서 이전 날짜만 비활성 — 신청 시도 자체는 언제든 가능 (2026-07-23 정정).
export default function ReserveSheet({
  channelLabel,
  gradeLabel,
  supportText,
  picker,
  busy,
  err,
  onClose,
  onSubmit,
}: {
  channelLabel: string;
  gradeLabel: string;
  supportText: string; // 스토리보드 마스킹 완료 문자열
  picker: ReservationPicker;
  busy: boolean;
  err: string | null;
  onClose: () => void;
  onSubmit: (date: string, time: string, partySize: number) => void;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [party, setParty] = useState(1);
  const [modal, setModal] = useState<null | "date" | "time">(null);

  const dateLabel = useMemo(() => picker.dates.find((d) => d.date === date)?.label ?? "", [picker, date]);
  const timeLabel = useMemo(
    () => picker.slotsByDate[date]?.find((t) => t.time === time)?.label ?? "",
    [picker, date, time],
  );
  const canSubmit = !busy && !!date && !!time;

  return (
    <div className="fixed inset-0 bg-ink/45 z-50 flex items-end" onClick={onClose}>
      <div className="bg-canvas w-full max-w-[480px] mx-auto rounded-t-xl p-6 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pb-3">
          <span className="w-9 h-1 rounded-pill bg-borderStrong" />
        </div>
        <h2 className="text-[19px] font-bold text-ink tracking-title">언제 방문할까요?</h2>

        {/* 요약 — 참여 채널 · 채널 등급 · 지원 금액 */}
        <div className="mt-4 space-y-2.5 text-[14px]">
          <div className="flex justify-between">
            <span className="text-muted">참여 채널</span>
            <span className="text-ink font-semibold">{channelLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">채널 등급</span>
            <span className="text-ink font-semibold">{gradeLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">지원 금액</span>
            <span className="text-ink font-bold tabular-nums">{supportText}</span>
          </div>
        </div>

        {/* 예약 날짜 · 예약 시간 필드 — 탭하면 모달, 시간은 날짜 선택 후 활성 */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setModal("date")}
            className={`cp-action rounded-md border px-3.5 py-3 text-left ${date ? "border-hairline" : "border-hairline"}`}
          >
            <div className="text-[12px] font-semibold text-ink">예약 날짜</div>
            <div className={`mt-0.5 text-[14px] tabular-nums ${date ? "text-ink font-semibold" : "text-mutedSoft"}`}>
              {date ? sbNum(SBUI.dateTime, dateLabel) : "날짜를 선택해주세요"}
            </div>
          </button>
          <button
            type="button"
            disabled={!date}
            onClick={() => setModal("time")}
            className={`cp-action rounded-md border border-hairline px-3.5 py-3 text-left ${!date ? "bg-sunken" : ""}`}
          >
            <div className={`text-[12px] font-semibold ${date ? "text-ink" : "text-mutedSoft"}`}>예약 시간</div>
            <div className={`mt-0.5 text-[14px] tabular-nums ${time ? "text-ink font-semibold" : "text-mutedSoft"}`}>
              {time ? sbNum(SBUI.dateTime, timeLabel) : "시간을 선택해주세요"}
            </div>
          </button>
        </div>

        {/* 인원 스테퍼 (1~10 — 사장님 예약 큐에 표시) */}
        <div className="mt-4">
          <div className="text-[12px] font-semibold text-ink">인원</div>
          <div className="mt-1.5 rounded-md border border-hairline px-3 h-12 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setParty((n) => Math.max(1, n - 1))}
              disabled={party <= 1}
              aria-label="인원 줄이기"
              className="cp-action w-9 h-9 rounded-sm text-[18px] text-ink disabled:text-mutedSoft"
            >
              −
            </button>
            <span className="text-[16px] font-bold text-ink tabular-nums">{party}</span>
            <button
              type="button"
              onClick={() => setParty((n) => Math.min(10, n + 1))}
              disabled={party >= 10}
              aria-label="인원 늘리기"
              className="cp-action w-9 h-9 rounded-sm text-[18px] text-ink disabled:text-mutedSoft"
            >
              +
            </button>
          </div>
        </div>

        {/* 자동 취소 기한 사전 안내 (2026-08-30) — 대기/제안 화면 유의 불릿(ReservationNotes)과 동일 카피,
            신청 시점부터 기한 존재를 고지해 R-9 사후 통보가 첫 안내가 되지 않게 한다 */}
        <p className="mt-3 text-[12px] text-muted leading-[1.6]">
          · 사장님 승인 후 알림과 함께 체험권 QR이 발급돼요.
          <br />· 방문 희망 시간까지 확정되지 않으면 신청이 자동 취소돼요. 페널티 없이 다시 신청할 수 있어요.
        </p>
        {err && <p className="mt-2 text-[12px] text-error leading-[1.5]">{err}</p>}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="cp-action h-[52px] px-6 rounded-md bg-sunken text-[15px] font-semibold text-ink"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => canSubmit && onSubmit(date, time, party)}
            disabled={!canSubmit}
            className="cp-action flex-1 h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
          >
            {busy ? "요청 중..." : "예약 요청하기"}
          </button>
        </div>
      </div>

      {modal === "date" && (
        <CalendarModal
          dates={picker.dates}
          value={date}
          onClose={() => setModal(null)}
          onNext={(d) => {
            if (d !== date) setTime(""); // 날짜가 바뀌면 시간 선택지도 바뀐다
            setDate(d);
            setModal("time");
          }}
        />
      )}
      {modal === "time" && date && (
        <TimeModal
          slots={picker.slotsByDate[date] ?? []}
          value={time}
          onClose={() => setModal(null)}
          onDone={(t) => {
            setTime(t);
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

const KO_WEEK = ["일", "월", "화", "수", "목", "금", "토"];

// 날짜 선택 캘린더 — 바텀 시트 (2026-07-23 v2: 중앙 모달 → 바텀 시트).
// 선택 가능일만 활성, 과거·오픈 전·휴무·차단·범위 밖은 흐림
function CalendarModal({
  dates,
  value,
  onClose,
  onNext,
}: {
  dates: ReservationPicker["dates"];
  value: string;
  onClose: () => void;
  onNext: (date: string) => void;
}) {
  const byDate = useMemo(() => new Map(dates.map((d) => [d.date, d])), [dates]);
  const months = useMemo(() => {
    const set = new Set(dates.map((d) => d.date.slice(0, 7))); // "YYYY-MM"
    return Array.from(set).sort();
  }, [dates]);
  const firstSelectableMonth = useMemo(
    () => (dates.find((d) => !d.disabled)?.date ?? dates[0]?.date ?? "").slice(0, 7),
    [dates],
  );
  const [month, setMonth] = useState(value ? value.slice(0, 7) : firstSelectableMonth);
  const [sel, setSel] = useState(value);
  const mi = months.indexOf(month);

  // 해당 월 그리드 — 앞쪽 빈 칸 + 말일까지
  const grid = useMemo(() => {
    if (!month) return [];
    const [y, m] = month.split("-").map(Number);
    const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells: Array<{ date: string; day: number } | null> = Array.from({ length: firstDow }, () => null);
    for (let d = 1; d <= lastDay; d++) {
      cells.push({ date: `${month}-${String(d).padStart(2, "0")}`, day: d });
    }
    return cells;
  }, [month]);

  return (
    <div className="fixed inset-0 bg-ink/45 z-[60] flex items-end" onClick={onClose}>
      <div
        className="bg-canvas w-full max-w-[480px] mx-auto rounded-t-xl px-6 pt-3 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pb-3">
          <span className="w-9 h-1 rounded-pill bg-borderStrong" />
        </div>
        <div className="flex items-center justify-between">
          <h3 className="text-[17px] font-bold text-ink tracking-title">날짜 선택</h3>
          <button type="button" onClick={onClose} aria-label="닫기" className="cp-action w-9 h-9 rounded-full text-[16px] text-ink">
            ✕
          </button>
        </div>

        {/* 월 내비게이션 */}
        <div className="mt-2 flex items-center justify-between px-1">
          <button
            type="button"
            disabled={mi <= 0}
            onClick={() => setMonth(months[mi - 1])}
            aria-label="이전 달"
            className="cp-action w-9 h-9 rounded-full text-[15px] text-ink disabled:text-mutedSoft"
          >
            ‹
          </button>
          <div className="text-[15px] font-bold text-ink tabular-nums">
            {month ? `${Number(month.slice(0, 4))}년 ${Number(month.slice(5, 7))}월` : ""}
          </div>
          <button
            type="button"
            disabled={mi < 0 || mi >= months.length - 1}
            onClick={() => setMonth(months[mi + 1])}
            aria-label="다음 달"
            className="cp-action w-9 h-9 rounded-full text-[15px] text-ink disabled:text-mutedSoft"
          >
            ›
          </button>
        </div>

        <div className="mt-1 grid grid-cols-7 text-center text-[12px] text-muted">
          {KO_WEEK.map((w) => (
            <div key={w} className="py-1.5">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {grid.map((cell, i) => {
            if (!cell) return <div key={`e${i}`} />;
            const opt = byDate.get(cell.date);
            const selectable = !!opt && !opt.disabled;
            const isSel = sel === cell.date;
            return (
              <button
                key={cell.date}
                type="button"
                disabled={!selectable}
                onClick={() => setSel(cell.date)}
                aria-label={opt?.label ?? cell.date}
                aria-pressed={isSel}
                className={`cp-action mx-auto w-9 h-9 rounded-md text-[14px] tabular-nums grid place-items-center ${
                  isSel
                    ? "border-[1.5px] border-brand text-brand font-bold"
                    : selectable
                      ? "text-ink font-medium"
                      : "text-mutedSoft"
                }`}
              >
                {cell.day}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={!sel}
          onClick={() => sel && onNext(sel)}
          className="cp-action mt-4 w-full h-12 rounded-md bg-brand text-white text-[15px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
        >
          다음
        </button>
      </div>
    </div>
  );
}

// 시간 선택 — 바텀 시트 (2026-07-23 v2: 중앙 모달 → 바텀 시트).
// 오전/오후 그룹 칩 — 브레이크·차단·정원 마감·과거는 비활성(흐림)
function TimeModal({
  slots,
  value,
  onClose,
  onDone,
}: {
  slots: NonNullable<ReservationPicker["slotsByDate"][string]>;
  value: string;
  onClose: () => void;
  onDone: (time: string) => void;
}) {
  const [sel, setSel] = useState(value);
  const am = slots.filter((s) => Number(s.time.slice(0, 2)) < 12);
  const pm = slots.filter((s) => Number(s.time.slice(0, 2)) >= 12);
  // 칩 라벨 — 그룹 헤더가 오전/오후를 표기하므로 칩은 "9:00"/"12:30"/"1:30" 형태 (§7-2 12시간제)
  const chip = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")}`;
  };
  const group = (title: string, list: typeof slots) =>
    list.length > 0 && (
      <div className="mt-3">
        <div className="text-[13px] font-bold text-ink">{title}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {list.map((s) => {
            const isSel = sel === s.time;
            return (
              <button
                key={s.time}
                type="button"
                disabled={s.disabled}
                onClick={() => setSel(s.time)}
                aria-pressed={isSel}
                aria-label={s.label + (s.disabled ? " (선택 불가)" : "")}
                className={`cp-action h-9 px-3.5 rounded-pill text-[13px] tabular-nums font-semibold ${
                  isSel
                    ? "border-[1.5px] border-brand text-brand"
                    : s.disabled
                      ? "border border-hairlineSoft text-mutedSoft"
                      : "border border-hairline text-ink"
                }`}
              >
                {chip(s.time)}
              </button>
            );
          })}
        </div>
      </div>
    );

  return (
    <div className="fixed inset-0 bg-ink/45 z-[60] flex items-end" onClick={onClose}>
      <div
        className="bg-canvas w-full max-w-[480px] mx-auto rounded-t-xl px-6 pt-3 pb-8 max-h-[80dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pb-3">
          <span className="w-9 h-1 rounded-pill bg-borderStrong" />
        </div>
        <div className="flex items-center justify-between">
          <h3 className="text-[17px] font-bold text-ink tracking-title">시간 선택</h3>
          <button type="button" onClick={onClose} aria-label="닫기" className="cp-action w-9 h-9 rounded-full text-[16px] text-ink">
            ✕
          </button>
        </div>
        {group("오전", am)}
        {group("오후", pm)}
        {slots.every((s) => s.disabled) && (
          <p className="mt-3 text-[13px] text-muted">선택할 수 있는 시간이 없어요 — 다른 날짜를 선택해주세요.</p>
        )}
        <button
          type="button"
          disabled={!sel}
          onClick={() => sel && onDone(sel)}
          className="cp-action mt-5 w-full h-12 rounded-md bg-brand text-white text-[15px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
        >
          완료
        </button>
      </div>
    </div>
  );
}
