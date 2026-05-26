import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDB } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function OwnerHome() {
  const me = await getCurrentOwner();
  const db = getDB();
  const myStores = db.stores.filter((s) => s.ownerId === me.id);
  const storeIds = myStores.map((s) => s.id);
  const myCampaigns = db.campaigns.filter((c) => storeIds.includes(c.storeId));
  const myPasses = db.passes.filter((p) => p.ownerId === me.id);
  const monthAgo = Date.now() - 1000 * 60 * 60 * 24 * 30;
  const thisMonth = myPasses.filter((p) => p.issuedAt >= monthAgo);
  const pendingReviews = myPasses.filter((p) => p.status === "review_submitted").length;
  const activeNow = myPasses.filter((p) => p.status === "active").length;

  return (
    <div className="pb-24">
      <div className="px-5 pt-12 pb-3">
        <div className="text-[12px] text-muted">{me.storeName}</div>
        <div className="text-[20px] font-bold mt-1">안녕하세요, 사장님</div>
      </div>

      {/* 오늘 할 일 */}
      <Link href="/o/reviews" className="block mx-5 rounded-md bg-ink text-white p-5">
        <div className="text-[13px] text-white/70">오늘 할 일</div>
        <div className="text-[24px] font-bold mt-1">{pendingReviews}건의 리뷰가 검수 대기 중</div>
        <div className="text-[13px] text-white/70 mt-1">→ 리뷰 검수하기</div>
      </Link>

      {/* 멤버십 스트립 */}
      <div className="mx-5 mt-4 rounded-md border border-hairline p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] text-muted">현재 플랜</div>
            <div className="text-[16px] font-semibold mt-0.5">{me.plan} · 무제한 모집</div>
          </div>
          <Link href="/o/me" className="text-[13px] text-muted">관리 →</Link>
        </div>
      </div>

      {/* 이번 달 모집 현황 */}
      <div className="mx-5 mt-4 rounded-md border border-hairline p-4">
        <div className="text-[13px] font-semibold">이번 달 모집 현황</div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-[11px] text-muted">누적 모집</div>
            <div className="text-[20px] font-bold">{thisMonth.length}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted">사용 진행</div>
            <div className="text-[20px] font-bold">{activeNow}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted">검수 대기</div>
            <div className="text-[20px] font-bold">{pendingReviews}</div>
          </div>
        </div>
      </div>

      {/* 진행 중 캠페인 */}
      <div className="px-5 mt-8 flex items-center justify-between">
        <h2 className="text-[18px] font-bold">진행 중 캠페인</h2>
        <Link href="/o/campaign/new" className="text-[13px] text-brand font-medium">+ 새 캠페인</Link>
      </div>
      <div className="px-5 mt-3 space-y-3">
        {myCampaigns.map((c) => {
          const store = db.stores.find((s) => s.id === c.storeId);
          const totalQ = c.quota.S + c.quota.A + c.quota.B + c.quota.C;
          const usedQ = c.used.S + c.used.A + c.used.B + c.used.C;
          return (
            <div key={c.id} className="rounded-md border border-hairline p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[15px] font-semibold">{c.title}</div>
                  <div className="text-[12px] text-muted mt-0.5">{store?.name}</div>
                </div>
                <div className="text-[12px] text-muted">D-{Math.max(0, Math.floor((c.endAt - Date.now()) / 86400000))}</div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                {(["S","A","B","C"] as const).map((g) => (
                  <div key={g} className="rounded-sm bg-surfaceSoft py-2">
                    <div className="text-[11px] text-muted">{g}</div>
                    <div className="text-[13px] font-semibold">{c.used[g]}/{c.quota[g]}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[12px] text-muted">총 {usedQ}/{totalQ}</div>
            </div>
          );
        })}
        {myCampaigns.length === 0 && (
          <Link href="/o/campaign/new" className="block rounded-md border border-dashed border-hairline p-6 text-center text-muted text-[14px]">
            + 첫 캠페인 만들기
          </Link>
        )}
      </div>
    </div>
  );
}
