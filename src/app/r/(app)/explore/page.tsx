import { after } from "next/server";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync, persistNaverRefresh } from "@/lib/db";
import { channelOffers, bestEligibleSupport } from "@/lib/grade";
import { DELIVERY_ENABLED } from "@/lib/flags";
import { isCampaignVisible, campaignExposure, campaignRemain } from "@/lib/campaign-visibility";
import { PLAN_RANK } from "@/lib/plan-policy";
import { effectiveChannelState } from "@/lib/sns-cookie";
import type { SnsKind } from "@/lib/types";
import ExploreView, { ExploreStoreCard, ExploreDeliveryCard } from "./ExploreView";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ReviewerExplore({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; cat?: string; sort?: string; q?: string; ch?: string; area?: string; scope?: string; loc?: string; tab?: string; v?: string; dcat?: string }>;
}) {
  const me = await getCurrentReviewer();
  // 인스턴스 불일치 스톱갭 — 연동 직후 금액 개인화가 최신 채널 등급 기준으로 (sns-cookie.ts)
  const eff = await effectiveChannelState(me);
  const db = await getDBAsync();
  if (!db.naverDataFetched) {
    after(async () => {
      await persistNaverRefresh();
    });
  }
  const sp = await searchParams;
  const now = Date.now();

  // [추천순] 사장님 멤버십 플랜 랭크 조인 — storeId → Store.ownerId → Owner.plan (현재 플랜 적용).
  // [P1] 리뷰어 등급과 무관한 사장님 멤버십 기준 노출 우대 — 참여 자격에는 영향 없음.
  const ownerPlanRank = new Map(db.owners.map((o) => [o.id, PLAN_RANK[o.plan] ?? 0]));
  // [2026-07-12 회의 §1-3] 카드 '참여 중' 배지 삭제 — 신청 상태는 상세 CTA(내 체험권 보기)로 구분

  // [노출 정책] 발급 소진 ≠ 종료 — 살아있는 체험권이 남은 캠페인은 계속 노출 (2026-07-07 회의)
  const cards: ExploreStoreCard[] = db.campaigns
    .filter((c) => c.kind === "visit" && isCampaignVisible(c, db.passes, now))
    .map((c) => {
      const store = db.stores.find((s) => s.id === c.storeId)!;
      const totalQ = c.quota.S + c.quota.A + c.quota.B + c.quota.C;
      // [P1] 등급은 참여 자격이 아님 — 연동 채널의 내 등급으로 받을 수 있는 가장 큰 혜택을
      // 노출하고, 연동 채널이 없으면 기준 지원금(S 100% 최대치)을 노출한다.
      const offers = channelOffers(c.requiredChannels, eff.channelGrades, c.supportAmount);
      const myBest = bestEligibleSupport(offers);
      return {
        storeId: store.id,
        campaignId: c.id,
        name: store.name,
        area: store.area,
        category: store.category,
        coverEmoji: store.coverEmoji,
        lat: store.lat ?? 37.5665,
        lng: store.lng ?? 126.978,
        supportAmount: myBest > 0 ? myBest : c.supportAmount,
        requiredChannels: c.requiredChannels,
        remain: campaignRemain(c),
        soldOut: campaignExposure(c, db.passes, now) === "issued_out",
        totalQuota: totalQ,
        rating: store.rating,
        reviewCount: store.reviewCount,
        endAt: c.endAt,
        createdAt: c.createdAt,
        planRank: ownerPlanRank.get(store.ownerId) ?? 0,
        // 검색 확장(확정 정책 2-1) — 지역명(주소)·강조 키워드까지 검색 대상
        address: store.address,
        keywords: c.highlightKeywords,
        // 참여 방식 필터·예약 배지 (2026-07-12) — 방문 전 예약 필수 여부
        reservationRequired: c.reservationRequired ?? false,
        // 카드 캐러셀 사진 (2026-07-17) — 사장님 등록 사진 (미보유 시 클라이언트 폴백)
        photos: c.photos,
      };
    });

  // [§6-4] scope=all — 홈 '전체 리스트' 더 둘러보기 진입: 전국 축소(시도 클러스터) 시작.
  // 전국 우선이므로 지역 파라미터는 무시한다.
  const nationwide = sp.scope === "all";
  // [§5 지역 연동] 홈에서 선택한 지역(?area=) — ExploreView가 regionCenter로 기준점을 해석해
  // 지도 초기 포커스(반경 3km)·리스트 거리 기준점으로 쓴다. ?ch=는 필터 재진입 복원.
  const initialArea = nationwide ? null : sp.area || null;
  // 지역 필터 3상태(2026-07-10) — ?loc=me = 현위치 필터 재진입 복원 (미선택이 기본값, 전국 진입은 무시)
  const initialLoc = nationwide ? null : sp.loc || null;
  const validChannels: SnsKind[] = ["naver_blog", "instagram", "tiktok"];
  const initialChannels = (sp.ch ? sp.ch.split(",") : []).filter((c): c is SnsKind =>
    (validChannels as string[]).includes(c),
  );

  // 배송형 (2026-07-12 레뷰 벤치마크) — 지역 무관 전국 참여, 리스트 전용 세그먼트
  const deliveryCards: ExploreDeliveryCard[] = db.campaigns
    .filter((c) => DELIVERY_ENABLED && c.kind === "delivery" && isCampaignVisible(c, db.passes, now))
    .map((c) => {
      const store = db.stores.find((s) => s.id === c.storeId)!;
      const totalQ = c.quota.S + c.quota.A + c.quota.B + c.quota.C;
      return {
        campaignId: c.id,
        storeId: store.id,
        storeName: store.name,
        area: store.area,
        // 상품 카테고리 (2026-07-12 정정) — 배송형은 플레이스 분류가 아닌 상품군 분류
        // (delivery-categories.ts). 구버전 데이터는 스토어 분류로 폴백.
        category: c.productCategory ?? store.category,
        coverEmoji: store.coverEmoji,
        productValue: c.supportAmount,
        pointReward: c.pointReward ?? 0,
        requiredChannels: c.requiredChannels,
        remain: campaignRemain(c),
        soldOut: campaignExposure(c, db.passes, now) === "issued_out",
        endAt: c.endAt,
        createdAt: c.createdAt,
        planRank: ownerPlanRank.get(store.ownerId) ?? 0,
        keywords: c.highlightKeywords,
        totalQuota: totalQ,
        photos: c.photos, // 카드 캐러셀 사진 (2026-07-17)
      } as ExploreDeliveryCard;
    });

  // 지도 클라이언트 ID는 env로만 주입 (미설정 시 SDK 로드 실패 → 리스트 폴백 카드).
  // NEXT_PUBLIC_ 전용 변수가 없으면 서버 지도 키(NAVER_MAP_CLIENT_ID)로 폴백한다 —
  // page.tsx는 force-dynamic 서버 컴포넌트라 런타임에 서버 env를 읽어 prop으로 넘길 수 있고,
  // client ID는 SDK URL에 그대로 노출되는 공개 값이므로 클라이언트 전달이 안전하다.
  const mapClientId =
    process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ||
    process.env.NAVER_MAP_CLIENT_ID ||
    "";
  if (!mapClientId) {
    // 런타임 env에 지도 키가 없음 → 탐색에서 "지도를 불러올 수 없어요" 폴백.
    // 배포 로그에서 이 경고가 보이면 env 미설정/미배포가 원인 (도메인 허용 문제가 아님).
    console.warn(
      "[map] Naver map client ID missing at runtime — set NAVER_MAP_CLIENT_ID (or NEXT_PUBLIC_NAVER_MAP_CLIENT_ID) in the deployment env and redeploy.",
    );
  }
  const unread = db.notifications.filter((n) => n.role === "reviewer" && n.userId === me.id && !n.read).length;

  return (
    <ExploreView
      cards={cards}
      mapClientId={mapClientId}
      unread={unread}
      // 방문형 탐색의 기본 화면은 지도 보기 (2026-07-07 회의)
      initialMode={sp.mode === "list" ? "list" : "map"}
      initialCategory={sp.cat || "전체"}
      initialSort={(sp.sort as "recommended" | "distance" | "new" | "topSupport" | "closing") || "recommended"}
      initialSearch={sp.q || ""}
      initialChannels={initialChannels}
      initialArea={initialArea}
      initialLoc={initialLoc}
      initialNationwide={nationwide}
      deliveryCards={deliveryCards}
      deliveryEnabled={DELIVERY_ENABLED}
      initialTab={sp.tab === "delivery" ? sp.tab : "visit"}
      // 참여 방식(?v=) · 배송형 상품 카테고리(?dcat=) 복원 (2026-07-12)
      initialVisitMode={sp.v === "walkin" || sp.v === "reserve" ? sp.v : "all"}
      initialDvCats={sp.dcat ? sp.dcat.split(",") : []}
    />
  );
}
