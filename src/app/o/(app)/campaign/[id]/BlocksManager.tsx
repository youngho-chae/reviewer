"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// 예약 가능 일정 관리 (2026-07-22 §6) — 예약형 캠페인 전용.
//  - 당일 예약 일시중지 (오늘 남은 시간 전체 차단 — 자정 자연 해제 · 직접 해제 가능)
//  - 특정 날짜 차단·해제 (기존 예약이 있으면 경고 — 확정 예약은 자동 취소하지 않음, 개별 취소 안내)
//  - 특정 시간 차단·해제 (외부 예약 플랫폼에서 예약이 들어온 시간 수동 반영)
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
  const [slotDate, setSlotDate] = useState("");
  const [slotTime, setSlotTime] = useState("");
  const [warnSlot, setWarnSlot] = useState(false);

  const timeLabel = useMemo(() => Object.fromEntries(times.map((t) => [t.time, t.label])), [times]);

  async function act(body: Record<string, unknown>) {
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
      return;
    }
    setWarnDate(null);
    setWarnSlot(false);
    router.refresh();
  }

  return (
    <div className="mt-3 space-y-4">
      {/* 당일 예약 일시중지 (§6-3) */}
      <div className="rounded-md border border-hairline p-3.5 flex items-center justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold text-ink">당일 예약 일시중지</div>
          <p className="mt-0.5 text-[11px] text-muted leading-[1.5]">
            오늘 남은 예약 시간을 모두 막아요 · 이미 확정된 예약은 유지되고, 자정이 지나면 자동 해제돼요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => act({ action: pausedToday ? "resume_today" : "pause_today" })}
          disabled={busy}
          aria-pressed={pausedToday}
          className={`cp-action shrink-0 h-9 px-4 rounded-sm text-[13px] font-bold disabled:opacity-60 ${
            pausedToday ? "bg-errorSoft text-error" : "border border-hairline bg-canvas text-ink"
          }`}
        >
          {pausedToday ? "중지 해제" : "일시중지"}
        </button>
      </div>

      {/* 날짜 차단 (§6-1) — 14일 캘린더 스트립. 예약 존재 시 경고 후 차단 */}
      <div className="rounded-md border border-hairline p-3.5">
        <div className="text-[13px] font-semibold text-ink">날짜 차단</div>
        <p className="mt-0.5 text-[11px] text-muted">휴무·대관 등으로 받을 수 없는 날을 눌러 차단·해제하세요.</p>
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
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
              className={`shrink-0 h-14 min-w-[64px] px-2 rounded-md text-[12px] font-semibold leading-tight ${
                d.dayOff
                  ? "bg-sunken text-mutedSoft"
                  : d.blocked
                    ? "bg-errorSoft text-error"
                    : "border border-hairline bg-canvas text-ink"
              }`}
            >
              {d.label}
              <div className="mt-0.5 text-[10px] font-normal">
                {d.dayOff ? "휴무 요일" : d.blocked ? "차단됨" : d.resCount > 0 ? `예약 ${d.resCount}건` : "예약 가능"}
              </div>
            </button>
          ))}
        </div>
        {warnDate && (
          <div className="mt-2 rounded-sm bg-warningSoft px-3 py-2.5">
            <p className="text-[12px] text-ink2 leading-[1.5]">
              이 날짜에 진행 중인 예약이 있어요. 차단해도 <b>기존 예약은 자동 취소되지 않아요</b> — 받을 수 없는 예약은 위
              목록에서 개별 취소해주세요.
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

      {/* 시간 차단 (§6-2) — 특정 날짜의 일부 시간만 차단 (외부 플랫폼 예약 수동 반영) */}
      <div className="rounded-md border border-hairline p-3.5">
        <div className="text-[13px] font-semibold text-ink">시간 차단</div>
        <p className="mt-0.5 text-[11px] text-muted">
          날짜 전체 대신 특정 시간만 막아요 · 네이버 예약 등 외부 플랫폼 예약이 들어온 시간을 반영할 때 사용하세요.
        </p>
        <div className="mt-2.5 flex gap-1.5">
          <select
            value={slotDate}
            onChange={(e) => {
              setSlotDate(e.target.value);
              setSlotTime("");
              setWarnSlot(false);
            }}
            aria-label="차단할 날짜"
            className={`flex-1 h-9 px-2 rounded-sm border border-hairline bg-canvas text-[12px] ${slotDate ? "text-ink" : "text-mutedSoft"}`}
          >
            <option value="">날짜</option>
            {days
              .filter((d) => !d.dayOff && !d.blocked)
              .map((d) => (
                <option key={d.date} value={d.date}>
                  {d.label}
                </option>
              ))}
          </select>
          <select
            value={slotTime}
            onChange={(e) => {
              setSlotTime(e.target.value);
              setWarnSlot(false);
            }}
            aria-label="차단할 시간"
            className={`w-[110px] h-9 px-2 rounded-sm border border-hairline bg-canvas text-[12px] ${slotTime ? "text-ink" : "text-mutedSoft"}`}
          >
            <option value="">시간</option>
            {times.map((t) => (
              <option key={t.time} value={t.time}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !slotDate || !slotTime}
            onClick={() => {
              if ((slotResCounts[`${slotDate}|${slotTime}`] ?? 0) > 0) {
                setWarnSlot(true); // 예약 요청·확정이 있는 시간 — 경고 (§6-2)
              } else {
                act({ action: "block_slot", date: slotDate, time: slotTime });
              }
            }}
            className="cp-action shrink-0 h-9 px-3.5 rounded-sm bg-ink text-white text-[12px] font-bold disabled:opacity-40"
          >
            차단
          </button>
        </div>
        {warnSlot && (
          <div className="mt-2 rounded-sm bg-warningSoft px-3 py-2.5">
            <p className="text-[12px] text-ink2 leading-[1.5]">
              이 시간에 진행 중인 예약이 있어요. 차단해도 기존 예약은 유지돼요 — 받을 수 없다면 개별 취소해주세요.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setWarnSlot(false)}
                className="cp-action h-8 px-3 rounded-sm border border-hairline bg-canvas text-[12px] font-semibold text-ink"
              >
                돌아가기
              </button>
              <button
                type="button"
                onClick={() => act({ action: "block_slot", date: slotDate, time: slotTime })}
                disabled={busy}
                className="cp-action h-8 px-3.5 rounded-sm bg-errorSoft text-error text-[12px] font-bold disabled:opacity-60"
              >
                그래도 차단
              </button>
            </div>
          </div>
        )}
        {blockedSlots.length > 0 && (
          <div className="mt-2.5 space-y-1.5">
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
    </div>
  );
}
