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
//  ③ 최근 8주 방문 추이 (usedAt 기준)
//  ④ 채널별 발행 리뷰 분포 — 영수증 리뷰 별도 행 (구 화면의 블로그 오집계 수정)
//  ⑤ 최근 발행 리뷰 [리뷰 보러가기] — 실제 게시물 확인 (리텐션 핵심)
//  ⑥ 투자 효율 — supportApplied 실지출 합계 + 리뷰 1건당 (P2: 매장 직접 할인·무정산.
//     paidAmount는 use-by-code 미입력 폴백으로 실결제액 신뢰 불가 — 매출 지표 미사용)
//  ⑦ 운영 품질 — 작성 완료율(§4-1 모수 = ownerReviewSummary)·방문 후 평균 제출 소요

const DAY = 86400000;

function fmtD(t: number): string {
  return new Date(t + 9 * 3600000).toISOString().slice(0, 10).replace(/-/g, ".");
}

export default async function OwnerReport({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const range: "30d" | "all" = rangeParam === "all" ? "all" : "30d";
  const me = await getCurrentOwner();
  const db = await getDBAsync();
  const now = Date.now();
  const since = range === "30d" ? now - 30 * DAY : 0;
  const inRange = (t?: number) => t != null && t >= since;

  const myPasses = db.passes.filter((p) => p.ownerId === me.id);
  const campaignTitle = (id: string) => db.campaigns.find((c) => c.id === id)?.title ?? "";

  // ── ① 요약 타일 — 기간 내 실이벤트 카운트 ──
  const visited = myPasses.filter((p) => inRange(p.usedAt));
  const published = myPasses.filter((p) => p.status === "completed" && inRange(p.completedAt));
  // 게시 중 = 검수 완료 후 게시 유지 기간(90일) 이내 — 기간 필터와 무관한 "지금" 기준
  const live = myPasses.filter((p) => p.status === "completed" && p.completedAt != null && now - p.completedAt <= KEEP_DAYS * DAY);

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

  // ── ③ 최근 8주 방문 추이 (usedAt) ──
  const WEEKS = 8;
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

  // ── ⑤ 최근 발행 리뷰 5건 ──
  const recent = [...published]
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
    .slice(0, 5);

  // ── ⑥ 투자 효율 — 기간 내 사용 처리 건의 적용 지원금 합 (실지출) ──
  const totalSupport = visited.reduce((s, p) => s + (p.supportApplied || 0), 0);
  const perReview = published.length ? Math.round(totalSupport / published.length) : null;

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
            { key: "all", label: "전체 기간" },
          ] as const
        ).map((r) => (
          <Link
            key={r.key}
            href={r.key === "30d" ? "/o/report" : "/o/report?range=all"}
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
            <p className="mt-0.5 text-[12px] text-muted">{range === "30d" ? "최근 30일" : "전체 기간"}에 발급된 체험권 기준</p>
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

          {/* ③ 최근 8주 방문 추이 */}
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

          {/* ⑥ 투자 효율 — 실지출 기준 */}
          <div className="mx-5 mt-3 rounded-lg border border-hairline bg-canvas p-4">
            <div className="text-[14px] font-bold text-ink">제공한 할인 혜택</div>
            <div className="mt-1 text-[22px] font-bold text-ink tracking-title tabular-nums">{totalSupport.toLocaleString()}원</div>
            {perReview != null && (
              <div className="mt-1 text-[12px] text-muted tabular-nums">발행 리뷰 1건당 약 {perReview.toLocaleString()}원</div>
            )}
            <p className="mt-2 text-[11px] text-muted leading-[1.5]">
              체험자 방문 시 결제에서 직접 할인해 준 금액의 합계예요. 별도 광고비 정산 없이 이 금액만으로 리뷰가 발행돼요.
            </p>
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

          {/* ⑤ 최근 발행 리뷰 — 실제 게시물 확인 */}
          <div className="px-5 mt-7 flex items-baseline justify-between">
            <h2 className="text-[18px] font-bold text-ink tracking-title">최근 발행된 리뷰</h2>
            <Link href="/o/manage?tab=reviews" className="cp-action text-[13px] font-semibold text-brand">
              전체 보기
            </Link>
          </div>
          <div className="px-5 mt-3 space-y-2">
            {recent.length === 0 && (
              <div className="rounded-md border border-hairline bg-canvas px-4 py-5 text-center text-[13px] text-muted">
                {range === "30d" ? "최근 30일에 발행된 리뷰가 없어요" : "발행된 리뷰가 아직 없어요"}
              </div>
            )}
            {recent.map((p) => (
              <div key={p.id} className="rounded-md border border-hairline bg-canvas px-4 py-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-ink truncate">{campaignTitle(p.campaignId)}</div>
                    <div className="mt-1 flex items-center gap-2 text-[12px] text-muted tabular-nums">
                      {p.reviewChannel ? (
                        <ChannelIcons channels={[p.reviewChannel]} size={14} />
                      ) : p.receiptReview ? (
                        <span className="inline-flex items-center px-1 py-0.5 rounded-xs bg-sunken text-[10px] font-semibold text-ink2 leading-none">🧾 영수증</span>
                      ) : null}
                      <span>{p.completedAt ? fmtD(p.completedAt) : ""} 발행</span>
                    </div>
                  </div>
                  {p.reviewUrl && (
                    <a
                      href={p.reviewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="cp-action shrink-0 inline-flex items-center gap-1 text-[13px] font-semibold text-brand"
                    >
                      리뷰 보러가기 <Icon name="arrow-right" variant="border" size={13} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
