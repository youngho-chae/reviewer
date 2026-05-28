import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import Icon from "@/components/Icon";
import { PLAN_POLICY } from "@/lib/plan-policy";
import type { Campaign } from "@/lib/types";
import CampaignTabs from "./CampaignTabs";

export const dynamic = "force-dynamic";

export default async function OwnerHome() {
  const me = await getCurrentOwner();
  const db = await getDBAsync();
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

      {/* 신규 리뷰 모니터링 — 운영팀이 검수하며 사장님은 조회만 */}
      <Link href="/o/reviews" className="block mx-5 rounded-md bg-ink text-white p-5">
        <div className="text-[13px] text-white/70">최근 등록된 후기</div>
        <div className="text-[24px] font-bold mt-1">{pendingReviews}건이 운영팀 검수 중</div>
        <div className="text-[13px] text-white/70 mt-1">→ 후기 모니터링</div>
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
      {(() => {
        const allowedGrades = new Set(PLAN_POLICY[me.plan].grades);
        const renderCard = (c: Campaign) => {
          const store = db.stores.find((s) => s.id === c.storeId);
          const totalQuota = c.quota.S + c.quota.A + c.quota.B + c.quota.C;
          const campaignPasses = db.passes.filter((p) => p.campaignId === c.id);
          const pendingCnt = campaignPasses.filter((p) => p.status === "active").length;
          const visitedCnt = campaignPasses.filter((p) =>
            ["used", "review_submitted", "completed"].includes(p.status),
          ).length;
          const isPress = c.kind === "press";
          const pendingLabel = isPress ? "작성 중" : "방문 예정";
          const completedLabel = isPress ? "작성 완료" : "방문 완료";
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
                {(["S","A","B","C"] as const).map((g) => {
                  const locked = !allowedGrades.has(g);
                  return (
                    <div key={g} className={`rounded-sm py-2 ${locked ? "bg-parchment text-muted" : "bg-surfaceSoft"}`}>
                      <div className="text-[11px] text-muted flex items-center justify-center gap-1">
                        {g}
                        {locked && <Icon name="lock" variant="bold" size={10} />}
                      </div>
                      <div className="text-[13px] font-semibold mt-0.5">
                        {locked ? <span className="text-mutedSoft">—</span> : c.used[g]}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-pill bg-parchment border border-hairline text-[12px] text-muted">
                <span>{pendingLabel} <span className="font-semibold text-ink">{pendingCnt}명</span></span>
                <span className="text-mutedSoft">/</span>
                <span>{completedLabel} <span className="font-semibold text-ink">{visitedCnt}명</span></span>
                <span className="text-mutedSoft">/</span>
                <span>총 모집 인원 <span className="font-semibold text-ink">{totalQuota}명</span></span>
              </div>
              {!allowedGrades.has("S") && (
                <div className="mt-2 text-[11px] text-muted">S등급 모집은 Premium 플랜부터 가능합니다.</div>
              )}
            </div>
          );
        };

        const visitCampaigns = myCampaigns.filter((c) => c.kind === "visit");
        const pressCampaigns = myCampaigns.filter((c) => c.kind === "press");

        const visitView = (
          <div className="px-5 space-y-3">
            {visitCampaigns.map(renderCard)}
            {visitCampaigns.length === 0 && (
              <Link href="/o/campaign/new" className="block rounded-md border border-dashed border-hairline p-6 text-center text-muted text-[14px]">
                + 첫 체험단 캠페인 만들기
              </Link>
            )}
          </div>
        );
        const pressView = (
          <div className="px-5 space-y-3">
            {pressCampaigns.map(renderCard)}
            {pressCampaigns.length === 0 && (
              <div className="rounded-md border border-dashed border-hairline p-6 text-center text-muted text-[14px]">
                진행 중인 기자단 캠페인이 없습니다.
              </div>
            )}
          </div>
        );

        return (
          <CampaignTabs
            visitCount={visitCampaigns.length}
            pressCount={pressCampaigns.length}
            visitView={visitView}
            pressView={pressView}
          />
        );
      })()}
    </div>
  );
}
