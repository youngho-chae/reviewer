import { after } from "next/server";
import Link from "next/link";
import Image from "next/image";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync, persistNaverRefresh } from "@/lib/db";
import { channelOffers, bestEligibleSupport } from "@/lib/grade";
import type { SnsKind } from "@/lib/types";
import { photoForStore } from "@/lib/store-photo";
import { SBUI, sbNum } from "@/lib/storyboard";
import { mockDistanceM, walkMinutes, NEARBY_RADIUS_M } from "@/lib/distance-mock";
import { haversineM, regionCenter } from "@/lib/geo";
import { compareRecommended } from "@/lib/recommend";
import { PLAN_RANK } from "@/lib/plan-policy";
import { isCampaignVisible, campaignExposure, campaignRemain } from "@/lib/campaign-visibility";
import Icon from "@/components/Icon";
import ChannelIcons from "@/components/ChannelIcons";
import HomeLocationChip from "./HomeLocationChip";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface HomeCard {
  storeId: string;
  campaignId: string;
  name: string;
  area: string;
  category: string;
  supportAmount: number;
  requiredChannels: SnsKind[];
  remain: number;
  soldOut: boolean; // 발급 소진(살아있는 체험권만 남음) — 노출 유지 + 발급 마감 표시
  walkMin: number;
  distanceM: number;
  lat?: number;
  lng?: number;
  createdAt: number;
  planRank: number; // 사장님 멤버십 랭크 — 추천순 (§4)
  participating: boolean; // 내가 진행 중인 패스를 보유한 캠페인 — "참여 중" 표시 (§6)
}

