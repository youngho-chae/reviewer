import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { DELIVERY_ENABLED } from "@/lib/flags";
import type { Campaign } from "@/lib/types";
import CampaignFilter from "../home/CampaignFilter";
import ManageTabs from "./ManageTabs";
import CampaignSegments from "./CampaignSegments";
import ReservationManager from "./ReservationManager";
import { buildManagedReservations } from "./reservation-items";

export const dynamic = "force-dynamic";

// [관리] 탭 (2026-07-28 사장님 화면 개편 1단계) — 홈의 무한 스크롤 부담을 분산:
// 캠페인 관리와 예약관리를 이 페이지로 모은다. 홈 개편은 별도 단계(추후 지시).
//  - [캠페인]: 유형 세그먼트(방문형·배송은 플래그 — 기자단은 이 브랜치에서 코드째 제거라 미노출)
//    + [전체|진행중|종료] 칩 + 캠페인 카드(관리 진입)
//  - [예약관리]: 매장 셀렉터 + [전체|요청|조율|확정|취소] 칩 + 상태별 예약 카드
export default async function OwnerManage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const me = await getCurrentOwner();
  const db = await getDBAsync();
  const myStores = db.stores.filter((s) => s.ownerId === me.id);
  const storeIds = myStores.map((s) => s.id);
  const myCampaigns = db.campaigns.filter((c) => storeIds.includes(c.storeId));
  const myPasses = db.passes.filter((p) => p.ownerId === me.id);

  // ── 캠페인 카드 (홈 '내 캠페인'과 동일 구성 — 홈 개편 시 이 페이지로 이관 예정) ──
  const renderCard = (c: Campaign) => {
    const store = db.stores.find((s) => s.id === c.storeId);
    const totalQuota = c.quota.S + c.quota.A + c.quota.B + c.quota.C;
    const campaignPasses = db.passes.filter((p) => p.campaignId === c.id);
    const pendingCnt = campaignPasses.filter((p) => p.status === "active").length;
    const visitedCnt = campaignPasses.filter((p) => ["used", "review_submitted", "completed"].includes(p.status)).length;
    const isDelivery = c.kind === "delivery";
    const ended = c.endAt <= Date.now();
    return (
      <Link href={`/o/campaign/${c.id}`} key={c.id} className="cp-action block rounded-lg border border-hairline bg-canvas p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[15px] font-semibold text-ink flex items-center gap-1.5">
              {isDelivery && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-xs bg-brandSoft text-brand text-[11px] font-semibold shrink-0">📦 배송</span>
              )}
              {!isDelivery && c.reservationRequired && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-xs bg-brandSoft text-brand text-[11px] font-semibold shrink-0">📅 예약형</span>
              )}
              <span className="truncate">{c.title}</span>
            </div>
            <div className="text-[12px] text-muted mt-0.5">{store?.name}</div>
          </div>
          <div className="text-[12px] text-muted tabular-nums">
            {ended ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-pill bg-sunken text-muted font-semibold">종료</span>
            ) : (
              <>D-{Math.max(0, Math.floor((c.endAt - Date.now()) / 86400000))}</>
            )}{" "}
            <span className="text-brand font-semibold">관리 →</span>
          </div>
        </div>
        {/* [확정 정책 8] 진행 현황 3종만 — 등급별 버킷 비노출 */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-sm py-2.5 bg-sunken">
            <div className="text-[11px] text-muted">{isDelivery ? "발송 대기" : "방문 예정"}</div>
            <div className="text-[15px] font-semibold text-ink tabular-nums mt-0.5">{pendingCnt}명</div>
          </div>
          <div className="rounded-sm py-2.5 bg-sunken">
            <div className="text-[11px] text-muted">{isDelivery ? "발송 완료" : "방문 완료"}</div>
            <div className="text-[15px] font-semibold text-ink tabular-nums mt-0.5">{visitedCnt}명</div>
          </div>
          <div className="rounded-sm py-2.5 bg-sunken">
            <div className="text-[11px] text-muted">🎫 총 모집</div>
            <div className="text-[15px] font-semibold text-ink tabular-nums mt-0.5">{totalQuota}명</div>
          </div>
        </div>
      </Link>
    );
  };

  const filteredView = (list: Campaign[]) => {
    const open = list.filter((c) => c.endAt > Date.now());
    const closed = list.filter((c) => c.endAt <= Date.now());
    // 캠페인 생성은 홈 전용 (2026-07-28 지시) — 빈 상태도 안내 텍스트만
    const listOf = (arr: Campaign[], empty: string) => (
      <div className="px-5 space-y-3 pb-6">
        {arr.map(renderCard)}
        {arr.length === 0 && (
          <div className="rounded-md border border-dashed border-hairline p-6 text-center text-muted text-[14px]">
            {list.length === 0 ? "아직 캠페인이 없어요 — 홈에서 만들 수 있어요." : empty}
          </div>
        )}
      </div>
    );
    return (
      <CampaignFilter
        defaultFilter="all"
        allCount={list.length}
        openCount={open.length}
        closedCount={closed.length}
        allView={listOf(list, "캠페인이 없어요.")}
        openView={listOf(open, "진행 중인 캠페인이 없어요.")}
        closedView={listOf(closed, "종료된 캠페인이 없어요.")}
      />
    );
  };

  // 유형 세그먼트 — 방문형(예약형 포함) + 배송(플래그). 기자단은 이 브랜치 미제공.
  const visitCampaigns = myCampaigns.filter((c) => c.kind !== "delivery");
  const segments = [
    { key: "visit", label: "방문형", view: filteredView(visitCampaigns) },
    ...(DELIVERY_ENABLED
      ? [{ key: "delivery", label: "배송", view: filteredView(myCampaigns.filter((c) => c.kind === "delivery")) }]
      : []),
  ];

  // [+ 새 캠페인]은 홈 전용 — 관리 탭에서는 미제공 (2026-07-28 지시)
  const campaignsView = (
    <div className="pt-1">
      <CampaignSegments segments={segments} />
    </div>
  );

  // ── 예약관리 — 예약 정보가 있는 패스 전체 (빌더 공유: 캠페인 관리 [예약관리] 탭과 동일) ──
  const reservations = buildManagedReservations(myPasses, myCampaigns, myStores);

  const reservationsView = (
    <ReservationManager items={reservations} stores={myStores.map((s) => ({ id: s.id, name: s.name }))} />
  );

  return (
    <div className="pb-24 bg-canvas">
      <ManageTabs
        campaignsView={campaignsView}
        reservationsView={reservationsView}
        initialTab={tab === "reservations" ? "reservations" : "campaigns"}
      />
    </div>
  );
}
