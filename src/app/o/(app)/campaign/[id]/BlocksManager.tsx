"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// 예약 가능 일정 관리 (2026-07-22 §6 · 2026-07-31 시안 재작업) — 예약형 캠페인 전용.
//  - 당일 예약 일시 중지: 토글 스위치 (오늘 남은 시간 전체 차단 — 자정 자연 해제)
//  - 날짜 차단: 14일 칩 (기존 예약이 있으면 경고 — 확정 예약은 자동 취소하지 않음)
//  - 특정 시간 차단: [일정 선택] 시트에서 날짜+시간(다중 선택 — 2026-08-18) → 차단 목록 (외부 플랫폼 예약 수동 반영)
export default function BlocksManager({
  campaignId,
  days,
  times,
  blockedSlots,
  slotResCounts,
  pausedToday,
}: {
  campaignId: string;
  days: Array<{ date: string; label: string; dayOff: boolean; blocked: boolean; resCount: number }>;
  times: Array<{ time: string; label: string }>;
  blockedSlots: Array<{ date: string; time: string }>;
  slotResCounts: Record<string, number>; // "date|time" → 살아있는 예약 수
  pausedToday: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [warnDate, setWarnDate] = useState<string | null>(null); // 예약 존재 날짜 차단 경고 (§6-1)
  const [sheetOpen, setSheetOpen] = useState(false); // 특정 시간 차단 — 일정 선택 시트 (시안)
  const [slotDate, setSlotDate] = useState("");
  const [slotTimes, setSlotTimes] = useState<string[]>([]); // 다중 선택 (2026-08-18)
  const [warnSlot, setWarnSlot] = useState(false);

  const timeLabel = useMemo(() => Object.fromEntries(times.map((t) => [t.time, t.label])), [times]);
  const selectableDays = days.filter((d) => !d.dayOff && !d.blocked);

  async function act(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/owner/reserve-blocks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaignId, ...body }),
    });
    setBusy(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "처리에 실패했어요.");
      return false;
    }
    setWarnDate(null);
    setWarnSlot(false);
    router.refresh();
    return true;
  }

  async function blockSlots(date: string, timesToBlock: string[]) {
    const ok = await act({ action: "block_slot", date, times: timesToBlock });
    if (ok) {
      setSheetOpen(false);
      setSlotDate("");
      setSlotTimes([]);
    }
  }

  // 선택 중 예약(요청·확정)이 있는 시간 — 차단 전 경고 대상 (§6-2)
  const conflictTimes = slotTimes.filter((tm) => (slotResCounts[`${slotDate}|${tm}`] ?? 0) > 0);

  return (
    <div className="mt-3 space-y-3">
      {/* 당일 예약 일시 중지 (§6-3) — 토글 (시안) */}
      <div className="rounded-lg border border-hairline p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[14px] font-bold text-ink">당일 예약 일시 중지</div>
          <button
            type="button"
            role="switch"
            aria-checked={pausedToday}
            aria-label="당일 예약 일시 중지"
            disabled={busy}
            onClick={() => act({ action: pausedToday ? "resume_today" : "pause_today" })}
            className={`cp-action shrink-0 w-11 h-[26px] rounded-pill p-[3px] transition-colors disabled:opacity-60 ${
              pausedToday ? "bg-brand" : "bg-borderStrong"
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${pausedToday ? "translate-x-[18px]" : ""}`}
            />
          </button>
        </div>
        <p className="mt-1.5 text-[12px] text-muted leading-[1.55]">
          오늘 남은 예약 시간을 모두 막아요.
          <br />
          이미 확정된 예약은 유지되고, 자정이 지나면 자동 해제돼요.
        </p>
      </div>

      {/* 날짜 차단 (§6-1) — 14일 칩. 예약 존재 시 경고 후 차단 */}
      <div className="rounded-lg border border-hairline p-4">
        <div className="text-[14px] font-bold text-ink">날짜 차단</div>
        <p className="mt-1 text-[12px] text-muted leading-[1.5]">휴무·대관 등으로 받을 수 없는 날을 눌러 차단·해제하세요.</p>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {days.map((d) => (
            <button
              key={d.date}
              type="button"
              disabled={busy || d.dayOff}
              onClick={() => {
                if (d.blocked) {
                  act({ action: "unblock_date", date: d.date });
                } else if (d.resCount > 0) {
                  setWarnDate(d.date); // 기존 예약 존재 — 경고 노출 (§6-1)
                } else {
                  act({ action: "block_date", date: d.date });
                }
              }}
              className={`shrink-0 min-w-[86px] px-3 py-2.5 rounded-md text-[13px] font-semibold leading-tight tabular-nums ${
                d.dayOff
                  ? "bg-sunken text-mutedSoft"
                  : d.blocked
                    ? "bg-errorSoft text-error"
                    : "bg-sunken text-ink"
              }`}
            >
              {d.label}
              <div className={`mt-1 text-[11px] font-normal ${d.dayOff ? "" : d.blocked ? "" : "text-muted"}`}>
                {d.dayOff ? "휴무일" : d.blocked ? "차단됨" : d.resCount > 0 ? `예약 ${d.resCount}건` : "예약 가능"}
              </div>
            </button>
          ))}
        </div>
        {warnDate && (
          <div className="mt-2 rounded-sm bg-warningSoft px-3 py-2.5">
            <p className="text-[12px] text-ink2 leading-[1.5]">
              이 날짜에 진행 중인 예약이 있어요. 차단해도 <b>기존 예약은 자동 취소되지 않아요</b> — 받을 수 없는 예약은
              예약 관리에서 개별 취소해주세요.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setWarnDate(null)}
                className="cp-action h-8 px-3 rounded-sm border border-hairline bg-canvas text-[12px] font-semibold text-ink"
              >
                돌아가기
              </button>
              <button
                type="button"
                onClick={() => act({ action: "block_date", date: warnDate })}
                disabled={busy}
                className="cp-action h-8 px-3.5 rounded-sm bg-errorSoft text-error text-[12px] font-bold disabled:opacity-60"
              >
                그래도 차단
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 특정 시간 차단 (§6-2) — [일정 선택] 시트 + 차단 목록 (시안) */}
      <div className="rounded-lg border border-hairline p-4">
        <div className="text-[14px] font-bold text-ink">특정 시간 차단</div>
        <p className="mt-1 text-[12px] text-muted leading-[1.5]">
          네이버 예약 등 외부 플랫폼 예약이 들어온 시간을 반영할 때 사용하세요.
        </p>
        <button
          type="button"
          onClick={() => {
            setSheetOpen(true);
            setWarnSlot(false);
          }}
          className="cp-action mt-3 w-full h-11 rounded-md border border-hairline bg-canvas text-[14px] font-semibold text-ink"
        >
          일정 선택
        </button>
        {blockedSlots.length === 0 ? (
          <p className="mt-3 text-center text-[12px] text-mutedSoft">선택된 일정이 없습니다.</p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {blockedSlots.map((s) => (
              <div
                key={`${s.date}T${s.time}`}
                className="flex items-center justify-between gap-2 rounded-sm bg-sunken px-3 py-2 text-[12px] text-ink2"
              >
                <span className="tabular-nums">
                  {days.find((d) => d.date === s.date)?.label ?? s.date} · {timeLabel[s.time] ?? s.time} 차단됨
                </span>
                <button
                  type="button"
                  onClick={() => act({ action: "unblock_slot", date: s.date, time: s.time })}
                  disabled={busy}
                  className="cp-action shrink-0 text-[12px] font-semibold text-brand disabled:opacity-60"
                >
                  해제
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {err && <p className="text-[12px] text-error">{err}</p>}

      {/* 일정 선택 시트 — 날짜 칩 + 시간 칩 → [차단하기] */}
      {sheetOpen && (
        <div className="fixed inset-0 bg-ink/45 z-50 flex items-end" onClick={() => !busy && setSheetOpen(false)}>
          <div className="w-full max-h-[85dvh] overflow-y-auto rounded-t-xl bg-canvas p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-3">
              <span className="w-9 h-1 rounded-pill bg-borderStrong" />
            </div>
            <h3 className="text-center text-[17px] font-bold text-ink tracking-title">차단할 일정 선택</h3>

            <div className="mt-4 text-[13px] font-semibold text-ink">날짜</div>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {selectableDays.map((d) => (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => {
                    setSlotDate(d.date);
                    setSlotTimes([]); // 날짜별로 차단 상태가 달라 선택 초기화
                    setWarnSlot(false);
                  }}
                  aria-pressed={slotDate === d.date}
                  className={`shrink-0 px-3 py-2 rounded-md text-[13px] font-semibold tabular-nums ${
                    slotDate === d.date ? "bg-brand text-white" : "bg-sunken text-ink"
                  }`}
                >
                  {d.label}
                </button>
              ))}
              {selectableDays.length === 0 && <p className="text-[12px] text-muted">선택할 수 있는 날짜가 없어요.</p>}
            </div>

            {/* 시간 — 다중 선택 토글 (2026-08-18): 여러 시간을 한 번에 차단 */}
            <div className="mt-4 flex items-baseline justify-between">
              <div className="text-[13px] font-semibold text-ink">시간</div>
              <span className="text-[11px] text-muted">여러 시간을 함께 선택할 수 있어요</span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {times.map((t) => {
                const blocked = blockedSlots.some((s) => s.date === slotDate && s.time === t.time);
                const selected = slotTimes.includes(t.time);
                return (
                  <button
                    key={t.time}
                    type="button"
                    disabled={!slotDate || blocked}
                    onClick={() => {
                      setSlotTimes((prev) => (prev.includes(t.time) ? prev.filter((x) => x !== t.time) : [...prev, t.time]));
                      setWarnSlot(false);
                    }}
                    aria-pressed={selected}
                    className={`h-9 rounded-sm text-[12px] font-semibold tabular-nums ${
                      selected
                        ? "bg-brand text-white"
                        : blocked
                          ? "bg-sunken text-mutedSoft line-through"
                          : "border border-hairline bg-canvas text-ink disabled:opacity-40"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {warnSlot && (
              <div className="mt-3 rounded-sm bg-warningSoft px-3 py-2.5">
                <p className="text-[12px] text-ink2 leading-[1.5]">
                  선택한 시간 중 <b className="tabular-nums">{conflictTimes.map((tm) => timeLabel[tm] ?? tm).join(" · ")}</b>에 진행
                  중인 예약이 있어요. 차단해도 기존 예약은 유지돼요 — 받을 수 없다면 개별 취소해주세요.
                </p>
                <button
                  type="button"
                  onClick={() => blockSlots(slotDate, slotTimes)}
                  disabled={busy}
                  className="cp-action mt-2 h-8 px-3.5 rounded-sm bg-errorSoft text-error text-[12px] font-bold disabled:opacity-60"
                >
                  그래도 차단
                </button>
              </div>
            )}

            <button
              type="button"
              disabled={busy || !slotDate || slotTimes.length === 0}
              onClick={() => {
                if (conflictTimes.length > 0) {
                  setWarnSlot(true); // 예약 요청·확정이 있는 시간 포함 — 경고 (§6-2)
                } else {
                  blockSlots(slotDate, slotTimes);
                }
              }}
              className="cp-action mt-5 w-full h-12 rounded-md bg-brand text-white text-[15px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
            >
              {busy ? "처리 중..." : slotTimes.length > 1 ? `${slotTimes.length}개 시간 차단하기` : "차단하기"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
