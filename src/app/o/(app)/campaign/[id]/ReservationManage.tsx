"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SBUI, sbNum } from "@/lib/storyboard";
import { PROPOSAL_MAX_SLOTS, PROPOSAL_NOTE_MAX } from "@/lib/reservation";

export interface ManageItem {
  passId: string;
  masked: string; // 익명 #last4 — 실명·등급 비노출 (확정 정책 8)
  label: string; // "7월 18일 (토) 오후 2시" (12시간제)
  partySize?: number;
  requestedAtLabel: string; // 예약 신청일 (§4-1)
  statusKey: "requested" | "proposed" | "confirmed" | "visited" | "cancelled" | "expired";
  statusLabel: string;
  subLabel?: string; // 취소 주체 등 운영 구분 (§5-4)
  epoch: number;
  history: Array<{ prefix: string; timeLabel: string; note?: string }>;
  proposalUsed: boolean;
}

const FILTERS: Array<{ key: "all" | ManageItem["statusKey"]; label: string }> = [
  { key: "all", label: "전체" },
  { key: "requested", label: "예약 대기" },
  { key: "proposed", label: "제안 중" },
  { key: "confirmed", label: "확정" },
  { key: "visited", label: "방문 완료" },
  { key: "cancelled", label: "취소·거절" },
];

type SlotDraft = { date: string; time: string };

