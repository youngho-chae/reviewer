import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDB } from "@/lib/db";
import GradeBadge from "@/components/GradeBadge";
import { gradeMeets } from "@/lib/grade";

export const dynamic = "force-dynamic";

export default async function ReviewerHome() {
  const me = await getCurrentReviewer();
  const db = getDB();
  const now = Date.now();
  const campaigns = db.campaigns
    .filter((c) => c.kind === "visit" && c.endAt > now)
    .map((c) => {
      const store = db.stores.find((s) => s.id === c.storeId)!;
      const totalQ = c.quota.S + c.quota.A + c.quota.B + c.quota.C;
      const usedQ = c.used.S + c.used.A + c.used.B + c.used.C;
      const remain = totalQ - usedQ;
      // 입장 자격 = quota[g] > 0 인 등급 중 "가장 낮은(최대로 열린)" 등급
      const minNeededGrade: "S" | "A" | "B" | "C" =
        c.quota.C > 0 ? "C" : c.quota.B > 0 ? "B" : c.quota.A > 0 ? "A" : "S";
      return { c, store, remain, minNeededGrade };
    });

  return (
    <div>
      <div className="px-5 pt-12 pb-3">
        <div className="text-[12px] text-muted">북촌로3길</div>
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

      <div className="px-5 mt-8 mb-2 flex items-center justify-between">
        <h2 className="text-[18px] font-bold">방문 가능한 매장</h2>
        <span className="text-[12px] text-muted">{campaigns.length}곳</span>
      </div>

      <div className="px-5 space-y-3 pb-24">
        {campaigns.map(({ c, store, remain, minNeededGrade }) => {
          const ok = gradeMeets(me.grade, minNeededGrade as any);
          return (
            <Link
              key={c.id}
              href={ok ? `/r/store/${store.id}?campaign=${c.id}` : "/r/me"}
              className={`block rounded-md border border-hairline overflow-hidden ${ok ? "" : "opacity-50"}`}
            >
              <div className="h-36 bg-surfaceSoft flex items-center justify-center text-[56px]">{store.coverEmoji}</div>
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-[15px]">{store.name}</div>
                  <GradeBadge grade={minNeededGrade as any} size="sm" />
                </div>
                <div className="mt-1 text-[13px] text-muted">{store.area} · {store.category} · ★{store.rating}</div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-[13px] text-ink font-medium">지원금 ₩{c.supportAmount.toLocaleString()}</div>
                  {remain <= 3 ? (
                    <span className="text-[11px] bg-ink text-white px-2 py-0.5 rounded-full">🔥 마감 임박 · {remain}매</span>
                  ) : (
                    <span className="text-[11px] text-muted">잔여 {remain}매</span>
                  )}
                </div>
                {!ok && (
                  <div className="mt-2 text-[12px] text-error">이 매장은 {minNeededGrade}등급부터 이용 가능해요</div>
                )}
              </div>
            </Link>
          );
        })}
        {campaigns.length === 0 && (
          <div className="py-12 text-center text-muted text-[14px]">현재 모집 중인 캠페인이 없어요</div>
        )}
      </div>
    </div>
  );
}
