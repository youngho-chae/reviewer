import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { PLAN_POLICY } from "@/lib/plan-policy";
import type { Campaign } from "@/lib/types";
import CampaignTabs from "./CampaignTabs";
import ShipQueue, { type ShipQueueItem } from "./ShipQueue";
import ReservationQueue, { type ReservationQueueItem } from "./ReservationQueue";
import HomeQueues from "./HomeQueues";
import {
  fmtReservationLabel,
  fmtTime12,
  reservationEpoch,
  reservationHistoryLines,
  ownerProposalUsed,
  reviewerCounterUsed,
  campaignDateOptions,
  campaignTimeSlots,
  scheduleOf,
  inBreakTime,
} from "@/lib/reservation";

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

  // 배송형 발송 대기 큐 (2026-07-12 레뷰 벤치마크) — 수령인 정보는 발송 목적 한정 노출,
  // 등급·실명(계정)은 계속 비노출 (익명 #last4 — 확정 정책 8의 명시적 예외, 데이터정책서 §1.0b)
  const deliveryCampaignIds = new Set(myCampaigns.filter((c) => c.kind === "delivery").map((c) => c.id));
  const shipQueue: ShipQueueItem[] = myPasses
    .filter((p) => p.status === "active" && deliveryCampaignIds.has(p.campaignId) && p.shipping)
    .sort((a, b) => a.issuedAt - b.issuedAt)
    .map((p) => ({
      passId: p.id,
      masked: `#${p.reviewerId.slice(-4)}`,
      campaignTitle: myCampaigns.find((c) => c.id === p.campaignId)?.title ?? "캠페인",
      recipient: p.shipping!.recipient,
      phone: p.shipping!.phone,
      address: p.shipping!.address,
      option: p.shipping!.option,
      issuedAt: p.issuedAt,
    }));

  // 예약 확인 큐 (2026-07-16 리뷰노트 벤치마크) — 예약형 방문 신청 (익명 #last4 · 일시만).
  // [P1] 예약 확인은 일정 조율 — 거절 없음. 방문 임박 순 정렬, 확정 건도 방문 예정으로 함께 표시.
  const reservationQueue: ReservationQueueItem[] = myPasses
    .filter((p) => p.status === "active" && p.reservation)
    .map((p) => {
      const c = myCampaigns.find((x) => x.id === p.campaignId);
      const schedule = c ? scheduleOf(c) : undefined;
      return {
        passId: p.id,
        campaignId: p.campaignId,
        masked: `#${p.reviewerId.slice(-4)}`,
        campaignTitle: c?.title ?? "캠페인",
        label: fmtReservationLabel(p.reservation!.date, p.reservation!.time),
        status: p.reservation!.status,
        epoch: reservationEpoch(p.reservation!.date, p.reservation!.time),
        endAt: c?.endAt ?? p.expiresAt,
        partySize: p.reservation!.partySize, // 방문 인원수 (2026-07-17)
        // 제안 폼 선택지 — 캠페인 예약 스케줄(요일·운영시간·브레이크) 기준 (§2-2, 12시간제 §7-2)
        dateOptions: c
          ? campaignDateOptions(c).map((d) => ({ date: d.date, label: d.label, disabled: d.disabled }))
          : [],
        timeOptions: schedule
          ? campaignTimeSlots(schedule)
              .filter((t) => !inBreakTime(schedule, t))
              .map((t) => ({ time: t, label: fmtTime12(t) }))
          : [],
        // 협상 히스토리 (v3) — 누가 언제 어떤 시간을 제안했는지 + 각 1회 제안 소진 여부
        history: reservationHistoryLines(p.reservation!).map((h) => ({
          prefix: h.prefix,
          timeLabel: h.timeLabel,
          ...(h.note ? { note: h.note } : {}),
        })),
        proposalUsed: ownerProposalUsed(p.reservation!),
        counterUsed: reviewerCounterUsed(p.reservation!),
      };
    })
    .sort((a, b) => a.epoch - b.epoch);

  return (
    <div className="pb-24 bg-canvas">
      <div className="px-5 pt-12 pb-3">
        <div className="text-[12px] text-muted">{me.storeName}</div>
        <h1 className="text-[20px] font-bold text-ink tracking-title mt-1">안녕하세요, 사장님</h1>
      </div>

      {/* 이번 달 모집 현황 — 홈 최상단 (2026-07-16 회의). 플랜·관리 기능을 하단에 간소화 통합.
          '최근 등록된 후기' 카드는 메인 [후기] 탭과 역할이 겹쳐 제거. */}
      <div className="mx-5 rounded-lg border border-hairline bg-canvas p-4">
        <div className="text-[14px] font-bold text-ink">이번 달 모집 현황</div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-[12px] text-muted">누적 모집</div>
            <div className="text-[20px] font-bold text-ink tabular-nums mt-1">{thisMonth.length}</div>
          </div>
          <div className="border-l border-r border-hairlineSoft">
            <div className="text-[12px] text-muted">사용 진행</div>
            <div className="text-[20px] font-bold text-ink tabular-nums mt-1">{activeNow}</div>
          </div>
          <div>
            <div className="text-[12px] text-muted">검수 대기</div>
            <div className="text-[20px] font-bold text-ink tabular-nums mt-1">{pendingReviews}</div>
          </div>
        </div>
        <div className="mt-3.5 pt-3 border-t border-hairlineSoft flex items-center justify-between">
          <span className="text-[13px] text-muted">
            현재 플랜 <span className="font-semibold text-ink">{me.plan}</span> ·{" "}
            {PLAN_POLICY[me.plan].monthlyTeamLimit === null ? "무제한 모집" : `월 ${PLAN_POLICY[me.plan].monthlyTeamLimit}팀 모집`}
          </span>
          <Link href="/o/me" className="cp-action text-[13px] font-semibold text-brand">관리 →</Link>
        </div>
      </div>

      {/* 홈 내부 큐 탭 — [방문 예약 | 발송 대기] (2026-07-16 회의) */}
      <HomeQueues
        reservationCount={reservationQueue.length}
        shipCount={shipQueue.length}
        reservationView={<ReservationQueue items={reservationQueue} />}
        shipView={<ShipQueue items={shipQueue} />}
      />

      {/* 진행 중 캠페인 */}
      <div className="px-5 mt-8 flex items-end justify-between">
        <h2 className="text-[18px] font-bold text-ink tracking-title">진행 중 캠페인</h2>
        <Link href="/o/campaign/new" className="cp-action text-[13px] text-brand font-semibold">+ 새 캠페인</Link>
      </div>
      {(() => {
        // 모든 플랜이 S~C 모집 가능. 자물쇠 없음.
        const renderCard = (c: Campaign) => {
          const store = db.stores.find((s) => s.id === c.storeId);
          const totalQuota = c.quota.S + c.quota.A + c.quota.B + c.quota.C;
          const campaignPasses = db.passes.filter((p) => p.campaignId === c.id);
          const pendingCnt = campaignPasses.filter((p) => p.status === "active").length;
          const visitedCnt = campaignPasses.filter((p) =>
            ["used", "review_submitted", "completed"].includes(p.status),
          ).length;
          const isPress = c.kind === "press";
          const isDelivery = c.kind === "delivery";
          const pendingLabel = isPress ? "작성 중" : isDelivery ? "발송 대기" : "방문 예정";
          const completedLabel = isPress ? "작성 완료" : isDelivery ? "발송 완료" : "방문 완료";
          return (
            // 카드 전체가 캠페인 상세 관리로 진입 (§12-1) — 모집 현황·예약 관리·일정 차단·후기
            <Link href={`/o/campaign/${c.id}`} key={c.id} className="cp-action block rounded-lg border border-hairline bg-canvas p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[15px] font-semibold text-ink flex items-center gap-1.5">
                    {isDelivery && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-xs bg-brandSoft text-brand text-[11px] font-semibold shrink-0">
                        📦 배송
                      </span>
                    )}
                    {!isDelivery && !isPress && c.reservationRequired && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-xs bg-brandSoft text-brand text-[11px] font-semibold shrink-0">
                        📅 예약형
                      </span>
                    )}
                    <span className="truncate">{c.title}</span>
                  </div>
                  <div className="text-[12px] text-muted mt-0.5">{store?.name}</div>
                </div>
                <div className="text-[12px] text-muted tabular-nums">
                  D-{Math.max(0, Math.floor((c.endAt - Date.now()) / 86400000))} <span className="text-brand font-semibold">관리 →</span>
                </div>
              </div>
              {/* [확정 정책 8] 캠페인 진행 현황은 방문 예정/방문 완료/총 모집 3종만 —
                  체험자 등급(등급별 버킷)은 사장님에게 노출하지 않는다 (응대 차별 방지, 내부 데이터는 어드민 전용) */}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-sm py-2.5 bg-sunken">
                  <div className="text-[11px] text-muted">{pendingLabel}</div>
                  <div className="text-[15px] font-semibold text-ink tabular-nums mt-0.5">{pendingCnt}명</div>
                </div>
                <div className="rounded-sm py-2.5 bg-sunken">
                  <div className="text-[11px] text-muted">{completedLabel}</div>
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

        // 배송형은 방문형 탭에 함께 노출 (카드 라벨만 발송 대기/완료로 분기 — 별도 탭 없이 관리)
        const visitCampaigns = myCampaigns.filter((c) => c.kind !== "press");
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
