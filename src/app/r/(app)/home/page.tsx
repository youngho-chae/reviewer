import { after } from "next/server";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync, persistNaverRefresh } from "@/lib/db";
import GradeBadge from "@/components/GradeBadge";
import { gradeMeets } from "@/lib/grade";
import HomeStoreList, { StoreCardData } from "./HomeStoreList";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ReviewerHome() {
  const me = await getCurrentReviewer();
  const db = await getDBAsync();
  // 응답 후 백그라운드로 Naver 실데이터 fetch (한 번만)
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

  // Client ID는 공개 식별자 (브라우저 URL에 그대로 노출됨) — 코드 임베드 OK
  // env var는 사용자 본인 키로 override 하고 싶을 때만 사용
  const mapClientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || "xucmechng0";

  const header = (
    <>
      <div className="px-5 pt-12 pb-3">
        <div className="text-[12px] text-muted">서울 전역</div>
        <div className="mt-1 text-[20px] font-bold">안녕하세요, {me.nickname}님</div>
      </div>

      {/* 등급 히어로 카드 */}
      <div className="mx-5 rounded-md bg-ink text-white p-5 shadow-card">
        <div className="flex items-center gap-3">
          <GradeBadge grade={me.grade} size="lg" />
          <div>
            <div className="text-[14px] text-white/70">현재 등급</div>
            <div className="text-[22px] font-bold leading-none mt-1">{me.grade}등급</div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-center">
          <div>
            <div className="text-[11px] text-white/60">이번달 완료 리뷰</div>
            <div className="text-[22px] font-bold mt-1">{me.completedReviews}</div>
          </div>
          <div>
            <div className="text-[11px] text-white/60">리뷰 점수</div>
            <div className="text-[22px] font-bold mt-1">{me.qualityScore || "-"}</div>
          </div>
        </div>
      </div>
    </>
  );

  return <HomeStoreList cards={cards} mapClientId={mapClientId} header={header} />;
}
