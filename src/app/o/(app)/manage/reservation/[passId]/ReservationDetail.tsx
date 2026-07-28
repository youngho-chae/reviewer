"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SBUI, sbNum } from "@/lib/storyboard";
import { PROPOSAL_MAX_SLOTS, PROPOSAL_NOTE_MAX } from "@/lib/reservation";

/**
 * 예약 정보 상세 (2026-07-28 시안) — [관리]-[예약관리] 카드에서 진입하는 다음 depth.
 *  - 요청/재제안: [예약 확정](주) + [거절]·[다른 일정 제안](보조)
 *  - 거절 = 즉시 처리 후 "취소되었습니다" 결과 모달 (시안)
 *  - 다른 일정 제안 = 선택된 일정(최대 3 — 오렌지 칩) + [일정 선택](캘린더+오전/오후 시트)
 *    + 안내사항 + [제안 보내기]
 *  - 하단 예약 내역 = reservationHistoryCards (체험자 상세와 동일 카피 — 카피 원문주의)
 *  - 시안 블루 액센트는 v2 규칙(퍼플=인터랙션)로 치환
 */
export interface ReservationDetailData {
  passId: string;
  state: "requested" | "proposed" | "counter" | "confirmed" | "cancelled";
  campaignTitle: string;
  storeName: string;
  masked: string;
  label: string; // 신청(또는 확정) 일정 라벨
  partySize?: number;
  proposalUsed: boolean;
  cards: Array<{ actor: "체험자" | "사장님"; title: string; rows: Array<{ label: string; value: string }> }>;
  dateOptions: Array<{ date: string; label: string; disabled: boolean }>;
  slotsByDate: Record<string, Array<{ time: string; label: string; disabled: boolean }>>;
}

const STATE_CHIP: Record<ReservationDetailData["state"], { label: string; cls: string }> = {
  requested: { label: "예약 요청", cls: "bg-sunken text-ink2" },
  proposed: { label: "다른 일정 제안 · 응답 대기", cls: "bg-brandSoft text-brand" },
  counter: { label: "체험자 재제안 · 응답 대기", cls: "bg-brandSoft text-brand" },
  confirmed: { label: "예약 확정", cls: "bg-successSoft text-successStrong" },
  cancelled: { label: "취소", cls: "bg-sunken text-muted" },
};

const GUIDE = [
  "일정 제안은 서로 1회씩 가능해요 (사장님 제안 → 체험자 재제안 → 확정 또는 거절)",
  "예약 확정 또는 일정 제안하면 체험자에게 알림이 가요.",
  "예약이 확정되기 전에는 체험권(QR)이 열리지 않아요.",
  "거절해도 체험자에게 패널티는 없어요.",
  "날짜·시간 차단은 캠페인 관리에서 할 수 있어요.",
];

type Slot = { date: string; time: string };

