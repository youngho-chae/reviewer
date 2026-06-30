import { after } from "next/server";
import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync, persistNaverRefresh } from "@/lib/db";
import { gradeMeets, channelOffers, bestEligibleSupport } from "@/lib/grade";
import type { Grade } from "@/lib/types";
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
      const minNeededGrade: "S" | "A" | "B" | "C" =
        c.quota.C > 0 ? "C" : c.quota.B > 0 ? "B" : c.quota.A > 0 ? "A" : "S";
      // 채널별 등급으로 내가 받을 수 있는 가장 큰 혜택 (없으면 기준 지원금=최대치 노출)
      const offers = channelOffers(c.requiredChannels, me.channelGrades, minNeededGrade as Grade, c.supportAmount);
      const myBest = bestEligibleSupport(offers);
      const accessible = myBest > 0;
      return {
        storeId: store.id,
        campaignId: c.id,
        name: store.name,
        area: store.area,
        category: store.category,
        coverEmoji: store.coverEmoji,
        lat: store.lat ?? 37.5665,
        lng: store.lng ?? 126.978,
        supportAmount: accessible ? myBest : c.supportAmount,
        requiredChannels: c.requiredChannels,
        remain,
        totalQuota: totalQ,
        grade: minNeededGrade,
        accessible,
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
      const minNeededGrade: "S" | "A" | "B" | "C" =
        c.quota.C > 0 ? "C" : c.quota.B > 0 ? "B" : c.quota.A > 0 ? "A" : "S";
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
        minGrade: minNeededGrade,
        accessible: gradeMeets(me.grade, minNeededGrade),
        kitPhotos: c.pressMaterials?.length || 8,
        daysLeft: Math.max(0, Math.ceil((c.endAt - now) / 86400000)),
        endAt: c.endAt,
        createdAt: c.createdAt,
      };
    });

  const mapClientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || "xucmechng0";
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
