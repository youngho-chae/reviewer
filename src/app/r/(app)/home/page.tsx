import { after } from "next/server";
import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync, persistNaverRefresh } from "@/lib/db";
import GradeBadge from "@/components/GradeBadge";
import { gradeMeets } from "@/lib/grade";
import HomeStoreList, { StoreCardData, PressCardData } from "./HomeStoreList";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const tierDesc: Record<string, string> = {
  S: "상위 5% 리뷰어",
  A: "검증된 리뷰어",
  B: "일반 리뷰어",
  C: "성장 단계",
  N: "검증 전",
};

export default async function ReviewerHome() {
  const me = await getCurrentReviewer();
  const db = await getDBAsync();
  if (!db.naverDataFetched) {
    after(async () => {
      await persistNaverRefresh();
    });
  }
  const now = Date.now();

  const cards: StoreCardData[] = db.campaigns
    .filter((c) => c.kind === "visit" && c.endAt > now)
    .map((c) => {
      const store = db.stores.find((s) => s.id === c.storeId)!;
      const totalQ = c.quota.S + c.quota.A + c.quota.B + c.quota.C;
      const usedQ = c.used.S + c.used.A + c.used.B + c.used.C;
      const remain = totalQ - usedQ;
      const minNeededGrade: "S" | "A" | "B" | "C" =
        c.quota.C > 0 ? "C" : c.quota.B > 0 ? "B" : c.quota.A > 0 ? "A" : "S";
      return {
        storeId: store.id,
        campaignId: c.id,
        name: store.name,
        area: store.area,
        category: store.category,
        coverEmoji: store.coverEmoji,
        lat: store.lat ?? 37.5665,
        lng: store.lng ?? 126.978,
        supportAmount: c.supportAmount,
        remain,
        grade: minNeededGrade,
        accessible: gradeMeets(me.grade, minNeededGrade),
        rating: store.rating,
        reviewCount: store.reviewCount,
      };
    });

  const pressCards: PressCardData[] = db.campaigns
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
      };
    });

  const mapClientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || "xucmechng0";

  const activeNow = db.passes.filter((p) => p.reviewerId === me.id && (p.status === "active" || p.status === "used")).length;
  const unread = db.notifications.filter((n) => n.role === "reviewer" && n.userId === me.id && !n.read).length;

  const header = (
    <>
      {/* Frosted parchment sub-nav (Apple sub-nav-frosted token) */}
      <div className="sticky top-0 z-30 frosted-parchment border-b border-hairlineSoft">
        <div className="h-13 px-5 flex items-center justify-between">
          <div className="text-[21px] font-semibold text-ink tracking-[-0.011em]">CATCHPASS</div>
          <Link
            href="/r/notifications"
            className="cp-action relative w-9 h-9 rounded-full flex items-center justify-center"
            aria-label="알림"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.5" strokeLinecap="round">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
            {unread > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand" />
            )}
          </Link>
        </div>
      </div>

      {/* Parchment hero tile — grade story (Apple product-tile-parchment) */}
      <section className="bg-parchment px-6 pt-14 pb-10 text-center">
        <div className="text-[12px] tracking-[0.18em] text-muted uppercase mb-3">내 등급</div>
        <div className="flex justify-center mb-4">
          <GradeBadge grade={me.grade} size="xl" />
        </div>
        <h1 className="font-display text-[40px] leading-[1.07] text-ink">
          {me.grade}등급
        </h1>
        <p className="mt-2 text-[19px] text-ink2 leading-[1.4]">{tierDesc[me.grade]}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/r/grade"
            className="cp-action inline-flex items-center h-11 px-5 rounded-pill bg-brand text-white text-[17px]"
          >
            등급 자세히 보기
          </Link>
        </div>

        {/* Stats row */}
        <div className="mt-10 max-w-[360px] mx-auto grid grid-cols-3 gap-2 text-left">
          <div className="text-center">
            <div className="text-[28px] font-semibold text-ink tracking-[-0.022em] leading-none">{me.completedReviews}</div>
            <div className="text-[12px] text-muted mt-1.5">완료 리뷰</div>
          </div>
          <div className="text-center border-l border-r border-hairline">
            <div className="text-[28px] font-semibold text-ink tracking-[-0.022em] leading-none">{me.qualityScore || "—"}</div>
            <div className="text-[12px] text-muted mt-1.5">리뷰 점수</div>
          </div>
          <div className="text-center">
            <div className="text-[28px] font-semibold text-ink tracking-[-0.022em] leading-none">{activeNow}</div>
            <div className="text-[12px] text-muted mt-1.5">진행 중</div>
          </div>
        </div>
      </section>

      <div className="px-6 pt-10 pb-1">
        <h2 className="font-display text-[28px] leading-[1.14] text-ink">안녕하세요, {me.nickname}님.</h2>
      </div>
    </>
  );

  return <HomeStoreList cards={cards} pressCards={pressCards} mapClientId={mapClientId} header={header} />;
}
