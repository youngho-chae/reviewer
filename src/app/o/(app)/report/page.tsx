import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import Icon from "@/components/Icon";
import ChannelIcons from "@/components/ChannelIcons";
import { CHANNEL_ORDER, CHANNEL_LABEL, RECEIPT_LABEL, KEEP_DAYS } from "@/lib/channels";
import { ownerReviewSummary } from "@/lib/owner-review-status";
import type { Pass, SnsKind } from "@/lib/types";

export const dynamic = "force-dynamic";

// 성과 리포트 (2026-08-10 실측 개편) — 추정·환산 지표 전면 폐기(P4: 실제 발생 이벤트만).
// 구 화면의 추정 노출(리뷰어 영향력×0.3)·CPM·평균 본문 길이(reviewBody — 실경로 미기록)·
// 하드코딩 광고 준수율·db.reviewers 직접 조회(체험자 정보 비노출 정책과 긴장)는 모두 삭제.
// 재설계 = 사장님이 눈으로 직접 확인할 수 있는 실측 신호만:
//  ① 요약 타일 — 체험자 방문(usedAt)·발행 리뷰(completedAt)·**게시 중 리뷰**(검수 완료 후
//     게시 유지 기간 KEEP_DAYS=90일 이내 — "지금 검색하면 보이는 리뷰")
//  ② 모집→방문→리뷰 퍼널 — 기간 내 발급 코호트가 어디까지 진행됐는지 (전환율 ≤100%)
//  ③ 주간 방문 추이 (usedAt — 기간 연동: 30일=4주 / 90일=12주)
//  ④ 채널별 발행 리뷰 분포 — 영수증 리뷰 별도 행 (구 화면의 블로그 오집계 수정)
//  (구 ⑤ 최근 발행 리뷰 리스트는 2026-08-13 제거 — 리뷰 관리(/o/manage?tab=reviews)와 중복)
//  ⑥ 상생 매출 — Σ max(0, paidAmount − supportApplied): 지원금을 넘어서 발생한 실결제
//     매출 (2026-08-10 개정 — 구 "제공한 할인 혜택"은 지출 프레임이라 폐기. use-by-code
//     폴백(paid=support)은 초과분 0으로 떨어지는 하한 집계라 과대 표시 불가 — §12)
//  ⑦ 운영 품질 — 작성 완료율(§4-1 모수 = ownerReviewSummary)·방문 후 평균 제출 소요

const DAY = 86400000;

