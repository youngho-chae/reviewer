import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import Icon from "@/components/Icon";
import ChannelIcons from "@/components/ChannelIcons";
import { CHANNEL_ORDER, CHANNEL_LABEL, RECEIPT_LABEL, KEEP_DAYS } from "@/lib/channels";
import { ownerReviewSummary } from "@/lib/owner-review-status";
import type { Pass, SnsKind } from "@/lib/types";

export const dynamic = "force-dynamic";

// 성과 리포트 (2026-08-10 실측 개편 · 2026-08-18 와이어프레임 개편) — P4: 실제 발생 이벤트만.
// 구 화면의 추정 노출(리뷰어 영향력×0.3)·CPM·평균 본문 길이·하드코딩 광고 준수율·
// db.reviewers 직접 조회는 모두 삭제(2026-08-10). 구성(와이어프레임 순서):
//  ① 운영 품질 2타일 (최상단·누적 — 기간 무관): 리뷰 작성 완료율 도넛(§4-1 모수) ·
//     방문 후 리뷰 제출까지 평균 일수
//  ② 기간 설정 — 최근 30일 | 최근 90일 (?range — 90일 = 게시 유지 KEEP_DAYS와 정합)
//  ③ 요약 카드 — 체험자 방문·발행 리뷰·게시 중 리뷰 + 채널별 발행 리뷰(sunken —
//     영수증 리뷰 별도 행 유지) + "※ 게시 중 리뷰란?" 각주
//  ④ 모집이 리뷰가 되기까지 — 발급 코호트 헤더 행 + 3단계(방문/제출/검수 완료):
//     바 기준 = 발급 전체 고정, 오렌지 칩 = 직전 단계 대비 전환율
//  ⑤ 상생 매출 — "+n원 (총 m원)" = Σ max(0, paidAmount − supportApplied) (하한 집계 §12,
//     2026-08-18 구성 바는 와이어프레임 간소화로 제거 — 캡션이 구성 정보를 대체)
//  ⑥ 주간 방문 추이 — 캘린더 주(KST 월요일 시작) 막대(이번 주 퍼플) + 기간별 방문 테이블
//     (90일은 4행 + [기간 더보기] 펼침)
// 시안 파랑 액센트는 v2 규칙 치환(퍼플=인터랙션·강조, 검정=가치, 오렌지=전환 칩).

const DAY = 86400000;
const KST_OFFSET = 9 * 3600000;

