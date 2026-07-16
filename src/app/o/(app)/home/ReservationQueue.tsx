"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SBUI, sbNum } from "@/lib/storyboard";
import {
  PROPOSAL_MAX_SLOTS,
  PROPOSAL_NOTE_MAX,
  RESERVATION_TIME_SLOTS,
  reservationDateOptions,
  fmtReservationDateLabel,
} from "@/lib/reservation";

export interface ReservationQueueItem {
  passId: string;
  masked: string; // 익명 #last4 — 등급·실명 비노출 원칙 유지 (확정 정책 8)
  campaignTitle: string;
  label: string; // "7월 18일 (토) 14:00" — 체험자 희망(또는 확정) 일시
  status: "requested" | "proposed" | "confirmed";
  epoch: number; // 예약 일시 (정렬용)
  endAt: number; // 캠페인 종료일 — 제안 가능 날짜 한도
}

type SlotDraft = { date: string; time: string };

// 예약 확인 큐 (2026-07-16 리뷰노트 벤치마크 · v2 제안 플로우)
// [P1] 사장님은 [예약 확인] 또는 [다른 시간 제안]만 가능 — 일방 거절/취소 없음(취소 결정권은 체험자).
// 제안 = 슬롯 최대 3개 + 수기 안내사항(선택지가 3개보다 많거나 추가 안내가 필요할 때 — 체험자에게 노출).
export default function ReservationQueue({ items }: { items: ReservationQueueItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [proposingId, setProposingId] = useState<string | null>(null); // 제안 폼 열린 항목
  const [slots, setSlots] = useState<SlotDraft[]>([{ date: "", time: "" }]);
  const [note, setNote] = useState("");

  async function post(url: string, body: Record<string, unknown>, passId: string) {
    setBusyId(passId);
    setErr(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "처리에 실패했어요.");
      setBusyId(null);
      return false;
    }
    setBusyId(null);
    router.refresh();
    return true;
  }

  function openPropose(passId: string) {
    setProposingId(passId);
    setSlots([{ date: "", time: "" }]);
    setNote("");
    setErr(null);
  }

  async function submitPropose(passId: string) {
    const clean = slots.filter((s) => s.date && s.time);
    const ok = await post("/api/owner/reserve-propose", { passId, slots: clean, note: note.trim() || undefined }, passId);
    if (ok) setProposingId(null);
  }

  if (items.length === 0) return null;
  const pendingCount = items.filter((it) => it.status === "requested").length;

  return (
    <div className="mx-5 mt-3 rounded-lg border border-info bg-canvas p-4">
      <div className="flex items-center justify-between">
        <div className="text-[14px] font-bold text-ink">
          📅 방문 예약 {items.length}건{pendingCount > 0 ? ` · 확인 대기 ${pendingCount}건` : ""}
        </div>
        <div className="text-[11px] text-muted">확인·제안하면 체험자에게 알림이 가요</div>
      </div>
      <div className="mt-3 space-y-2.5">
        {items.map((it) => (
          <div key={it.passId} className="rounded-md border border-hairline p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[14px] font-semibold text-ink">익명 {it.masked}</span>
              <span className="text-[11px] text-muted truncate max-w-[150px]">{it.campaignTitle}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-[14px] font-bold text-ink tabular-nums">
                {sbNum(SBUI.dateTime, it.label)} 방문 희망
              </span>
              {it.status === "confirmed" && (
                <span className="inline-flex items-center px-2 py-1 rounded-pill bg-successSoft text-successStrong text-[11px] font-semibold">
                  확정됨
                </span>
              )}
              {it.status === "proposed" && (
                <span className="inline-flex items-center px-2 py-1 rounded-pill bg-brandSoft text-brand text-[11px] font-semibold">
                  제안함 · 응답 대기
                </span>
              )}
            </div>

            {/* 확인 대기 — [예약 확인] + [다른 시간 제안] */}
            {it.status === "requested" && proposingId !== it.passId && (
              <div className="mt-2.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => post("/api/owner/reserve-confirm", { passId: it.passId }, it.passId)}
                  disabled={busyId === it.passId}
                  className="cp-action h-9 px-4 rounded-sm bg-brand text-white text-[13px] font-bold disabled:opacity-60"
                >
                  {busyId === it.passId ? "확인 중..." : "예약 확인"}
                </button>
                <button
                  type="button"
                  onClick={() => openPropose(it.passId)}
                  className="cp-action h-9 px-4 rounded-sm border border-hairline bg-canvas text-[13px] font-semibold text-ink"
                >
                  다른 시간 제안
                </button>
              </div>
            )}

            {/* 다른 시간 제안 폼 — 슬롯 최대 3개 + 수기 안내사항 */}
            {it.status === "requested" && proposingId === it.passId && (
              <div className="mt-2.5 rounded-sm bg-sunken p-3">
                <div className="text-[12px] font-bold text-ink">제안할 시간 (최대 {PROPOSAL_MAX_SLOTS}개)</div>
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
                        {reservationDateOptions(it.endAt).map((d) => (
                          <option key={d} value={d}>
                            {fmtReservationDateLabel(d)}
                          </option>
                        ))}
                      </select>
                      <select
                        value={sl.time}
                        onChange={(e) => setSlots((arr) => arr.map((s, j) => (j === i ? { ...s, time: e.target.value } : s)))}
                        aria-label={`제안 시간 ${i + 1}`}
                        className={`w-[92px] h-9 px-2 rounded-sm border border-hairline bg-canvas text-[12px] ${sl.time ? "text-ink" : "text-mutedSoft"}`}
                      >
                        <option value="">시간</option>
                        {RESERVATION_TIME_SLOTS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      {slots.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setSlots((arr) => arr.filter((_, j) => j !== i))}
                          aria-label={`제안 시간 ${i + 1} 삭제`}
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
                    + 시간 추가
                  </button>
                )}
                <div className="mt-2 text-[12px] font-bold text-ink">안내사항 (선택)</div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, PROPOSAL_NOTE_MAX))}
                  placeholder="선택지가 더 필요하거나 추가 안내가 있다면 직접 적어주세요 — 체험자에게 그대로 보여요. (예: 평일 오후는 대부분 가능해요, 주말은 통화 후 조율 부탁드려요)"
                  rows={3}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-sm border border-hairline bg-canvas text-[13px] text-ink placeholder:text-mutedSoft leading-[1.5] resize-none"
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
                    onClick={() => submitPropose(it.passId)}
                    disabled={busyId === it.passId || (!slots.some((s) => s.date && s.time) && !note.trim())}
                    className="cp-action flex-1 h-9 rounded-sm bg-brand text-white text-[13px] font-bold disabled:bg-canvas disabled:text-mutedSoft disabled:border disabled:border-hairline"
                  >
                    {busyId === it.passId ? "보내는 중..." : "제안 보내기"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {err && <p className="mt-2 text-[12px] text-error">{err}</p>}
      <p className="mt-2.5 text-[11px] text-muted leading-[1.5]">
        체험자는 제안 시간 수락(확정) · 다른 시간 재요청 · 취소 중에 선택해요 — 예약이 확정되기 전에는 체험권(QR)이 열리지 않아요.
      </p>
    </div>
  );
}
