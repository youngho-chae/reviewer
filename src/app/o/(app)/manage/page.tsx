import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { DELIVERY_ENABLED } from "@/lib/flags";
import type { Campaign } from "@/lib/types";
import { fmtReservationLabel, reservationEpoch, reservationHistoryLines, reviewerCounterUsed } from "@/lib/reservation";
import CampaignFilter from "../home/CampaignFilter";
import ManageTabs from "./ManageTabs";
import CampaignSegments from "./CampaignSegments";
import ReservationManager, { type ManagedReservation } from "./ReservationManager";

export const dynamic = "force-dynamic";

// [관리] 탭 (2026-07-28 사장님 화면 개편 1단계) — 홈의 무한 스크롤 부담을 분산:
// 캠페인 관리와 예약관리를 이 페이지로 모은다. 홈 개편은 별도 단계(추후 지시).
//  - [캠페인]: 유형 세그먼트(방문형·배송은 플래그 — 기자단은 이 브랜치에서 코드째 제거라 미노출)
//    + [전체|진행중|종료] 칩 + 캠페인 카드(관리 진입)
//  - [예약관리]: 매장 셀렉터 + [전체|요청|조율|확정|취소] 칩 + 상태별 예약 카드
export default async function OwnerManage() {
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
    const listOf = (arr: Campaign[], empty: string) => (
      <div className="px-5 space-y-3 pb-6">
        {arr.map(renderCard)}
        {arr.length === 0 &&
          (list.length === 0 ? (
            <Link href="/o/campaign/new" className="block rounded-md border border-dashed border-hairline p-6 text-center text-muted text-[14px]">
              + 첫 체험단 캠페인 만들기
            </Link>
          ) : (
            <div className="rounded-md border border-dashed border-hairline p-6 text-center text-muted text-[14px]">{empty}</div>
          ))}
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

  const campaignsView = (
    <div>
      <div className="px-5 pb-3 flex justify-end">
        <Link href="/o/campaign/new" className="cp-action text-[13px] text-brand font-semibold">+ 새 캠페인</Link>
      </div>
      <CampaignSegments segments={segments} />
    </div>
  );

  // ── 예약관리 — 예약 정보가 있는 패스 전체 (active + 취소) ─────────────────────
  const reservations: ManagedReservation[] = myPasses
    .filter((p) => p.reservation && (p.status === "active" || p.status === "cancelled"))
    .map((p) => {
      const r = p.reservation!;
      const c = myCampaigns.find((x) => x.id === p.campaignId);
      const store = myStores.find((s) => s.id === c?.storeId);
      // 원 요청 일시 (재제안 카드의 흐림 표기용) — 히스토리 첫 줄 = 최초 신청
      const firstLine = reservationHistoryLines(r)[0];
      const state: ManagedReservation["state"] =
        p.status === "cancelled"
          ? "cancelled"
          : r.status === "confirmed"
            ? "confirmed"
            : r.status === "proposed"
              ? "proposed"
              : reviewerCounterUsed(r)
                ? "counter"
                : "requested";
      return {
        passId: p.id,
        storeId: store?.id ?? "",
        storeName: store?.name ?? "매장",
        campaignTitle: c?.title ?? "캠페인",
        masked: `#${p.reviewerId.slice(-4)}`,
        label: fmtReservationLabel(r.date, r.time),
        ...(r.partySize ? { partySize: r.partySize } : {}),
        state,
        // 재제안 카드 — 원래 요청 일시를 흐리게 병기
        ...(state === "counter" && firstLine?.timeLabel ? { originalLabel: firstLine.timeLabel } : {}),
        epoch: reservationEpoch(r.date, r.time),
      };
    })
    .sort((a, b) => {
      const pr = { requested: 0, counter: 0, proposed: 1, confirmed: 2, cancelled: 3 } as const;
      return pr[a.state] - pr[b.state] || a.epoch - b.epoch;
    });

  const reservationsView = (
    <ReservationManager items={reservations} stores={myStores.map((s) => ({ id: s.id, name: s.name }))} />
  );

  return (
    <div className="pb-24 bg-canvas">
      <ManageTabs campaignsView={campaignsView} reservationsView={reservationsView} />
    </div>
  );
}