export default async function OwnerReport({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  // 기간 = 최근 30일 | 최근 90일 (2026-08-13 — 구 "전체 기간"은 무기한 누적이라 폐지.
  // 90일 = 게시 유지 기간(KEEP_DAYS)과 정합 — 리포트가 다루는 실질 활동 창)
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

  // ── ① 요약 타일 — 기간 내 실이벤트 카운트 ──
  const visited = myPasses.filter((p) => inRange(p.usedAt));
  const published = myPasses.filter((p) => p.status === "completed" && inRange(doneAt(p)));
  // 게시 중 = 검수 완료 후 게시 유지 기간(90일) 이내 — 기간 필터와 무관한 "지금" 기준
  const live = myPasses.filter((p) => p.status === "completed" && now - doneAt(p) <= KEEP_DAYS * DAY);

  // ── ② 퍼널 — 기간 내 발급 코호트 기준 (단계 = 부분집합이라 전환율 ≤100%) ──
  const cohort = myPasses.filter((p) => inRange(p.issuedAt));
  const fVisited = cohort.filter((p) => p.usedAt != null);
  const fSubmitted = fVisited.filter((p) => p.reviewSubmittedAt != null);
  const fDone = fSubmitted.filter((p) => p.status === "completed");
  const funnel = [
    { label: "체험권 발급", n: cohort.length },
    { label: "매장 방문", n: fVisited.length },
    { label: "리뷰 제출", n: fSubmitted.length },
    { label: "검수 완료", n: fDone.length },
  ];
  const funnelMax = Math.max(1, cohort.length);

  // ── ③ 주간 방문 추이 (usedAt) — 기간 세그먼트와 연동 (구 8주 고정은 30일 선택 시
  //     "8주 전" 라벨이 맥락과 어긋나던 문제, 2026-08-13) ──
  const WEEKS = range === "30d" ? 4 : 12;
  const weekBuckets: number[] = new Array(WEEKS).fill(0);
  for (const p of myPasses) {
    if (p.usedAt == null) continue;
    const idx = Math.floor((now - p.usedAt) / (7 * DAY));
    if (idx >= 0 && idx < WEEKS) weekBuckets[WEEKS - 1 - idx] += 1;
  }
  const weekMax = Math.max(1, ...weekBuckets);

  // ── ④ 채널별 발행 리뷰 분포 — 영수증은 별도 행 (reviewChannel 없음) ──
  const byChannel: Record<SnsKind, number> = { naver_blog: 0, instagram: 0, tiktok: 0 };
  let receiptCount = 0;
  for (const p of published) {
    if (p.receiptReview) receiptCount += 1;
    else if (p.reviewChannel) byChannel[p.reviewChannel] += 1;
  }
  const channelRows: { key: string; label: string; badge?: SnsKind; n: number }[] = [
    ...CHANNEL_ORDER.map((ch) => ({ key: ch as string, label: CHANNEL_LABEL[ch], badge: ch, n: byChannel[ch] })),
    { key: "receipt", label: RECEIPT_LABEL, n: receiptCount },
  ].filter((r) => r.n > 0);

  // ── ⑥ 상생 매출 (2026-08-10 개정 — 구 "제공한 할인 혜택" 대체) ──
  // "쓴 돈"(지원금 합)이 아니라 지원금을 **넘어서** 발생한 실결제 매출을 보여준다:
  // 상생 매출 = Σ max(0, paidAmount − supportApplied). use-by-code 미입력 폴백(paid=support)은
  // 초과분이 정확히 0으로 떨어져 과대 표시가 불가능한 **하한 집계**다 (§12 원칙 개정).
  const paidVisits = visited.filter((p) => (p.paidAmount ?? 0) > 0);
  const totalPaid = paidVisits.reduce((s, p) => s + (p.paidAmount || 0), 0);
  const winwin = paidVisits.reduce((s, p) => s + Math.max(0, (p.paidAmount || 0) - (p.supportApplied || 0)), 0);
  const winwinCount = paidVisits.filter((p) => (p.paidAmount || 0) > (p.supportApplied || 0)).length;
  const discountShare = totalPaid - winwin; // 결제액 중 할인 지원으로 돌려준 부분

  // ── ⑦ 운영 품질 — 누적 (§4-1 모수: 이용 완료 체험권, 홈·리뷰 관리와 동일 집계) ──
  const summary = ownerReviewSummary(myPasses);
  const completionRate = summary.usedTotal
    ? Math.round(((summary.reviewing + summary.done + summary.resubmit) / summary.usedTotal) * 100)
    : null;
  const leadDays: number[] = myPasses
    .filter((p): p is Pass & { usedAt: number; reviewSubmittedAt: number } => p.usedAt != null && p.reviewSubmittedAt != null)
    .map((p) => (p.reviewSubmittedAt - p.usedAt) / DAY);
  const avgLead = leadDays.length ? Math.round((leadDays.reduce((a, b) => a + b, 0) / leadDays.length) * 10) / 10 : null;

  const empty = myPasses.every((p) => p.usedAt == null);

  return (
    <div className="pb-24 bg-canvas">
      {/* top-app-bar — 뒤로가기 + 타이틀 */}
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-3 flex items-center">
          <Link href="/o/me" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="마이로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
          <h1 className="text-[18px] font-bold text-ink tracking-title">성과 리포트</h1>
        </div>
      </div>
      <p className="px-5 pt-1 text-[13px] text-muted">우리 매장에서 실제 일어난 방문과 리뷰만 집계해요.</p>

      {/* 기간 세그먼트 */}
      <div className="px-5 mt-3 flex gap-2">
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
              range === r.key ? "border-[1.5px] border-ink text-ink" : "border border-hairline text-muted"
            }`}
          >
            {r.label}
          </Link>
        ))}
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
          {/* ① 요약 타일 */}
          <div className="mx-5 mt-4 rounded-lg border border-hairline bg-canvas p-4 grid grid-cols-3 text-center">
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
          <p className="px-5 mt-2 text-[11px] text-muted">
            게시 중 리뷰 = 검수 완료 후 게시 유지 기간({KEEP_DAYS}일) 이내 — 지금 검색하면 보이는 리뷰예요.
          </p>

          {/* ② 모집→방문→리뷰 퍼널 */}
          <div className="mx-5 mt-4 rounded-lg border border-hairline bg-canvas p-4">
            <div className="text-[14px] font-bold text-ink">모집이 리뷰가 되기까지</div>
            <p className="mt-0.5 text-[12px] text-muted">{rangeLabel}에 발급된 체험권 기준</p>
            <div className="mt-3.5 space-y-2.5">
              {funnel.map((f, i) => {
                const prev = i === 0 ? null : funnel[i - 1].n;
                const rate = prev ? Math.round((f.n / prev) * 100) : null;
                return (
                  <div key={f.label}>
                    <div className="flex items-baseline justify-between text-[13px]">
                      <span className="text-ink2">{f.label}</span>
                      <span className="tabular-nums">
                        <span className="font-bold text-ink">{f.n}건</span>
                        {rate != null && prev != null && prev > 0 && (
                          <span className="ml-1.5 text-[11px] text-muted">{rate}%</span>
                        )}
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-pill bg-sunken overflow-hidden">
                      <div className="h-full rounded-pill bg-brand" style={{ width: `${(f.n / funnelMax) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ③ 주간 방문 추이 — 기간 연동 (30일=4주 / 90일=12주) */}
          <div className="mx-5 mt-3 rounded-lg border border-hairline bg-canvas p-4">
            <div className="text-[14px] font-bold text-ink">주간 방문 추이</div>
            <div className="mt-3 flex items-end gap-1.5 h-16">
              {weekBuckets.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted tabular-nums leading-none">{v > 0 ? v : ""}</span>
                  <div className="w-full bg-brandTint rounded-sm" style={{ height: `${(v / weekMax) * 48}px`, minHeight: 2 }} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-muted">
              <span>{WEEKS}주 전</span>
              <span>이번 주</span>
            </div>
          </div>

          {/* ⑥ 상생 매출 — 지원금을 넘어서 발생한 실결제 매출 (아하 모먼트) */}
          <div className="mx-5 mt-3 rounded-lg border border-hairline bg-canvas p-4">
            <div className="text-[14px] font-bold text-ink">상생 매출</div>
            {paidVisits.length === 0 ? (
              <p className="mt-2 text-[13px] text-muted leading-[1.6]">
                사용 처리에서 결제 금액이 기록되면, 지원금을 넘어서 발생한 실제 매출이 여기에 집계돼요.
              </p>
            ) : (
              <>
                <div className="mt-1 text-[22px] font-bold text-ink tracking-title tabular-nums">{winwin.toLocaleString()}원</div>
                <p className="mt-1 text-[13px] text-ink2 leading-[1.6]">
                  체험자들이 지원금 할인보다 <span className="font-bold text-ink">{winwin.toLocaleString()}원 더 결제</span>했어요 — 리뷰와 함께
                  실제 매출로 돌아오고 있어요.
                </p>
                {totalPaid > 0 && (
                  <>
                    {/* 결제 구성 바 — 할인 지원(틴트) vs 상생 매출(퍼플) */}
                    <div className="mt-3 h-2.5 rounded-pill bg-sunken overflow-hidden flex">
                      <div className="h-full bg-brandTint" style={{ width: `${(discountShare / totalPaid) * 100}%` }} />
                      <div className="h-full bg-brand" style={{ width: `${(winwin / totalPaid) * 100}%` }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted tabular-nums">
                      <span>
                        <span className="inline-block w-2 h-2 rounded-full bg-brandTint mr-1 align-middle" aria-hidden />
                        할인 지원 {discountShare.toLocaleString()}원
                      </span>
                      <span>
                        <span className="inline-block w-2 h-2 rounded-full bg-brand mr-1 align-middle" aria-hidden />
                        상생 매출 {winwin.toLocaleString()}원
                      </span>
                    </div>
                  </>
                )}
                <p className="mt-2 text-[11px] text-muted leading-[1.5] tabular-nums">
                  결제 금액이 기록된 방문 {paidVisits.length}건 중 {winwinCount}건에서 지원금보다 많이 결제했어요. (총 결제 {totalPaid.toLocaleString()}원 기준)
                </p>
              </>
            )}
          </div>

          {/* ⑦ 운영 품질 */}
          <div className="mx-5 mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-md border border-hairline bg-canvas p-3 text-center">
              <div className="text-[11px] text-muted">리뷰 작성 완료율 (누적)</div>
              <div className="text-[18px] font-bold text-ink tabular-nums mt-1">
                {completionRate != null ? `${completionRate}%` : "-"}
              </div>
            </div>
            <div className="rounded-md border border-hairline bg-canvas p-3 text-center">
              <div className="text-[11px] text-muted">방문 후 리뷰 제출까지</div>
              <div className="text-[18px] font-bold text-ink tabular-nums mt-1">
                {avgLead != null ? `평균 ${avgLead}일` : "-"}
              </div>
            </div>
          </div>

          {/* ④ 채널별 발행 리뷰 */}
          {channelRows.length > 0 && (
            <>
              <h2 className="px-5 mt-7 text-[18px] font-bold text-ink tracking-title">채널별 발행 리뷰</h2>
              <div className="px-5 mt-3 space-y-2">
                {channelRows.map((r) => (
                  <div key={r.key} className="flex items-center justify-between rounded-md border border-hairline bg-canvas px-3.5 py-3">
                    <div className="flex items-center gap-2">
                      {r.badge ? (
                        <ChannelIcons channels={[r.badge]} />
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-1 rounded-xs bg-sunken text-[12px] font-semibold text-ink2 leading-none">🧾 영수증</span>
                      )}
                      <span className="text-[13px] text-ink">{r.label}</span>
                    </div>
                    <div className="text-[13px] font-bold text-ink tabular-nums">{r.n}건</div>
                  </div>
                ))}
              </div>
            </>
          )}

        </>
      )}
    </div>
  );
}