export default async function ReviewerHome({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>;
}) {
  const me = await getCurrentReviewer();
  const { area: areaParam } = await searchParams;
  const db = await getDBAsync();
  if (!db.naverDataFetched) {
    after(async () => {
      await persistNaverRefresh();
    });
  }
  const now = Date.now();

  // [노출 정책] 발급 소진 ≠ 종료 — 살아있는 체험권이 남은 캠페인은 계속 노출 (2026-07-07 회의)
  const visitCampaigns = db.campaigns.filter(
    (c) => c.kind === "visit" && isCampaignVisible(c, db.passes, now),
  );

  // [추천순 §4] 사장님 멤버십 플랜 랭크 — 조회 시점 조인 (리뷰어 등급 아님 · P1 무관)
  const ownerPlanRank = new Map(db.owners.map((o) => [o.id, PLAN_RANK[o.plan] ?? 0]));
  // [§6] 이미 참여 중인 캠페인 — 제외하지 않고 "참여 중" 뱃지
  const myCampaignIds = new Set(
    db.passes
      .filter((p) => p.reviewerId === me.id && ["active", "used", "review_submitted"].includes(p.status))
      .map((p) => p.campaignId),
  );

  // [P1] 등급은 참여 자격이 아님 — 금액만 내 채널 등급 기준 개인화.
  const cards: HomeCard[] = visitCampaigns.map((c) => {
    const store = db.stores.find((s) => s.id === c.storeId)!;
    const offers = channelOffers(c.requiredChannels, me.channelGrades, c.supportAmount);
    const myBest = bestEligibleSupport(offers);
    return {
      storeId: store.id,
      campaignId: c.id,
      name: store.name,
      area: store.area,
      category: store.category,
      supportAmount: myBest > 0 ? myBest : c.supportAmount,
      requiredChannels: c.requiredChannels,
      remain: campaignRemain(c),
      soldOut: campaignExposure(c, db.passes, now) === "issued_out",
      walkMin: walkMinutes(store.id),
      distanceM: mockDistanceM(store.id),
      lat: store.lat,
      lng: store.lng,
      createdAt: c.createdAt,
      planRank: ownerPlanRank.get(store.ownerId) ?? 0,
      participating: myCampaignIds.has(c.id),
    };
  });

  // stat-strip — 내 활동 3종 (전부 실데이터 집계 — P4)
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
  const myPasses = db.passes.filter((p) => p.reviewerId === me.id);
  const savedThisMonth = myPasses
    .filter((p) => p.usedAt && p.usedAt >= monthStart && typeof p.supportApplied === "number")
    .reduce((s, p) => s + (p.supportApplied || 0), 0);
  const pendingReviews = myPasses.filter((p) => p.status === "used").length;
  const upcoming = myPasses.filter((p) => p.status === "active").length;

  // 지역 변경(2026-07-07 회의) — 홈에서 지역을 바꾸면 '걸어서 갈 수 있어요'만 해당 지역 기준으로 변경.
  // 전국 체험단 리스트(아래 전체 리스트)는 영향받지 않는다.
  // 2026-07-08: 지역 선택은 /r/location(시도→시군구) 페이지에서 — 임의 지역 라벨을 그대로 수용.
  const selectedArea = areaParam || undefined;

  // 걸어서 갈 수 있어요 — 기준 지점 반경 3km 이내, 가까운 순 최대 10개 · 1단 캐러셀.
  // 지역 선택 시: 그 지역의 기준 좌표(regionCenter)에서 반경 3km 실좌표(하버사인) 필터 (확정 정책 1-3).
  // (기존 area 문자열 정확 일치 방식은 지역 선택 페이지 라벨과 시드 area가 달라 항상 빈 결과였음 — 좌표 기준으로 정정)
  const areaCenter = selectedArea ? regionCenter(selectedArea) : null;
  const nearby = (
    areaCenter
      ? cards
          .filter((p) => p.lat != null && p.lng != null && haversineM(areaCenter, { lat: p.lat!, lng: p.lng! }) <= NEARBY_RADIUS_M)
          .sort(
            (a, b) =>
              haversineM(areaCenter, { lat: a.lat!, lng: a.lng! }) -
              haversineM(areaCenter, { lat: b.lat!, lng: b.lng! }),
          )
      : cards.filter((p) => p.distanceM <= NEARBY_RADIUS_M).sort((a, b) => a.distanceM - b.distanceM)
  ).slice(0, 10);
  // 전국 체험단 전체 리스트 — 추천순(사장님 멤버십 랭크 → 최신순) · 최대 30개 (2026-07-10 §6-3)
  const all = [...cards].sort(compareRecommended).slice(0, 30);

  // 동적 섹션 타이틀 (§6-1) — 특정 지역 선택 시 2차 행정구역명으로: "마포구에서 갈 수 있어요"
  // (라벨 마지막 토큰 = 시군구. STORYBOARD에서는 area 라벨 자체가 "지역"이라 자연 마스킹)
  const walkTitleArea = selectedArea ? selectedArea.trim().split(/\s+/).pop() : null;

  const repArea = cards[0] ? cards[0].area : "내 동네";
  const unread = db.notifications.filter((n) => n.role === "reviewer" && n.userId === me.id && !n.read).length;

  return (
    <div className="pb-24 bg-canvas">
      {/* top-app-bar — 위치 선택 + 검색/알림 */}
      <div className="sticky top-0 z-30 bg-canvas">
        <div className="h-[52px] px-5 flex items-center justify-between">
          <HomeLocationChip fallbackArea={repArea} selectedArea={selectedArea} />
          <div className="flex items-center gap-1">
            <Link href="/r/search" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="검색">
              <Icon name="search" variant="border" size={22} />
            </Link>
            <Link href="/r/notifications" className="cp-action relative w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="알림">
              <Icon name="bell" variant={unread > 0 ? "bold" : "border"} size={22} />
              {unread > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand" />}
            </Link>
          </div>
        </div>
      </div>

      {/* promo-banner — 마케팅 슬롯 (CMS 연동 전 placeholder 카피) */}
      <section className="px-5 pt-2">
        <div className="relative overflow-hidden rounded-lg bg-info text-white p-5 min-h-[104px]">
          <span className="inline-flex items-center px-2.5 py-1 rounded-pill bg-white/20 text-[11px] font-semibold">
            할인쿠폰
          </span>
          <div className="mt-2 text-[16px] font-bold leading-[1.4]">
            프로모션 배너 타이틀
            <br />
            프로모션 배너 서브카피
          </div>
          <div className="absolute right-4 bottom-4 text-[11px] text-white/70">배너 이미지 영역</div>
        </div>
      </section>

      {/* stat-strip — 이번 달 아낀 금액 / 작성해야 하는 리뷰 / 발급받은 체험권 (확정 정책 1-1) */}
      <section className="px-5 mt-3">
        <div className="rounded-lg border border-hairline bg-canvas grid grid-cols-3">
          <div className="py-4 px-3 text-center">
            <div className="text-[12px] text-muted">이번 달 아낀 금액</div>
            <div className="mt-1 text-[16px] font-bold text-ink tabular-nums">{sbNum(SBUI.saved, `${savedThisMonth.toLocaleString()}원`)}</div>
          </div>
          <div className="py-4 px-3 text-center border-l border-r border-hairlineSoft">
            <div className="text-[12px] text-muted">작성할 리뷰</div>
            <div className="mt-1 text-[16px] font-bold text-ink tabular-nums">{sbNum(SBUI.count, `${pendingReviews}건`)}</div>
          </div>
          <Link href="/r/passes" className="cp-action py-4 px-3 text-center block">
            <div className="text-[12px] text-brand font-semibold">🎫 발급받은 체험권</div>
            <div className="mt-1 text-[16px] font-bold text-brand tabular-nums">{sbNum(SBUI.count, `${upcoming}건`)}</div>
          </Link>
        </div>
      </section>

      {/* 걸어서 갈 수 있어요 👀 — 지역 선택 시 "{시군구}에서 갈 수 있어요" (§6-1) */}
      <section className="px-5 mt-8 mb-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[18px] font-bold text-ink tracking-title truncate">
            {walkTitleArea ? `${walkTitleArea}에서 갈 수 있어요` : "걸어서 갈 수 있어요"}
            <span aria-hidden>👀</span>
          </h2>
          {/* [§11] 반경은 도보 거리가 아닌 직선 거리 기준임을 고지 */}
          <p className="mt-0.5 text-[11px] text-mutedSoft">반경 3km · 직선 거리 기준</p>
        </div>
        <Link
          href={`/r/explore?mode=list&sort=distance${selectedArea ? `&area=${encodeURIComponent(selectedArea)}` : ""}`}
          className="cp-action inline-flex items-center text-[13px] text-muted font-medium shrink-0"
        >
          더 둘러보기
          <Icon name="chevron-right" variant="border" size={14} />
        </Link>
      </section>
      {/* 1단 가로 캐러셀 — 최대 10개, 스냅 스크롤 (2026-07-08 회의).
          scrollPaddingLeft 20px: snap-start 기준점을 좌측 패딩 안쪽으로 — 없으면 초기 스냅이 패딩을 침범한다 */}
      <section className="overflow-x-auto snap-x" style={{ scrollbarWidth: "none", scrollPaddingLeft: 20 }}>
        <div className="flex gap-3 px-5">
          {nearby.map((p) => (
            <div key={p.storeId} className="w-[168px] shrink-0 snap-start">
              <ExperienceCard card={p} />
            </div>
          ))}
          {nearby.length === 0 && (
            <div className="w-full py-12 text-center text-muted text-[13px]">
              {selectedArea ? `${selectedArea}에는 지금 모집 중인 체험이 없어요` : "현재 모집 중인 체험이 없어요"}
            </div>
          )}
        </div>
      </section>

      {/* 내가 체험할 수 있는 전체 리스트 👀 */}
      <section className="px-5 mt-9 mb-3 flex items-end justify-between">
        <h2 className="text-[18px] font-bold text-ink tracking-title">
          내가 체험할 수 있는 전체 리스트<span aria-hidden>👀</span>
        </h2>
        {/* 더 둘러보기 → 탐색 (지도 기본 · 추천순 기본), 선택 지역 전달 (§6-4) */}
        <Link
          href={`/r/explore${selectedArea ? `?area=${encodeURIComponent(selectedArea)}` : ""}`}
          className="cp-action inline-flex items-center text-[13px] text-muted font-medium shrink-0"
        >
          더 둘러보기
          <Icon name="chevron-right" variant="border" size={14} />
        </Link>
      </section>
      <section className="px-5 grid grid-cols-2 gap-x-3 gap-y-6">
        {all.map((p) => (
          <ExperienceCard key={`all-${p.storeId}`} card={p} />
        ))}
        {all.length === 0 && (
          <div className="col-span-2 py-12 text-center text-muted text-[13px]">지금은 동네가 잠깐 쉬는 중</div>
        )}
      </section>
    </div>
  );
}

/* experience-card — 4:3 사진 + SNS 배지 + 🎫 남음 + 가게명 + 최대 ₩N 지원 (DESIGN.md v2) */
function ExperienceCard({ card }: { card: HomeCard }) {
  return (
    <Link href={`/r/store/${card.storeId}?campaign=${card.campaignId}`} className="cp-action block">
      <div className="aspect-[4/3] bg-sunken relative overflow-hidden rounded-md">
        <Image
          src={photoForStore(card.storeId, card.category)}
          alt={card.name}
          fill
          sizes="(max-width: 480px) 50vw, 240px"
          className="object-cover"
        />
      </div>
      <div className="mt-2">
        <div className="flex items-center gap-1.5">
          <ChannelIcons channels={card.requiredChannels} size={12} />
          {/* [§6] 이미 신청한 캠페인 — 제외 대신 "참여 중" 표시 */}
          {card.participating && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-xs bg-brandSoft text-brand text-[11px] font-semibold">
              참여 중
            </span>
          )}
        </div>
        {card.soldOut ? (
          <div className="mt-1.5 text-[13px] font-semibold text-mutedSoft">발급 마감 · 체험 진행 중</div>
        ) : (
          <div className="mt-1.5 text-[13px] font-semibold text-ink2 flex items-center gap-1">
            <span aria-hidden>🎫</span>
            <span className="tabular-nums">{sbNum(SBUI.remain, `${card.remain}개`)}</span> 남음
          </div>
        )}
        <div className="mt-0.5 text-[15px] font-semibold text-ink truncate">{card.name}</div>
        <div className="mt-0.5 text-[16px] font-bold text-ink tabular-nums">최대 {SBUI.support} 지원</div>
      </div>
    </Link>
  );
}
