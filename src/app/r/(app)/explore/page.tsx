import { after } from "next/server";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync, persistNaverRefresh } from "@/lib/db";
import { channelOffers, bestEligibleSupport } from "@/lib/grade";
import { PRESS_ENABLED } from "@/lib/flags";
import { isCampaignVisible, campaignExposure, campaignRemain } from "@/lib/campaign-visibility";
import ExploreView, { ExploreStoreCard, ExplorePressCard } from "./ExploreView";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ReviewerExplore({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; cat?: string; sort?: string; q?: string }>;
}) {
  const me = await getCurrentReviewer();
  const db = await getDBAsync();
  if (!db.naverDataFetched) {
    after(async () => {
      await persistNaverRefresh();
    });
  }
  const sp = await searchParams;
  const now = Date.now();

  // [노출 정책] 발급 소진 ≠ 종료 — 살아있는 체험권이 남은 캠페인은 계속 노출 (2026-07-07 회의)
  const cards: ExploreStoreCard[] = db.campaigns
    .filter((c) => c.kind === "visit" && isCampaignVisible(c, db.passes, now))
    .map((c) => {
      const store = db.stores.find((s) => s.id === c.storeId)!;
      const totalQ = c.quota.S + c.quota.A + c.quota.B + c.quota.C;
      // [P1] 등급은 참여 자격이 아님 — 연동 채널의 내 등급으로 받을 수 있는 가장 큰 혜택을
      // 노출하고, 연동 채널이 없으면 기준 지원금(S 100% 최대치)을 노출한다.
      const offers = channelOffers(c.requiredChannels, me.channelGrades, c.supportAmount);
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
        // 검색 확장(확정 정책 2-1) — 지역명(주소)·강조 키워드까지 검색 대상
        address: store.address,
        keywords: c.highlightKeywords,
      };
    });

  // [MVP] 기자단 제외 — 플래그가 꺼져 있으면 기자단 카드를 만들지 않는다
  const pressCards: ExplorePressCard[] = db.campaigns
    .filter((c) => PRESS_ENABLED && c.kind === "press" && c.endAt > now)
    .map((c) => {
      const store = db.stores.find((s) => s.id === c.storeId)!;
      const totalQ = c.quota.S + c.quota.A + c.quota.B + c.quota.C;
      const usedQ = c.used.S + c.used.A + c.used.B + c.used.C;
      return {
        campaignId: c.id,
        storeId: store.id,
        storeName: store.name,
        area: store.area,
        category: store.category,
        coverEmoji: store.coverEmoji,
        payout: c.supportAmount,
        slotsLeft: totalQ - usedQ,
        slotsTotal: totalQ,
        kitPhotos: c.pressMaterials?.length || 8,
        daysLeft: Math.max(0, Math.ceil((c.endAt - now) / 86400000)),
        endAt: c.endAt,
        createdAt: c.createdAt,
      };
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
      pressCards={pressCards}
      mapClientId={mapClientId}
      unread={unread}
      // 방문형 탐색의 기본 화면은 지도 보기 (2026-07-07 회의)
      initialMode={sp.mode === "list" ? "list" : "map"}
      initialCategory={sp.cat || "전체"}
      initialSort={(sp.sort as "recommended" | "distance" | "new" | "topSupport" | "closing") || "recommended"}
      initialSearch={sp.q || ""}
      pressEnabled={PRESS_ENABLED}
    />
  );
}
