import { after } from "next/server";
import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync, persistNaverRefresh } from "@/lib/db";
import { channelOffers, bestEligibleSupport } from "@/lib/grade";
import Icon from "@/components/Icon";
import ExploreView, { ExploreStoreCard, ExplorePressCard } from "./ExploreView";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ReviewerExplore({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; cat?: string; sort?: string }>;
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

  const cards: ExploreStoreCard[] = db.campaigns
    .filter((c) => c.kind === "visit" && c.endAt > now)
    .map((c) => {
      const store = db.stores.find((s) => s.id === c.storeId)!;
      const totalQ = c.quota.S + c.quota.A + c.quota.B + c.quota.C;
      const usedQ = c.used.S + c.used.A + c.used.B + c.used.C;
      const remain = totalQ - usedQ;
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
        remain,
        totalQuota: totalQ,
        rating: store.rating,
        reviewCount: store.reviewCount,
        endAt: c.endAt,
        createdAt: c.createdAt,
      };
    });

  const pressCards: ExplorePressCard[] = db.campaigns
    .filter((c) => c.kind === "press" && c.endAt > now)
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

  // 지도 클라이언트 ID는 env로만 주입 (미설정 시 SDK 로드 실패 → 리스트 폴백 카드)
  const mapClientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || "";
  const activePassCount = db.passes.filter(
    (p) => p.reviewerId === me.id && (p.status === "active" || p.status === "used"),
  ).length;
  const unread = db.notifications.filter((n) => n.role === "reviewer" && n.userId === me.id && !n.read).length;

  const topBar = (
    <div className="sticky top-0 z-30 frosted-parchment border-b border-hairlineSoft">
      <div className="h-13 px-5 flex items-center justify-between">
        <div className="text-[15px] font-semibold text-ink">탐색</div>
        <Link
          href="/r/notifications"
          className="cp-action relative w-9 h-9 rounded-full flex items-center justify-center text-ink"
          aria-label="알림"
        >
          <Icon name="bell" variant={unread > 0 ? "bold" : "border"} size={22} />
          {unread > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand" />}
        </Link>
      </div>
    </div>
  );

  return (
    <ExploreView
      cards={cards}
      pressCards={pressCards}
      mapClientId={mapClientId}
      topBar={topBar}
      myGrade={me.grade}
      activePassCount={activePassCount}
      initialMode={sp.mode === "map" ? "map" : "list"}
      initialCategory={sp.cat || "전체"}
      initialSort={(sp.sort as "recommended" | "distance" | "new" | "topSupport" | "closing") || "recommended"}
    />
  );
}
