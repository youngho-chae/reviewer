import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { readRecentPasses } from "@/lib/recent-passes-cookie";
import { REVIEW_DEADLINE_MS, reviewDeadline } from "@/lib/pass-lifecycle";
import { PRESS_ENABLED, DELIVERY_ENABLED } from "@/lib/flags";
import { supportForGrade } from "@/lib/grade";
import { passDisplayStatus, DISPLAY_BADGE } from "@/lib/pass-display";
import { fmtReservationLabel, fmtExpiryLabel, reservationStatusLabel, cancelledCopy } from "@/lib/reservation";
import GradeBadge from "@/components/GradeBadge";
import PassesView, { type VisitPassItem } from "./PassesView";
import PassPendingBanner from "./PassPendingBanner";
import { SBUI } from "@/lib/storyboard";
import type { Pass, Campaign, Store } from "@/lib/types";

export const dynamic = "force-dynamic";

// 상태 라벨·칩은 src/lib/pass-display.ts의 단일 정의(DISPLAY_BADGE)를 공유 (2026-07-10 — 3중 정의 단일화).
const pressBadge = (p: Pass) => DISPLAY_BADGE[passDisplayStatus(p)] ?? { label: p.status, cls: "bg-sunken text-muted" };

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

  // just_issued — 쿠키 머지 후에도 보이지 않으면 진짜로 발급 실패한 경우.
  const justIssuedVisible = justIssued ? allPasses.some((p) => p.id === justIssued) : true;
  const showJustIssuedBanner = !!justIssued && !justIssuedVisible;
  void recentByPassId;

  const visit = allPasses.filter((p) => findCampaign(p.campaignId)?.kind !== "press");
  const press = allPasses.filter((p) => findCampaign(p.campaignId)?.kind === "press");

  // 목록 카드 데이터 — 클라이언트 PassesView(탭·칩·액션)로 직렬화 전달
  const items: VisitPassItem[] = visit.map((p) => {
    const store = findStore(p.storeId);
    const c = findCampaign(p.campaignId);
    const isDelivery = c?.kind === "delivery";
    return {
      isDelivery,
      // 내 적립 예정 포인트 = 기준 포인트 × 등급 배율 (points.ts와 동일 반올림 — supportForGrade 공유)
      pointReward: isDelivery && c?.pointReward ? supportForGrade(c.pointReward, p.reviewerGrade) : 0,
      id: p.id,
      storeId: p.storeId,
      campaignId: p.campaignId,
      storeName: store?.name ?? "매장",
      category: store?.category ?? "",
      status: p.status,
      displayStatus: passDisplayStatus(p, now),
      channel: p.reviewChannel ?? null,
      grade: p.reviewerGrade,
      support: p.supportApplied ?? supportForGrade(c?.supportAmount ?? 0, p.reviewerGrade),
      expiresAt: p.expiresAt,
      expiryLabel: fmtExpiryLabel(p.expiresAt, !!p.reservation),
      usedAt: p.usedAt ?? null,
      // 리뷰 마감 (§8-2) — used: 예약형은 확정 방문일 기준 +7일(reviewDeadline), 그 외 이용 후 7일 /
      // rejected: 반려 후 7일(재제출 기한)
      reviewDeadline:
        p.status === "rejected" && p.rejectedAt
          ? p.rejectedAt + REVIEW_DEADLINE_MS
          : reviewDeadline(p),
      deadlineKind: p.status === "rejected" ? ("resubmit" as const) : p.usedAt ? ("review" as const) : null,
      rejectReason: p.rejectReason ?? null,
      highlight: p.id === justIssued,
      // 예약형 방문 — active 카드에 예약 일시(12시간제)·상태 강조 (§8-1)
      reservationLabel: p.reservation ? fmtReservationLabel(p.reservation.date, p.reservation.time) : null,
      reservationStatus: p.reservation?.status ?? null,
      reservationStatusLabel: p.reservation ? reservationStatusLabel(p.reservation) : null,
      // 취소 서브 문구 (§15-3) — 주체·원인 구분 (상태명은 '취소'로 통일)
      cancelledNote: p.status === "cancelled" ? cancelledCopy(p.cancelledVia, p.cancelReason) : null,
      // 매장·운영 귀책 취소 — 안내 박스 연보라 강조 (2026-07-23 시안)
      cancelledByOwner: ["owner_declined", "owner_cancelled", "admin_cancelled"].includes(p.cancelledVia ?? ""),
    };
  });

  const pressItems = press.map((p) => {
    const store = findStore(p.storeId);
    const c = findCampaign(p.campaignId);
    return { p, store, c };
  });

  const unread = db.notifications.filter((n) => n.role === "reviewer" && n.userId === me.id && !n.read).length;

  return (
    <div className="pb-24 bg-canvas">
      {pending && <PassPendingBanner pendingId={pending} />}
      {showJustIssuedBanner && justIssued && <PassPendingBanner pendingId={justIssued} />}

      <PassesView
        items={items}
        // 배송형 세그먼트 (2026-07-12 분리) — 플래그 on 또는 과거 배송 패스 보유 시 노출
        showDelivery={DELIVERY_ENABLED || items.some((it) => it.isDelivery)}
        showPress={PRESS_ENABLED || press.length > 0}
        pressCount={press.length}
        unread={unread}
        pressView={
          <div>
            {/* stat-strip — 화이트 + 헤어라인 3열 */}
            <div className="mx-5 mt-5 rounded-lg border border-hairline bg-canvas grid grid-cols-3">
              <div className="py-4 px-3 text-center">
                <div className="text-[12px] text-muted">작성 중</div>
                <div className="mt-1 text-[16px] font-bold text-ink tabular-nums">{press.filter((p) => p.status === "active").length}</div>
              </div>
              <div className="py-4 px-3 text-center border-l border-r border-hairlineSoft">
                <div className="text-[12px] text-muted">검수 중</div>
                <div className="mt-1 text-[16px] font-bold text-ink tabular-nums">{press.filter((p) => p.status === "review_submitted").length}</div>
              </div>
              <div className="py-4 px-3 text-center">
                <div className="text-[12px] text-muted">정산 예정</div>
                <div className="mt-1 text-[14px] font-bold text-ink tabular-nums">{SBUI.payout}</div>
              </div>
            </div>

            <div className="px-5 mt-4 space-y-3 pb-8">
              {pressItems.map(({ p, store, c }) => {
                const actionable = p.status === "active";
                return (
                  <div key={p.id} className="bg-canvas border border-hairline rounded-lg p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <GradeBadge grade={p.reviewerGrade} size="sm" />
                        <span className="inline-flex items-center rounded-xs bg-brandSoft text-brand px-1.5 py-1 text-[12px] font-semibold">기자단</span>
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-pill text-[12px] font-semibold ${pressBadge(p).cls}`}>
                        {p.status === "active" ? "자료 수령" : pressBadge(p).label}
                      </span>
                    </div>
                    <h3 className="text-[16px] font-bold text-ink tracking-title leading-[1.35]">{store?.name}</h3>
                    <p className="text-[13px] text-muted mt-0.5">{store?.area} · {store?.category}</p>

                    <div className="mt-4 pt-4 border-t border-dashed border-hairline">
                      <div className="text-[12px] text-muted">정산 예정금</div>
                      <div className="text-[16px] font-bold text-ink tabular-nums leading-none mt-1">
                        {SBUI.payout}
                      </div>
                      <div className="text-[12px] text-muted mt-1">3.3% 원천징수 후 입금</div>
                    </div>

                    {actionable ? (
                      <Link
                        href={`/r/press/${c?.id}/write?pass=${p.id}`}
                        className="cp-action block mt-4 h-[52px] rounded-md bg-brand text-white grid place-items-center text-[16px] font-bold"
                      >
                        작성 시작 →
                      </Link>
                    ) : p.status === "review_submitted" ? (
                      <div className="mt-4 p-3 bg-sunken rounded-md text-[13px] text-muted text-center">
                        운영팀 검수 중 · 영업일 기준 최대 3일
                      </div>
                    ) : p.status === "rejected" ? (
                      <Link
                        href={`/r/press/${c?.id}/write?pass=${p.id}`}
                        className="cp-action block mt-4 h-11 rounded-md border border-hairline text-error grid place-items-center text-[14px] font-semibold"
                      >
                        반려 사유 확인 · 재제출 →
                      </Link>
                    ) : null}
                  </div>
                );
              })}
              {press.length === 0 && (
                <div className="py-16 text-center">
                  <p className="text-[15px] text-muted">진행 중인 기자단이 없어요.</p>
                  <Link href="/r/home" className="cp-action inline-block mt-4 text-[14px] font-semibold text-brand">홈 기자단 탭에서 신청 →</Link>
                </div>
              )}
            </div>
          </div>
        }
      />
    </div>
  );
}
