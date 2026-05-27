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
      <div className="px-5 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[14px] font-semibold text-ink">서울 전역</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
        </div>
        <Link href="/r/notifications" className="w-9 h-9 rounded-full bg-surfaceSoft flex items-center justify-center relative" aria-label="알림">
          <span className="text-[16px]">🔔</span>
          {unread > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand" />}
        </Link>
      </div>

      <div className="mx-5 rounded-lg bg-ink text-white p-5 shadow-card relative overflow-hidden">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[12px] text-white/60 font-medium tracking-wide">내 등급</div>
            <div className="flex items-center gap-2.5 mt-1.5">
              <GradeBadge grade={me.grade} size="lg" inverted />
              <div>
                <div className="text-[22px] font-bold leading-tight tracking-tight">{me.grade}등급</div>
                <div className="text-[12px] text-white/55 mt-0.5">{tierDesc[me.grade]}</div>
              </div>
            </div>
          </div>
          <Link href="/r/grade" className="bg-white/10 text-white text-[12px] font-semibold px-3 py-1.5 rounded-full">
            등급 가이드 →
          </Link>
        </div>
        <div className="mt-4 p-3.5 bg-white/[0.07] rounded-md grid grid-cols-3 gap-2">
          <div>
            <div className="text-[11px] text-white/55">완료 리뷰</div>
            <div className="text-[18px] font-bold mt-0.5">{me.completedReviews}</div>
          </div>
          <div>
            <div className="text-[11px] text-white/55">리뷰 점수</div>
            <div className="text-[18px] font-bold mt-0.5">{me.qualityScore || "-"}</div>
          </div>
          <div>
            <div className="text-[11px] text-white/55">진행 중</div>
            <div className="text-[18px] font-bold mt-0.5">{activeNow}</div>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5">
        <div className="text-[20px] font-bold tracking-tight">안녕하세요, {me.nickname}님</div>
      </div>
    </>
  );

  return <HomeStoreList cards={cards} pressCards={pressCards} mapClientId={mapClientId} header={header} />;
}
