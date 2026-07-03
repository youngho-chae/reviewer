import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { readRecentPasses } from "@/lib/recent-passes-cookie";
import GradeBadge from "@/components/GradeBadge";
import PassesTabs from "./PassesTabs";
import PassPendingBanner from "./PassPendingBanner";
import type { Pass, Campaign, Store } from "@/lib/types";

export const dynamic = "force-dynamic";

const REVIEW_DEADLINE_MS = 72 * 60 * 60 * 1000;

const statusLabel = (s: string) => ({
  active: "사용 가능",
  used: "리뷰 작성 대기",
  review_submitted: "검수 대기",
  completed: "완료",
  expired: "만료",
  cancelled: "취소함",
  rejected: "반려",
} as any)[s] || s;

const statusCls = (s: string) => ({
  active: "text-brand",
  used: "text-ink",
  review_submitted: "text-muted",
  completed: "text-brand",
  expired: "text-mutedSoft",
  cancelled: "text-mutedSoft",
  rejected: "text-error",
} as any)[s] || "text-muted";

export default async function MyPasses({
  searchParams,
}: {
  searchParams: Promise<{ pending?: string; just_issued?: string }>;
}) {
  const me = await getCurrentReviewer();
  const { pending, just_issued: justIssued } = await searchParams;
  const db = await getDBAsync();
  // 쿠키 stopgap — 발급 세션에서만 보존되는 본인 시점 데이터
  const recent = await readRecentPasses();
  const recentByPassId = new Map(recent.map((r) => [r.pass.id, r]));

  // db에 없는 쿠키 패스를 보충 (본인 한정)
  const dbPassIds = new Set(db.passes.map((p) => p.id));
  const supplementalPasses: Pass[] = recent
    .filter((r) => r.pass.reviewerId === me.id && !dbPassIds.has(r.pass.id))
    .map((r) => r.pass);

  const mergedPasses: Pass[] = [
    ...db.passes.filter((p) => p.reviewerId === me.id),
    ...supplementalPasses,
  ];
  // 캠페인/매장 lookup — db 우선, 없으면 쿠키
  const findCampaign = (id: string): Partial<Campaign> | undefined => {
    const fromDb = db.campaigns.find((x) => x.id === id);
    if (fromDb) return fromDb;
    for (const r of recent) if (r.campaign?.id === id) return r.campaign;
    return undefined;
  };
  const findStore = (id: string): Partial<Store> | undefined => {
    const fromDb = db.stores.find((x) => x.id === id);
    if (fromDb) return fromDb;
    for (const r of recent) if (r.store?.id === id) return r.store;
    return undefined;
  };

  // pending=passId — 상세 404 안전망에서 redirect. 발견 시 적절한 상세로 즉시 이동.
  if (pending) {
    const found = mergedPasses.find((p) => p.id === pending);
    if (found) {
      const camp = findCampaign(found.campaignId);
      if (camp?.kind === "press") {
        redirect(`/r/press/${camp.id}/write?pass=${found.id}`);
      }
      redirect(`/r/passes/${found.id}`);
    }
  }

  const allPasses = mergedPasses.sort((a, b) => b.issuedAt - a.issuedAt);

  const now = Date.now();
  for (const p of allPasses) {
    if (p.status === "active" && now > p.expiresAt) p.status = "expired";
  }

  // just_issued — 이제 쿠키 머지 후에도 보이지 않으면 진짜로 발급 실패한 경우.
  // 정상 케이스에서는 cookie 또는 db 둘 중 하나에 반드시 존재.
  const justIssuedVisible = justIssued ? allPasses.some((p) => p.id === justIssued) : true;
  const showJustIssuedBanner = !!justIssued && !justIssuedVisible;
  // 참조 노출용 — recentByPassId는 detail 페이지에서도 활용
  void recentByPassId;

  const visit = allPasses.filter((p) => findCampaign(p.campaignId)?.kind !== "press");
  const press = allPasses.filter((p) => findCampaign(p.campaignId)?.kind === "press");

  const visitItems = visit.map((p) => {
    const store = findStore(p.storeId);
    const c = findCampaign(p.campaignId);
    const remainMs = p.expiresAt - now;
    const days = Math.max(0, Math.floor(remainMs / 86400000));
    const hours = Math.max(0, Math.floor((remainMs / 3600000) % 24));
    let reviewLeft: { d: number; h: number; expired: boolean } | null = null;
    if (p.status === "used" && p.usedAt) {
      const r = p.usedAt + REVIEW_DEADLINE_MS - now;
      if (r <= 0) reviewLeft = { d: 0, h: 0, expired: true };
      else {
        reviewLeft = {
          d: Math.floor(r / 86400000),
          h: Math.floor((r % 86400000) / 3600000),
          expired: false,
        };
      }
    }
    return { p, store, c, days, hours, reviewLeft, highlight: p.id === justIssued };
  });

  const pressItems = press.map((p) => {
    const store = findStore(p.storeId);
    const c = findCampaign(p.campaignId);
    return { p, store, c };
  });

  const pendingPay = press
    .filter((p) => p.status === "review_submitted")
    .reduce((s, p) => {
      const c = db.campaigns.find((x) => x.id === p.campaignId);
      return s + (c?.supportAmount || 0);
    }, 0);

  return (
    <div className="pb-24 bg-canvas">
      {/* Sub-nav */}
      <div className="sticky top-0 z-10 frosted-parchment border-b border-hairlineSoft">
        <div className="h-13 px-5 flex items-center">
          <h1 className="text-[21px] font-semibold text-ink tracking-[-0.011em]">내 체험권</h1>
        </div>
      </div>

      {pending && <PassPendingBanner pendingId={pending} />}
      {showJustIssuedBanner && justIssued && (
        <PassPendingBanner pendingId={justIssued} />
      )}

      <PassesTabs
        visitCount={visit.length}
        pressCount={press.length}
        visitView={
          <div className="px-6 mt-6 space-y-3 pb-8">
            {visitItems.map(({ p, store, c, days, hours, reviewLeft, highlight }) => {
              // 우측 하단 메타 — 상태별 표시: active=유효기간, used=리뷰 마감, 그 외=상태 라벨
              let rightLabel = "유효기간";
              let rightValue: string = statusLabel(p.status);
              if (p.status === "active") {
                rightValue = `${days}일 ${hours}시간`;
              } else if (p.status === "used" && reviewLeft) {
                rightLabel = "리뷰 마감";
                rightValue = reviewLeft.expired ? "마감 지남" : `${reviewLeft.d}일 ${reviewLeft.h}시간`;
              }
              return (
                <Link
                  key={p.id}
                  href={`/r/passes/${p.id}`}
                  className={`cp-action block bg-canvas border rounded-lg p-6 ${highlight ? "border-brand shadow-[0_0_0_3px_rgba(0,102,204,0.12)]" : "border-hairline"}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <GradeBadge grade={p.reviewerGrade} size="sm" />
                      <span className="text-[12px] tracking-[0.18em] uppercase text-muted">{p.reviewerGrade}등급</span>
                    </div>
                    <span className={`text-[13px] font-medium ${statusCls(p.status)}`}>{statusLabel(p.status)}</span>
                  </div>
                  <h3 className="font-display text-[24px] leading-[1.14] text-ink">{store?.name}</h3>
                  <p className="text-[14px] text-muted mt-1">{store?.area} · {store?.category}</p>
                  <div className="flex items-end justify-between mt-5 pt-4 border-t border-dashed border-hairline">
                    <div>
                      <div className="text-[12px] text-muted">할인 금액</div>
                      <div className="text-[22px] font-semibold text-ink tracking-[-0.022em] leading-none mt-1">
                        ₩{(c?.supportAmount ?? 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[12px] text-muted">{rightLabel}</div>
                      <div className={`text-[14px] mt-1 ${p.status === "used" && reviewLeft && !reviewLeft.expired ? "text-brand font-semibold" : "text-ink"}`}>
                        {rightValue}
                      </div>
                    </div>
                  </div>
                  {highlight && (
                    <div className="mt-4 pt-4 border-t border-hairline text-[12px] text-brand font-semibold">
                      ✓ 방금 발급된 체험권이에요
                    </div>
                  )}
                </Link>
              );
            })}
            {visit.length === 0 && (
              <div className="py-16 text-center">
                <p className="text-[17px] text-muted">아직 발급된 방문형 체험권이 없어요.</p>
                <Link href="/r/home" className="cp-action inline-block mt-4 text-[15px] text-brand">홈에서 체험권 받기 →</Link>
              </div>
            )}
          </div>
        }
        pressView={
          <div>
            {/* Stat strip — Apple parchment utility row */}
            <div className="mx-6 mt-6 p-5 bg-parchment border border-hairline rounded-lg grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-[19px] font-semibold tracking-[-0.022em] text-ink leading-none">{press.filter((p) => p.status === "active").length}</div>
                <div className="text-[11px] text-muted mt-2">작성 중</div>
              </div>
              <div className="text-center border-l border-r border-hairline">
                <div className="text-[19px] font-semibold tracking-[-0.022em] text-ink leading-none">{press.filter((p) => p.status === "review_submitted").length}</div>
                <div className="text-[11px] text-muted mt-2">검수 중</div>
              </div>
              <div className="text-center">
                <div className="text-[15px] font-semibold tracking-[-0.022em] text-ink leading-none">₩{Math.round(pendingPay / 1000)}K</div>
                <div className="text-[11px] text-muted mt-2">정산 예정</div>
              </div>
            </div>

            <div className="px-6 mt-5 space-y-3 pb-8">
              {pressItems.map(({ p, store, c }) => {
                const actionable = p.status === "active";
                return (
                  <div key={p.id} className="bg-canvas border border-hairline rounded-lg p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <GradeBadge grade={p.reviewerGrade} size="sm" />
                        <span className="text-[12px] tracking-[0.18em] uppercase text-muted">기자단</span>
                      </div>
                      <span className={`text-[13px] font-medium ${statusCls(p.status)}`}>
                        {p.status === "active" ? "자료 수령" : statusLabel(p.status)}
                      </span>
                    </div>
                    <h3 className="font-display text-[22px] leading-[1.14] text-ink">{store?.name}</h3>
                    <p className="text-[14px] text-muted mt-1">{store?.area} · {store?.category}</p>

                    <div className="mt-4 pt-4 border-t border-hairline">
                      <div className="text-[12px] text-muted">정산 예정금</div>
                      <div className="text-[26px] font-semibold text-ink tracking-[-0.022em] leading-none mt-1">
                        ₩{(c?.supportAmount ?? 0).toLocaleString()}
                      </div>
                      <div className="text-[12px] text-muted mt-1">3.3% 원천징수 후 입금</div>
                    </div>

                    {actionable ? (
                      <Link
                        href={`/r/press/${c?.id}/write?pass=${p.id}`}
                        className="cp-action block mt-5 h-11 rounded-pill bg-brand text-white grid place-items-center text-[15px]"
                      >
                        작성 시작 →
                      </Link>
                    ) : p.status === "review_submitted" ? (
                      <div className="mt-5 p-3 bg-parchment rounded-sm text-[13px] text-muted text-center">
                        운영팀 검수 중 · 최대 72시간
                      </div>
                    ) : p.status === "rejected" ? (
                      <Link
                        href={`/r/press/${c?.id}/write?pass=${p.id}`}
                        className="cp-action block mt-5 h-11 rounded-pill border border-error/40 text-error grid place-items-center text-[14px]"
                      >
                        반려 사유 확인 · 재제출 →
                      </Link>
                    ) : null}
                  </div>
                );
              })}
              {press.length === 0 && (
                <div className="py-16 text-center">
                  <p className="text-[17px] text-muted">진행 중인 기자단이 없어요.</p>
                  <Link href="/r/home" className="cp-action inline-block mt-4 text-[15px] text-brand">홈 기자단 탭에서 신청 →</Link>
                </div>
              )}
            </div>
          </div>
        }
      />
    </div>
  );
}