// KST 기준 그 주(월요일 시작)의 시작 시각(UTC ts)
function weekStartKst(t: number): number {
  const kstDayStart = Math.floor((t + KST_OFFSET) / DAY) * DAY - KST_OFFSET;
  const dow = new Date(t + KST_OFFSET).getUTCDay(); // 0=일
  return kstDayStart - ((dow + 6) % 7) * DAY;
}
function kstMD(t: number): { m: number; d: number } {
  const dt = new Date(t + KST_OFFSET);
  return { m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export default async function OwnerReport({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const range: "30d" | "90d" = rangeParam === "90d" || rangeParam === "all" ? "90d" : "30d";
  const rangeDays = range === "30d" ? 30 : 90;
  const rangeLabel = range === "30d" ? "최근 30일" : "최근 90일";
  const me = await getCurrentOwner();
  const db = await getDBAsync();
  const now = Date.now();
  const since = now - rangeDays * DAY;
  const inRange = (t?: number) => t != null && t >= since;

  const myPasses = db.passes.filter((p) => p.ownerId === me.id);
  // 발행 시점 — completedAt이 없는 과거 completed 데이터 폴백 (퍼널 "검수 완료" 건수와 정합 유지)
  const doneAt = (p: Pass) => p.completedAt ?? p.reviewSubmittedAt ?? p.usedAt ?? p.issuedAt;

  // ── ① 운영 품질 (누적 — §4-1 모수: 이용 완료 체험권, 홈·리뷰 관리와 동일 집계) ──
  const summary = ownerReviewSummary(myPasses);
  const completionRate = summary.usedTotal
    ? Math.round(((summary.reviewing + summary.done + summary.resubmit) / summary.usedTotal) * 100)
    : null;
  const leadDays: number[] = myPasses
    .filter((p): p is Pass & { usedAt: number; reviewSubmittedAt: number } => p.usedAt != null && p.reviewSubmittedAt != null)
    .map((p) => (p.reviewSubmittedAt - p.usedAt) / DAY);
  const avgLead = leadDays.length ? Math.round((leadDays.reduce((a, b) => a + b, 0) / leadDays.length) * 10) / 10 : null;

  // ── ③ 요약 — 기간 내 실이벤트 카운트 ──
  const visited = myPasses.filter((p) => inRange(p.usedAt));
  const published = myPasses.filter((p) => p.status === "completed" && inRange(doneAt(p)));
  // 게시 중 = 검수 완료 후 게시 유지 기간(90일) 이내 — 기간 필터와 무관한 "지금" 기준
  const live = myPasses.filter((p) => p.status === "completed" && now - doneAt(p) <= KEEP_DAYS * DAY);

  // 채널별 발행 리뷰 — 3채널은 0건도 상시 노출(와이어프레임), 영수증은 별도 행(있을 때만)
  const byChannel: Record<SnsKind, number> = { naver_blog: 0, instagram: 0, tiktok: 0 };
  let receiptCount = 0;
  for (const p of published) {
    if (p.receiptReview) receiptCount += 1;
    else if (p.reviewChannel) byChannel[p.reviewChannel] += 1;
  }

  // ── ④ 퍼널 — 기간 내 발급 코호트 (바 기준 = 발급 전체 고정, 칩 = 직전 단계 대비) ──
  const cohort = myPasses.filter((p) => inRange(p.issuedAt));
  const fVisited = cohort.filter((p) => p.usedAt != null);
  const fSubmitted = fVisited.filter((p) => p.reviewSubmittedAt != null);
  const fDone = fSubmitted.filter((p) => p.status === "completed");
  const stages = [
    { label: "매장 방문", n: fVisited.length, prevLabel: "체험권 발급", prev: cohort.length },
    { label: "리뷰 제출", n: fSubmitted.length, prevLabel: "매장 방문", prev: fVisited.length },
    { label: "검수 완료", n: fDone.length, prevLabel: "리뷰 제출", prev: fSubmitted.length },
  ];
  const funnelMax = Math.max(1, cohort.length);

  // ── ⑤ 상생 매출 — Σ max(0, paid − support): use-by-code 폴백(paid=support)은 초과분 0,
  //     과대 표시가 불가능한 하한 집계 (§12) ──
  const paidVisits = visited.filter((p) => (p.paidAmount ?? 0) > 0);
  const totalPaid = paidVisits.reduce((s, p) => s + (p.paidAmount || 0), 0);
  const winwin = paidVisits.reduce((s, p) => s + Math.max(0, (p.paidAmount || 0) - (p.supportApplied || 0)), 0);
  const winwinCount = paidVisits.filter((p) => (p.paidAmount || 0) > (p.supportApplied || 0)).length;

  // ── ⑥ 주간 방문 추이 — 캘린더 주(KST 월요일 시작), 이번 주 포함 4주/12주 ──
  const WEEKS = range === "30d" ? 4 : 12;
  const thisWeekStart = weekStartKst(now);
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const start = thisWeekStart - (WEEKS - 1 - i) * 7 * DAY;
    return { start, end: start + 7 * DAY - 1, n: 0 };
  });
  for (const p of myPasses) {
    if (p.usedAt == null) continue;
    const ws = weekStartKst(p.usedAt);
    const idx = weeks.findIndex((w) => w.start === ws);
    if (idx >= 0) weeks[idx].n += 1;
  }
  const weekMax = Math.max(1, ...weeks.map((w) => w.n));
  const weekRangeLabel = (w: { start: number; end: number }) => {
    const s = kstMD(w.start);
    const e = kstMD(w.end);
    return `${s.m}월 ${s.d}일 ~ ${e.m}월 ${e.d}일`;
  };
  const tableRows = [...weeks].reverse(); // 최신(이번 주)부터
  const visibleRows = tableRows.slice(0, 4);
  const moreRows = tableRows.slice(4);

  const empty = myPasses.every((p) => p.usedAt == null);

  // 도넛 게이지 (리뷰 작성 완료율)
  const R = 30;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="pb-24 bg-canvas">
      {/* top-app-bar — 뒤로가기 + 중앙 타이틀 (와이어프레임) */}
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-3 grid grid-cols-[40px_1fr_40px] items-center">
          <Link href="/o/me" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="마이로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
          <h1 className="text-[16px] font-bold text-ink tracking-title text-center">성과 리포트</h1>
          <span />
        </div>
      </div>

      {/* ① 운영 품질 2타일 — 누적 (기간 세그먼트 무관) */}
      <div className="px-5 pt-2 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-hairline bg-canvas p-4 flex flex-col items-center">
          <div className="text-[13px] font-bold text-ink">리뷰 작성 완료율</div>
          <div className="relative mt-3 w-[88px] h-[88px]">
            <svg viewBox="0 0 80 80" className="w-full h-full text-brand">
              <circle cx="40" cy="40" r={R} fill="none" stroke="#F0EDF5" strokeWidth="10" />
              {completionRate != null && (
                <circle
                  cx="40"
                  cy="40"
                  r={R}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(CIRC * completionRate) / 100} ${CIRC}`}
                  transform="rotate(-90 40 40)"
                />
              )}
            </svg>
            <span className="absolute inset-0 grid place-items-center text-[18px] font-bold text-ink tabular-nums">
              {completionRate != null ? `${completionRate}%` : "-"}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-muted">누적 완료율</div>
        </div>
        <div className="rounded-lg border border-hairline bg-canvas p-4 flex flex-col items-center">
          <div className="text-[13px] font-bold text-ink">방문 후 리뷰 제출까지</div>
          <span className="mt-4 w-12 h-12 rounded-md bg-brand text-white grid place-items-center">
            <Icon name="clipboard" variant="border" size={24} />
          </span>
          <div className="mt-2.5 text-[18px] font-bold text-ink tabular-nums leading-none">
            {avgLead != null ? `${avgLead}일` : "-"}
          </div>
          <div className="mt-1.5 text-[11px] text-muted">누적 평균</div>
        </div>
      </div>

      {/* ② 기간 설정 */}
      <div className="px-5 mt-5 flex items-center gap-3">
        <span className="text-[14px] font-bold text-ink">기간 설정</span>
        <div className="flex gap-2">
          {(
            [
              { key: "30d", label: "최근 30일" },
              { key: "90d", label: "최근 90일" },
            ] as const
          ).map((r) => (
            <Link
              key={r.key}
              href={r.key === "30d" ? "/o/report" : "/o/report?range=90d"}
              className={`cp-action inline-flex items-center px-3.5 h-9 rounded-pill text-[13px] font-semibold ${
                range === r.key ? "bg-brand text-white" : "border border-hairline text-muted"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      {empty ? (
        /* 빈 상태 — 방문 이력이 아직 없음 */
        <div className="mx-5 mt-4 rounded-lg border border-hairline bg-canvas p-6 text-center">
          <div className="text-[15px] font-bold text-ink">아직 집계할 방문이 없어요</div>
          <p className="mt-1.5 text-[13px] text-muted leading-[1.6]">
            첫 체험자가 매장을 방문하면
            <br />
            방문·리뷰 성과가 여기에 쌓여요.
          </p>
          <Link href="/o/campaign/new" className="cp-action mt-4 inline-flex items-center justify-center h-11 px-5 rounded-md bg-brand text-white text-[14px] font-bold">
            새 캠페인 등록
          </Link>
        </div>
      ) : (
        <>
          {/* ③ 요약 카드 — 스탯 3분할 + 채널별 발행 리뷰 + 게시 중 각주 */}
          <div className="mx-5 mt-4 rounded-lg border border-hairline bg-canvas p-4">
            <div className="grid grid-cols-3 text-center">
              <div>
                <div className="text-[20px] font-bold text-ink tabular-nums">{visited.length}</div>
                <div className="mt-0.5 text-[12px] text-muted">체험자 방문</div>
              </div>
              <div className="border-l border-r border-hairlineSoft">
                <div className="text-[20px] font-bold text-ink tabular-nums">{published.length}</div>
                <div className="mt-0.5 text-[12px] text-muted">발행 리뷰</div>
              </div>
              <div>
                <div className="text-[20px] font-bold text-brand tabular-nums">{live.length}</div>
                <div className="mt-0.5 text-[12px] text-muted">게시 중 리뷰</div>
              </div>
            </div>

            <div className="mt-4 rounded-md bg-sunken p-3.5">
              <div className="text-[13px] font-bold text-ink">채널별 발행 리뷰</div>
              <div className="mt-2.5 space-y-2.5">
                {CHANNEL_ORDER.map((ch) => (
                  <div key={ch} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ChannelIcons channels={[ch]} />
                      <span className="text-[13px] text-ink">{CHANNEL_LABEL[ch]}</span>
                    </div>
                    <span className="text-[13px] font-bold text-ink tabular-nums">{byChannel[ch]}건</span>
                  </div>
                ))}
                {receiptCount > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-1.5 py-1 rounded-xs bg-canvas text-[12px] font-semibold text-ink2 leading-none">🧾 영수증</span>
                      <span className="text-[13px] text-ink">{RECEIPT_LABEL}</span>
                    </div>
                    <span className="text-[13px] font-bold text-ink tabular-nums">{receiptCount}건</span>
                  </div>
                )}
              </div>
            </div>

            <p className="mt-3 text-[11px] text-muted leading-[1.55]">
              <span className="font-semibold text-ink2">※ 게시 중 리뷰란?</span>
              <br />
              검수 완료 후 {KEEP_DAYS}일간 필수로 유지되는 리뷰로, 현재 검색하면 노출되고 있어요.
            </p>
          </div>

          {/* ④ 모집이 리뷰가 되기까지 — 발급 헤더 + 3단계 (바 = 발급 전체 고정 기준) */}
          <div className="mx-5 mt-3 rounded-lg border border-hairline bg-canvas p-4">
            <div className="text-[15px] font-bold text-ink tracking-title">모집이 리뷰가 되기까지</div>
            <div className="mt-3 rounded-md bg-sunken px-3.5 py-3 flex items-center justify-between gap-2">
              <span className="text-[13px] text-ink2">
                <b className="text-ink">{rangeLabel}</b>에 발급된 체험권
              </span>
              <span className="flex items-center gap-1.5 text-brand">
                <Icon name="ticket" variant="border" size={18} />
                <span className="text-[16px] font-bold tabular-nums">{cohort.length}건</span>
              </span>
            </div>
            <div className="mt-4 space-y-3.5">
              {stages.map((s) => (
                <div key={s.label}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] text-ink2">
                      {s.label} <b className="text-[14px] text-ink tabular-nums">{s.n}건</b>
                    </span>
                    {s.prev > 0 && (
                      <span className="shrink-0 inline-flex items-center px-2 py-1 rounded-pill bg-warningSoft text-[11px] font-bold text-[#FF6B00] tabular-nums">
                        {s.prevLabel} 대비 {Math.round((s.n / s.prev) * 100)}%
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 h-2.5 rounded-pill bg-sunken overflow-hidden">
                    <div className="h-full rounded-pill bg-brand" style={{ width: `${(s.n / funnelMax) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ⑤ 상생 매출 — 지원금을 넘어서 발생한 실결제 매출 */}
          <div className="mx-5 mt-3 rounded-lg border border-hairline bg-canvas p-4">
            <div className="text-[15px] font-bold text-ink tracking-title">상생 매출</div>
            {paidVisits.length === 0 ? (
              <p className="mt-2 text-[13px] text-muted leading-[1.6]">
                사용 처리에서 결제 금액이 기록되면, 지원금을 넘어서 발생한 실제 매출이 여기에 집계돼요.
              </p>
            ) : (
              <>
                <div className="mt-2 flex items-baseline gap-1.5 tabular-nums">
                  <span className="text-[22px] font-bold text-ink tracking-title">+ {winwin.toLocaleString()}원</span>
                  <span className="text-[13px] text-muted">(총 {totalPaid.toLocaleString()}원)</span>
                </div>
                <p className="mt-1.5 text-[13px] text-ink2 leading-[1.6] tabular-nums">
                  결제 금액이 기록된 방문 {paidVisits.length}건 중 <b className="text-ink">{winwinCount}건</b>에서 지원금보다 많이
                  결제했어요!
                </p>
              </>
            )}
          </div>

          {/* ⑥ 주간 방문 추이 — 캘린더 주(월~일) 막대 + 기간별 방문 테이블 */}
          <div className="mx-5 mt-3 rounded-lg border border-hairline bg-canvas p-4">
            <div className="flex items-baseline justify-between">
              <div className="text-[15px] font-bold text-ink tracking-title">주간 방문 추이</div>
              <span className="text-[12px] text-muted">최근 {WEEKS}주</span>
            </div>
            <div className="mt-4 flex items-end gap-1.5 h-[72px]">
              {weeks.map((w, i) => {
                const isNow = i === weeks.length - 1;
                return (
                  <div
                    key={w.start}
                    className={`flex-1 rounded-t-sm ${isNow ? "bg-brand" : "bg-sunken"}`}
                    style={{ height: `${Math.max((w.n / weekMax) * 72, 3)}px` }}
                  />
                );
              })}
            </div>
            <div className="mt-1.5 flex gap-1.5 text-center">
              {weeks.map((w, i) => {
                const isNow = i === weeks.length - 1;
                const md = kstMD(w.start);
                const prevMd = i > 0 ? kstMD(weeks[i - 1].start) : null;
                const showMonth = i === 0 || (prevMd && prevMd.m !== md.m);
                return (
                  <div key={w.start} className="flex-1 min-w-0 leading-tight">
                    {isNow ? (
                      <span className="text-[10px] font-bold text-brand whitespace-nowrap">이번 주</span>
                    ) : (
                      <>
                        <span className="block text-[10px] text-muted tabular-nums">{md.d}{showMonth ? "일" : ""}</span>
                        {showMonth && <span className="block text-[10px] font-semibold text-ink2 tabular-nums">{md.m}월</span>}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 border-t border-hairlineSoft pt-1">
              <div className="flex items-center justify-between py-2 text-[12px] text-muted">
                <span>기간</span>
                <span>방문</span>
              </div>
              {visibleRows.map((w, i) => (
                <div
                  key={w.start}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-md text-[13px] tabular-nums ${
                    i === 0 ? "bg-brandSoft" : ""
                  }`}
                >
                  <span className={i === 0 ? "font-bold text-ink" : "text-ink2"}>
                    {i === 0 ? "이번 주" : weekRangeLabel(w)}
                  </span>
                  <span className={i === 0 ? "text-[15px] font-bold text-brand" : "font-semibold text-ink"}>{w.n}</span>
                </div>
              ))}
              {moreRows.length > 0 && (
                <details className="group">
                  <summary className="cp-action list-none cursor-pointer py-3 text-center text-[13px] font-semibold text-muted">
                    기간 더보기 <span className="inline-block transition-transform group-open:rotate-180">⌄</span>
                  </summary>
                  {moreRows.map((w) => (
                    <div key={w.start} className="flex items-center justify-between px-3 py-2.5 text-[13px] tabular-nums">
                      <span className="text-ink2">{weekRangeLabel(w)}</span>
                      <span className="font-semibold text-ink">{w.n}</span>
                    </div>
                  ))}
                </details>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