// 캠페인별 예약 요청 목록 (§12-2) — 상태 필터 + 확정/다른 일정 제안/거절 + 확정 예약 취소(사유 필수 §5-3)
export default function ReservationManage({
  items,
  proposeDates,
  proposeTimes,
}: {
  items: ManageItem[];
  proposeDates: Array<{ date: string; label: string; disabled: boolean }>;
  proposeTimes: Array<{ time: string; label: string }>;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [proposingId, setProposingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [slots, setSlots] = useState<SlotDraft[]>([{ date: "", time: "" }]);
  const [note, setNote] = useState("");

  const shown = useMemo(
    () => (filter === "all" ? items : items.filter((it) => (filter === "cancelled" ? it.statusKey === "cancelled" || it.statusKey === "expired" : it.statusKey === filter))),
    [items, filter],
  );

  async function post(url: string, body: Record<string, unknown>, passId: string): Promise<boolean> {
    setBusyId(passId);
    setErr(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusyId(null);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "처리에 실패했어요.");
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <div className="mt-3">
      {/* 상태 필터 (§12-2) */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`shrink-0 h-8 px-3 rounded-pill text-[12px] font-semibold ${
              filter === f.key ? "bg-ink text-white" : "bg-canvas border border-hairline text-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-2 space-y-2.5">
        {shown.length === 0 && (
          <div className="rounded-md border border-dashed border-hairline p-5 text-center text-[13px] text-muted">
            해당 상태의 예약이 없어요.
          </div>
        )}
        {shown.map((it) => {
          const actionable = it.statusKey === "requested";
          return (
            <div key={it.passId} className="rounded-md border border-hairline p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-semibold text-ink">익명 {it.masked}</span>
                <span
                  className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-pill text-[11px] font-semibold ${
                    it.statusKey === "confirmed"
                      ? "bg-successSoft text-successStrong"
                      : it.statusKey === "proposed"
                        ? "bg-brandSoft text-brand"
                        : it.statusKey === "visited"
                          ? "bg-sunken text-ink2"
                          : it.statusKey === "cancelled" || it.statusKey === "expired"
                            ? "bg-sunken text-muted"
                            : "bg-warningSoft text-ink2"
                  }`}
                >
                  {it.statusLabel}
                </span>
              </div>
              <div className="mt-1 text-[14px] font-bold text-ink tabular-nums">
                📅 {sbNum(SBUI.dateTime, it.label)}
                {it.partySize ? ` · ${it.partySize}명` : ""}
              </div>
              <div className="mt-0.5 text-[11px] text-muted tabular-nums">신청 {sbNum(SBUI.dateTime, it.requestedAtLabel)}</div>
              {it.subLabel && <div className="mt-1 text-[12px] text-muted">{it.subLabel}</div>}

              {/* 조율 이력 — 확정 후에도 유지 (§9-3: CS·예약 착오 확인) */}
              {it.history.length > 1 && (
                <details className="mt-2">
                  <summary className="cp-action text-[12px] font-semibold text-muted cursor-pointer">조율 이력 보기</summary>
                  <div className="mt-1.5 rounded-sm bg-sunken px-3 py-2 space-y-1">
                    {it.history.map((h, i) => (
                      <div key={i} className="text-[12px] text-ink2 leading-[1.5]">
                        <span className={h.prefix.startsWith("사장님") ? "font-semibold text-brand" : "font-semibold text-ink"}>
                          {h.prefix}
                        </span>
                        {h.timeLabel && <span className="tabular-nums"> · {sbNum(SBUI.dateTime, h.timeLabel)}</span>}
                        {h.note && <div className="text-[11px] text-muted pl-2">💬 {h.note}</div>}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* 확인 대기 — 확정 / (제안 미소진) 다른 일정 제안 / 거절 (§4-2) */}
              {actionable && proposingId !== it.passId && decliningId !== it.passId && (
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => post("/api/owner/reserve-confirm", { passId: it.passId }, it.passId)}
                    disabled={busyId === it.passId}
                    className="cp-action h-9 px-4 rounded-sm bg-brand text-white text-[13px] font-bold disabled:opacity-60"
                  >
                    {busyId === it.passId ? "확정 중..." : "예약 확정"}
                  </button>
                  {!it.proposalUsed && (
                    <button
                      type="button"
                      onClick={() => {
                        setProposingId(it.passId);
                        setSlots([{ date: "", time: "" }]);
                        setNote("");
                        setErr(null);
                      }}
                      className="cp-action h-9 px-4 rounded-sm border border-hairline bg-canvas text-[13px] font-semibold text-ink"
                    >
                      다른 일정 제안
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDecliningId(it.passId)}
                    className="cp-action h-9 px-4 rounded-sm border border-hairline bg-canvas text-[13px] font-semibold text-muted"
                  >
                    거절
                  </button>
                </div>
              )}

              {/* 거절 확인 — 확정 전 언제든 (§5-1). 체험자 패널티·재신청 제한 없음 */}
              {actionable && decliningId === it.passId && (
                <div className="mt-2.5 rounded-sm bg-sunken px-3 py-2.5">
                  <p className="text-[12px] text-ink2 leading-[1.5]">
                    거절하면 신청이 취소돼요 — 체험자에게 패널티는 없고, 모집 중이면 바로 다시 신청할 수 있어요.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDecliningId(null)}
                      className="cp-action h-8 px-3 rounded-sm border border-hairline bg-canvas text-[12px] font-semibold text-ink"
                    >
                      돌아가기
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await post("/api/owner/reserve-decline", { passId: it.passId }, it.passId);
                        if (ok) setDecliningId(null);
                      }}
                      disabled={busyId === it.passId}
                      className="cp-action h-8 px-3.5 rounded-sm bg-errorSoft text-error text-[12px] font-bold disabled:opacity-60"
                    >
                      {busyId === it.passId ? "처리 중..." : "거절하기"}
                    </button>
                  </div>
                </div>
              )}

              {/* 다른 일정 제안 폼 — 슬롯 최대 3 + 안내사항 (§4-4) */}
              {actionable && proposingId === it.passId && (
                <div className="mt-2.5 rounded-sm bg-sunken p-3">
                  <div className="text-[12px] font-bold text-ink">제안할 일정 (최대 {PROPOSAL_MAX_SLOTS}개)</div>
                  <div className="mt-2 space-y-1.5">
                    {slots.map((sl, i) => (
                      <div key={i} className="flex gap-1.5">
                        <select
                          value={sl.date}
                          onChange={(e) => setSlots((arr) => arr.map((s, j) => (j === i ? { ...s, date: e.target.value } : s)))}
                          aria-label={`제안 날짜 ${i + 1}`}
                          className={`flex-1 h-9 px-2 rounded-sm border border-hairline bg-canvas text-[12px] ${sl.date ? "text-ink" : "text-mutedSoft"}`}
                        >
                          <option value="">날짜</option>
                          {proposeDates.map((d) => (
                            <option key={d.date} value={d.date} disabled={d.disabled}>
                              {d.label}
                              {d.disabled ? " (휴무·차단)" : ""}
                            </option>
                          ))}
                        </select>
                        <select
                          value={sl.time}
                          onChange={(e) => setSlots((arr) => arr.map((s, j) => (j === i ? { ...s, time: e.target.value } : s)))}
                          aria-label={`제안 시간 ${i + 1}`}
                          className={`w-[110px] h-9 px-2 rounded-sm border border-hairline bg-canvas text-[12px] ${sl.time ? "text-ink" : "text-mutedSoft"}`}
                        >
                          <option value="">시간</option>
                          {proposeTimes.map((t) => (
                            <option key={t.time} value={t.time}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                        {slots.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setSlots((arr) => arr.filter((_, j) => j !== i))}
                            aria-label={`제안 일정 ${i + 1} 삭제`}
                            className="cp-action w-9 h-9 rounded-sm border border-hairline bg-canvas text-[13px] text-muted"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {slots.length < PROPOSAL_MAX_SLOTS && (
                    <button
                      type="button"
                      onClick={() => setSlots((arr) => [...arr, { date: "", time: "" }])}
                      className="cp-action mt-1.5 h-8 px-3 rounded-sm text-[12px] font-semibold text-brand"
                    >
                      + 일정 추가
                    </button>
                  )}
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, PROPOSAL_NOTE_MAX))}
                    placeholder="안내사항 (선택) — 체험자에게 그대로 보여요"
                    rows={2}
                    className="mt-2 w-full px-3 py-2.5 rounded-sm border border-hairline bg-canvas text-[13px] text-ink placeholder:text-mutedSoft leading-[1.5] resize-none"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setProposingId(null)}
                      className="cp-action h-9 px-3.5 rounded-sm border border-hairline bg-canvas text-[13px] font-semibold text-ink"
                    >
                      닫기
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const clean = slots.filter((s) => s.date && s.time);
                        const ok = await post(
                          "/api/owner/reserve-propose",
                          { passId: it.passId, slots: clean, note: note.trim() || undefined },
                          it.passId,
                        );
                        if (ok) setProposingId(null);
                      }}
                      disabled={busyId === it.passId || (!slots.some((s) => s.date && s.time) && !note.trim())}
                      className="cp-action flex-1 h-9 rounded-sm bg-brand text-white text-[13px] font-bold disabled:bg-canvas disabled:text-mutedSoft disabled:border disabled:border-hairline"
                    >
                      {busyId === it.passId ? "보내는 중..." : "제안 보내기"}
                    </button>
                  </div>
                </div>
              )}

              {/* 확정 예약 취소 — 사유 필수·체험자에게 그대로 안내 (§5-3) */}
              {it.statusKey === "confirmed" && cancellingId !== it.passId && (
                <button
                  type="button"
                  onClick={() => {
                    setCancellingId(it.passId);
                    setCancelReason("");
                    setErr(null);
                  }}
                  className="cp-action mt-2.5 h-9 px-4 rounded-sm border border-hairline bg-canvas text-[13px] font-semibold text-muted"
                >
                  예약 취소
                </button>
              )}
              {it.statusKey === "confirmed" && cancellingId === it.passId && (
                <div className="mt-2.5 rounded-sm bg-sunken px-3 py-2.5">
                  <p className="text-[12px] text-ink2 leading-[1.5]">
                    확정된 예약을 취소해요 — 사유는 체험자에게 그대로 안내되고, QR은 즉시 사용할 수 없게 돼요. 체험자
                    패널티·재신청 제한은 없어요.
                  </p>
                  <input
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value.slice(0, 100))}
                    placeholder="취소 사유 (필수) — 예: 매장 사정으로 휴무예요"
                    className="mt-2 w-full h-9 px-3 rounded-sm border border-hairline bg-canvas text-[13px] text-ink placeholder:text-mutedSoft"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCancellingId(null)}
                      className="cp-action h-8 px-3 rounded-sm border border-hairline bg-canvas text-[12px] font-semibold text-ink"
                    >
                      돌아가기
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await post(
                          "/api/owner/reserve-cancel",
                          { passId: it.passId, reason: cancelReason.trim() },
                          it.passId,
                        );
                        if (ok) setCancellingId(null);
                      }}
                      disabled={busyId === it.passId || !cancelReason.trim()}
                      className="cp-action h-8 px-3.5 rounded-sm bg-errorSoft text-error text-[12px] font-bold disabled:opacity-60"
                    >
                      {busyId === it.passId ? "취소 중..." : "예약 취소하기"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {err && <p className="mt-2 text-[12px] text-error">{err}</p>}
    </div>
  );
}