export default function ReservationDetail({ data }: { data: ReservationDetailData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false); // 거절 결과 모달 (시안 "취소되었습니다")
  const [proposing, setProposing] = useState(false); // 제안 폼 펼침
  const [slots, setSlots] = useState<Slot[]>([]);
  const [note, setNote] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false); // 일정 선택 시트
  const [draft, setDraft] = useState<Slot[]>([]); // 시트 내 임시 선택
  const [monthIdx, setMonthIdx] = useState(0); // 표시 월 (첫 선택 가능일 기준 오프셋)
  const [pickDate, setPickDate] = useState<string | null>(null); // 시트에서 현재 고른 날짜
  const [cancelling, setCancelling] = useState(false); // 확정 취소 폼 (§5-3 — 홈 큐에서 이관)
  const [cancelReason, setCancelReason] = useState("");

  const actionable = data.state === "requested" || data.state === "counter";
  const chip = STATE_CHIP[data.state];

  const dateMap = useMemo(() => new Map(data.dateOptions.map((d) => [d.date, d])), [data.dateOptions]);
  // 캘린더 월 목록 — 선택 가능 윈도우가 걸치는 달만
  const months = useMemo(() => {
    const set = new Set(data.dateOptions.map((d) => d.date.slice(0, 7)));
    return [...set].sort();
  }, [data.dateOptions]);
  const month = months[Math.min(monthIdx, Math.max(months.length - 1, 0))] ?? new Date().toISOString().slice(0, 7);

  // 해당 월의 캘린더 그리드 (일요일 시작)
  const grid = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const startDow = first.getUTCDay();
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells: Array<{ date: string; day: number } | null> = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: `${month}-${String(d).padStart(2, "0")}`, day: d });
    }
    return cells;
  }, [month]);

  const slotLabel = (s: Slot) => {
    const d = dateMap.get(s.date);
    const t = data.slotsByDate[s.date]?.find((x) => x.time === s.time);
    return `${d?.label ?? s.date} ${t?.label ?? s.time}`;
  };

  async function post(url: string, body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setErr(null);
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "처리에 실패했어요.");
      return false;
    }
    return true;
  }

  async function confirmReservation() {
    if (await post("/api/owner/reserve-confirm", { passId: data.passId })) router.refresh();
  }
  async function decline() {
    if (await post("/api/owner/reserve-decline", { passId: data.passId })) setDeclined(true);
  }
  async function sendProposal() {
    const ok = await post("/api/owner/reserve-propose", {
      passId: data.passId,
      slots,
      note: note.trim() || undefined,
    });
    if (ok) {
      setProposing(false);
      router.refresh();
    }
  }

  const timesOf = (date: string | null) => (date ? (data.slotsByDate[date] ?? []) : []);
  const am = timesOf(pickDate).filter((t) => Number(t.time.slice(0, 2)) < 12);
  const pm = timesOf(pickDate).filter((t) => Number(t.time.slice(0, 2)) >= 12);

  const addDraft = (time: string) => {
    if (!pickDate) return;
    setDraft((arr) => {
      if (arr.some((s) => s.date === pickDate && s.time === time)) return arr;
      if (arr.length + slots.length >= PROPOSAL_MAX_SLOTS) return arr;
      return [...arr, { date: pickDate, time }];
    });
  };

  return (
    <div className="pb-24 bg-canvas min-h-[100dvh]">
      {/* 헤더 — ← 뒤로 + 중앙 타이틀 */}
      <div className="px-4 pt-12 pb-3 grid grid-cols-[40px_1fr_40px] items-center">
        <Link href="/o/manage" aria-label="뒤로" className="cp-action w-10 h-10 grid place-items-center text-[20px] text-ink">
          ←
        </Link>
        <h1 className="text-center text-[16px] font-bold text-ink tracking-title">예약 정보</h1>
        <span />
      </div>

      <div className="px-5">
        <span className={`inline-flex items-center px-2 py-1 rounded-xs text-[11px] font-semibold ${chip.cls}`}>{chip.label}</span>
        <h2 className="mt-2.5 text-[18px] font-bold text-ink tracking-title leading-[1.35] line-clamp-2">{data.campaignTitle}</h2>

        <dl className="mt-3.5 space-y-2 text-[14px]">
          <div className="flex gap-6">
            <dt className="w-[64px] shrink-0 text-muted">체험자</dt>
            <dd className="font-semibold text-ink">익명 {data.masked}</dd>
          </div>
          <div className="flex gap-6">
            <dt className="w-[64px] shrink-0 text-muted">신청 일정</dt>
            <dd className="font-semibold text-ink tabular-nums">{sbNum(SBUI.dateTime, data.label)}</dd>
          </div>
          {data.partySize && (
            <div className="flex gap-6">
              <dt className="w-[64px] shrink-0 text-muted">신청 인원</dt>
              <dd className="font-semibold text-ink tabular-nums">{data.partySize}명</dd>
            </div>
          )}
        </dl>

        {/* 액션 — 요청/재제안만 (시안: 확정 주 버튼 + 거절·다른 일정 제안 보조) */}
        {actionable && (
          <div className="mt-5">
            <button
              type="button"
              onClick={confirmReservation}
              disabled={busy}
              className="cp-action w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:opacity-60"
            >
              {busy ? "처리 중..." : "예약 확정"}
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={decline}
                disabled={busy}
                className="cp-action h-12 rounded-md border border-hairline bg-canvas text-[15px] font-semibold text-ink disabled:opacity-60"
              >
                거절
              </button>
              <button
                type="button"
                onClick={() => {
                  setProposing((v) => !v);
                  setErr(null);
                }}
                disabled={busy || data.proposalUsed}
                className="cp-action h-12 rounded-md border border-hairline bg-canvas text-[15px] font-semibold text-ink disabled:opacity-40"
              >
                다른 일정 제안
              </button>
            </div>

            {/* 다른 일정 제안 폼 (시안) — 선택된 일정(오렌지 칩) + [일정 선택] + 안내사항 + [제안 보내기] */}
            {proposing && (
              <div className="mt-3 rounded-md border border-hairline p-4">
                <div className="text-[13px] font-bold text-ink">선택된 일정 (최대 {PROPOSAL_MAX_SLOTS}개)</div>
                {slots.length === 0 ? (
                  <p className="mt-3 text-center text-[13px] text-muted">선택된 일정이 없습니다.</p>
                ) : (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {slots.map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-pill bg-warningSoft text-[12px] font-semibold text-ink tabular-nums">
                        {sbNum(SBUI.dateTime, slotLabel(s))}
                        <button
                          type="button"
                          aria-label="일정 삭제"
                          onClick={() => setSlots((arr) => arr.filter((_, j) => j !== i))}
                          className="cp-action text-muted"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDraft([]);
                    setPickDate(null);
                    setSheetOpen(true);
                  }}
                  disabled={slots.length >= PROPOSAL_MAX_SLOTS}
                  className="cp-action mt-3 w-full h-11 rounded-md border border-brand text-brand text-[14px] font-semibold disabled:opacity-40"
                >
                  일정 선택
                </button>
                <div className="mt-4 text-[13px] font-bold text-ink">안내사항 (선택)</div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, PROPOSAL_NOTE_MAX))}
                  rows={3}
                  placeholder="선택지가 더 필요하거나 추가 안내가 있다면 체험자에게 알려주세요. (예: 평일 오후는 대부분 가능해요, 주말은 통화 후 조율 부탁드립니다.)"
                  className="mt-1.5 w-full px-3 py-2.5 rounded-sm border border-hairline bg-canvas text-[13px] text-ink placeholder:text-mutedSoft leading-[1.5] resize-none"
                />
                <button
                  type="button"
                  onClick={sendProposal}
                  disabled={busy || (slots.length === 0 && !note.trim())}
                  className="cp-action mt-3 w-full h-12 rounded-md bg-ink text-white text-[15px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
                >
                  {busy ? "보내는 중..." : "제안 보내기"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 확정 예약 취소 (§5-3 — 2026-07-28 홈 큐 제거로 상세에 이관): 매장 사정 예외 처리,
            사유 필수·체험자 원문 안내·QR 즉시 무효. 체험자 패널티·재신청 제한 없음 */}
        {data.state === "confirmed" && (
          <div className="mt-5">
            {!cancelling ? (
              <button
                type="button"
                onClick={() => {
                  setCancelling(true);
                  setCancelReason("");
                  setErr(null);
                }}
                className="cp-action text-[13px] font-semibold text-muted underline"
              >
                확정 예약 취소
              </button>
            ) : (
              <div className="rounded-sm bg-sunken px-3 py-2.5">
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
                    onClick={() => setCancelling(false)}
                    className="cp-action h-8 px-3 rounded-sm border border-hairline bg-canvas text-[12px] font-semibold text-ink"
                  >
                    돌아가기
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await post("/api/owner/reserve-cancel", { passId: data.passId, reason: cancelReason.trim() });
                      if (ok) {
                        setCancelling(false);
                        router.refresh();
                      }
                    }}
                    disabled={busy || !cancelReason.trim()}
                    className="cp-action h-8 px-3.5 rounded-sm bg-errorSoft text-error text-[12px] font-bold disabled:opacity-60"
                  >
                    {busy ? "취소 중..." : "예약 취소하기"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {err && <p className="mt-3 text-[13px] text-error">{err}</p>}

        {/* 안내 */}
        <ul className="mt-5 space-y-1.5">
          {GUIDE.map((g, i) => (
            <li key={i} className="flex gap-1.5 text-[12px] text-muted leading-[1.55]">
              <span className="shrink-0">·</span>
              <span>{g}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 예약 내역 — 히스토리 타임라인 (체험자 상세와 동일 카드) */}
      <div className="mt-6 border-t-8 border-sunken px-5 pt-5">
        <h3 className="text-[16px] font-bold text-ink tracking-title">예약 내역</h3>
        <div className="mt-3 space-y-2.5">
          {data.cards.map((card, i) => (
            <div key={i} className="rounded-md bg-sunken px-4 py-3">
              <div className="text-[14px] font-semibold text-ink">
                <span className="text-brand">{card.actor}</span>
                {card.title}
              </div>
              {card.rows.map((row, j) => (
                <div key={j} className="mt-1 flex gap-3 text-[13px] text-muted tabular-nums">
                  <span className="w-[56px] shrink-0">{row.label}</span>
                  <span>{sbNum(SBUI.dateTime, row.value)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* 거절 결과 모달 (시안 — "취소되었습니다" + [확인]) */}
      {declined && (
        <div className="fixed inset-0 bg-ink/45 z-50 flex items-center justify-center px-8">
          <div className="w-full max-w-[340px] rounded-lg bg-canvas p-5 text-center">
            <p className="text-[15px] font-semibold text-ink">취소되었습니다</p>
            <button
              type="button"
              onClick={() => {
                setDeclined(false);
                router.refresh();
              }}
              className="cp-action mt-4 w-full h-11 rounded-md bg-brand text-white text-[14px] font-bold"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 일정 선택 시트 (시안 — "언제가 가능하세요?" 캘린더 + 오전/오후 + 선택 칩) */}
      {sheetOpen && (
        <div className="fixed inset-0 bg-ink/45 z-50 flex items-end" onClick={() => setSheetOpen(false)}>
          <div className="w-full max-h-[85dvh] overflow-y-auto rounded-t-xl bg-canvas p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-3">
              <span className="w-9 h-1 rounded-pill bg-borderStrong" />
            </div>
            <h3 className="text-center text-[17px] font-bold text-ink tracking-title">언제가 가능하세요?</h3>

            {/* 월 네비게이션 + 캘린더 */}
            <div className="mt-4 flex items-center justify-between px-2">
              <button
                type="button"
                onClick={() => setMonthIdx((v) => Math.max(0, v - 1))}
                disabled={monthIdx === 0}
                aria-label="이전 달"
                className="cp-action w-9 h-9 text-[16px] text-ink disabled:opacity-30"
              >
                ‹
              </button>
              <span className="text-[15px] font-bold text-ink tabular-nums">
                {Number(month.slice(0, 4))}년 {Number(month.slice(5, 7))}월
              </span>
              <button
                type="button"
                onClick={() => setMonthIdx((v) => Math.min(months.length - 1, v + 1))}
                disabled={monthIdx >= months.length - 1}
                aria-label="다음 달"
                className="cp-action w-9 h-9 text-[16px] text-ink disabled:opacity-30"
              >
                ›
              </button>
            </div>
            <div className="mt-2 grid grid-cols-7 text-center text-[12px] text-muted">
              {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                <span key={d} className="py-1.5">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 text-center">
              {grid.map((cell, i) => {
                if (!cell) return <span key={i} />;
                const opt = dateMap.get(cell.date);
                const enabled = !!opt && !opt.disabled;
                const selected = pickDate === cell.date;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!enabled}
                    onClick={() => setPickDate(cell.date)}
                    className={`cp-action h-10 m-0.5 rounded-md text-[14px] tabular-nums ${
                      selected
                        ? "bg-brand text-white font-bold"
                        : enabled
                          ? "text-ink font-medium"
                          : "text-mutedSoft"
                    }`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            {/* 시간 — 오전/오후 칩 (날짜 선택 후) */}
            {pickDate && (
              <div className="mt-3">
                {am.length > 0 && (
                  <>
                    <div className="text-[13px] font-bold text-ink">오전</div>
                    <div className="mt-1.5 flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
                      {am.map((t) => (
                        <button
                          key={t.time}
                          type="button"
                          disabled={t.disabled}
                          onClick={() => addDraft(t.time)}
                          className={`cp-action h-9 px-3 rounded-pill border text-[13px] tabular-nums shrink-0 ${
                            draft.some((s) => s.date === pickDate && s.time === t.time)
                              ? "border-brand text-brand font-bold"
                              : t.disabled
                                ? "border-hairlineSoft text-mutedSoft"
                                : "border-hairline text-ink"
                          }`}
                        >
                          {t.time}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {pm.length > 0 && (
                  <>
                    <div className="mt-2 text-[13px] font-bold text-ink">오후</div>
                    <div className="mt-1.5 flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
                      {pm.map((t) => (
                        <button
                          key={t.time}
                          type="button"
                          disabled={t.disabled}
                          onClick={() => addDraft(t.time)}
                          className={`cp-action h-9 px-3 rounded-pill border text-[13px] tabular-nums shrink-0 ${
                            draft.some((s) => s.date === pickDate && s.time === t.time)
                              ? "border-brand text-brand font-bold"
                              : t.disabled
                                ? "border-hairlineSoft text-mutedSoft"
                                : "border-hairline text-ink"
                          }`}
                        >
                          {t.time}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 시트 내 선택 칩 */}
            {draft.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {draft.map((s, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-pill bg-warningSoft text-[12px] font-semibold text-ink tabular-nums">
                    {sbNum(SBUI.dateTime, slotLabel(s))}
                    <button
                      type="button"
                      aria-label="선택 삭제"
                      onClick={() => setDraft((arr) => arr.filter((_, j) => j !== i))}
                      className="cp-action text-muted"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="cp-action h-12 px-5 rounded-md border border-hairline bg-canvas text-[15px] font-semibold text-ink"
              >
                취소
              </button>
              <button
                type="button"
                disabled={draft.length === 0}
                onClick={() => {
                  setSlots((arr) => [...arr, ...draft].slice(0, PROPOSAL_MAX_SLOTS));
                  setSheetOpen(false);
                }}
                className="cp-action flex-1 h-12 rounded-md bg-brand text-white text-[15px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
              >
                선택 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
