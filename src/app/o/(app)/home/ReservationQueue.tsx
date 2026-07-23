"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SBUI, sbNum } from "@/lib/storyboard";
import { PROPOSAL_MAX_SLOTS, PROPOSAL_NOTE_MAX } from "@/lib/reservation";

export interface ReservationQueueItem {
  passId: string;
  masked: string; // 익명 #last4 — 등급·실명 비노출 원칙 유지 (확정 정책 8)
  campaignTitle: string;
  label: string; // "7월 18일 (토) 오후 2시" — 체험자 희망(또는 확정) 일시 (12시간제 — §7-2)
  status: "requested" | "proposed" | "confirmed";
  epoch: number; // 예약 일시 (정렬용)
  endAt: number; // 캠페인 종료일 — 제안 가능 날짜 한도
  partySize?: number; // 방문 인원수 (2026-07-17 — 신청 시 필수 입력)
  // 제안 폼 선택지 — 캠페인 예약 스케줄(요일·운영시간) 기준으로 서버가 계산 (§2-2)
  dateOptions: Array<{ date: string; label: string; disabled: boolean }>;
  timeOptions: Array<{ time: string; label: string }>;
  // 협상 히스토리 (v3) — 서버에서 포맷된 타임라인 (일시는 sbNum으로 마스킹 가능하게 분리)
  history: Array<{ prefix: string; timeLabel: string; note?: string }>;
  proposalUsed: boolean; // 사장님 제안 1회 소진 — 소진 후 재제안 불가
  counterUsed: boolean; // 체험자 재제안 수신 여부 (표기용)
}

type SlotDraft = { date: string; time: string };

// 예약 확인 큐 (2026-07-22 §4 — 사장님은 예약 확정 / 다른 일정 제안(1회) / 예약 거절 중 선택).
// 거절은 확정 전 어느 단계에서든 가능 — 체험자 패널티·12h 재신청 제한 없음 (§5-1).
// 제안 = 슬롯 최대 3개 + 수기 안내사항(선택지가 3개보다 많거나 추가 안내가 필요할 때 — 체험자에게 노출).
export default function ReservationQueue({ items }: { items: ReservationQueueItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [proposingId, setProposingId] = useState<string | null>(null); // 제안 폼 열린 항목
  const [decliningId, setDecliningId] = useState<string | null>(null); // 거절 확인 열린 항목
  const [cancellingId, setCancellingId] = useState<string | null>(null); // 확정 취소 열린 항목 (§5-3)
  const [cancelReason, setCancelReason] = useState("");
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
        <div className="text-[12px] text-muted">{pendingCount > 0 ? `확인 대기 ${pendingCount}건` : "모두 처리됨"}</div>
        <div className="text-[11px] text-muted">확인·제안하면 체험자에게 알림이 가요</div>
      </div>
      <div className="mt-3 space-y-2.5">
        {items.map((it) => (
          <div key={it.passId} className="rounded-md border border-hairline p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[14px] font-semibold text-ink">익명 {it.masked}</span>
              {/* 캠페인명은 표기만 — 캠페인 관리(2depth) 진입은 '내 캠페인' 카드 단일 경로 (2026-07-23) */}
              <span className="text-[11px] text-muted truncate max-w-[160px]">{it.campaignTitle}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-[14px] font-bold text-ink tabular-nums">
                {sbNum(SBUI.dateTime, it.label)}{it.partySize ? ` · ${it.partySize}명` : ""} {it.counterUsed && it.status === "requested" ? "재제안" : "방문 희망"}
              </span>
              {it.status === "confirmed" && cancellingId !== it.passId && (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-pill bg-successSoft text-successStrong text-[11px] font-semibold">
                    확정됨
                  </span>
                  {/* 확정 예약 취소 (§5-3) — 매장 사정 예외 처리, 사유 필수·체험자 원문 안내 */}
                  <button
                    type="button"
                    onClick={() => {
                      setCancellingId(it.passId);
                      setCancelReason("");
                      setErr(null);
                    }}
                    className="cp-action text-[12px] font-semibold text-muted underline"
                  >
                    예약 취소
                  </button>
                </span>
              )}
              {it.status === "proposed" && (
                <span className="inline-flex items-center px-2 py-1 rounded-pill bg-brandSoft text-brand text-[11px] font-semibold">
                  제안함 · 응답 대기
                </span>
              )}
            </div>

            {/* 협상 히스토리 (v3) — 누가 언제 어떤 시간을 제안했는지 타임라인 */}
            {it.history.length > 1 && (
              <div className="mt-2 rounded-sm bg-sunken px-3 py-2 space-y-1">
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
            )}

            {/* 확인 대기 — [예약 확정] + (제안 미사용) [다른 일정 제안] + [예약 거절] (§4-2) */}
            {it.status === "requested" && proposingId !== it.passId && decliningId !== it.passId && (
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
                    onClick={() => openPropose(it.passId)}
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

            {/* 확정 예약 취소 폼 (§5-3) — 사유 필수, 체험자에게 그대로 안내·QR 즉시 무효 */}
            {it.status === "confirmed" && cancellingId === it.passId && (
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
                      const ok = await post("/api/owner/reserve-cancel", { passId: it.passId, reason: cancelReason.trim() }, it.passId);
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

            {/* 거절 확인 — 확정 전 언제든 가능 (§5-1). 체험자 패널티·12h 재신청 제한 없음 */}
            {it.status === "requested" && decliningId === it.passId && (
              <div className="mt-2.5 rounded-sm bg-sunken px-3 py-2.5">
                <p className="text-[12px] text-ink2 leading-[1.5]">
                  매장 사정으로 받기 어려운 요청인가요? 거절하면 신청이 취소돼요 — 체험자에게 패널티는 없어요.
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
                    {busyId === it.passId ? "처리 중..." : "거절하고 취소"}
                  </button>
                </div>
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
                        {it.dateOptions.map((d) => (
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
                        {it.timeOptions.map((t) => (
                          <option key={t.time} value={t.time}>
                            {t.label}
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
        일정 제안은 서로 1회씩 가능해요 (사장님 제안 → 체험자 재제안 → 확정 또는 거절) · 예약이 확정되기 전에는 체험권(QR)이
        열리지 않아요 · 거절해도 체험자에게 패널티는 없어요. 날짜·시간 차단은 캠페인 관리에서 할 수 있어요.
      </p>
    </div>
  );
}
