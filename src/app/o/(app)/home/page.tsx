import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { PLAN_POLICY } from "@/lib/plan-policy";
import { refillBonus, refillGrantFor, ownedRefills, REFILL_PRICE } from "@/lib/limit-refill";
import { billingCycle, cycleLabel } from "@/lib/billing-cycle";
import RefillFlow from "@/components/RefillFlow";
import { DELIVERY_ENABLED } from "@/lib/flags";
import Icon from "@/components/Icon";
import HomeCampaigns, { type HomeCampaignItem } from "./HomeCampaigns";

export const dynamic = "force-dynamic";

// 사장님 홈 (2026-07-28 개편 2단계 — 시안) — 로고 → 모집 현황(결제 주기 기간 표기)
// (방문 예정·사용 완료·검수 중인 리뷰 + 모집 한도 프로그레스·플랜) → [새 캠페인 등록 |
// 예약 관리] → 진행 중인 캠페인(유형 칩 + 신형 카드, 전체보기 = [관리] 탭).
// 구 홈의 [방문 예약|발송 대기] 큐는 제거 — 예약 처리(확정·제안·거절·확정 취소)는
// [관리]-[예약관리]·예약 정보 상세로 이관 (2026-07-28).
// 매장별 드롭다운 필터(StoreSwitcher·?store=)는 2026-08-04 제거 — 홈은 항상 전 매장 기준.
export default async function OwnerHome() {
  const me = await getCurrentOwner();
  const db = await getDBAsync();
  const myStores = db.stores.filter((s) => s.ownerId === me.id);
  const myCampaigns = db.campaigns.filter((c) => myStores.some((s) => s.id === c.storeId));
  const campaignIds = new Set(myCampaigns.map((c) => c.id));
  const myPasses = db.passes.filter((p) => p.ownerId === me.id && campaignIds.has(p.campaignId));

  // ── 이번 달 모집 현황 — 최근 30일 발급 기준 (기존 홈과 동일 창) ──
  const monthAgo = Date.now() - 1000 * 60 * 60 * 24 * 30;
  const thisMonth = myPasses.filter((p) => p.issuedAt >= monthAgo);
  const pendingVisit = thisMonth.filter((p) => p.status === "active").length;
  const usedDone = thisMonth.filter((p) => ["used", "review_submitted", "completed"].includes(p.status)).length;
  const reviewWait = myPasses.filter((p) => p.status === "review_submitted").length;

  // 모집 한도 프로그레스 — **결제 주기** 내 오픈한 캠페인의 총 모집 인원 vs 플랜 한도
  // (2026-08-03 확정: 유료 = 결제 시점~재결제 전, Free = 가입일 anniversary — 캠페인 생성 API와
  //  동일 기준, 매장 필터와 무관하게 사장님 전체. 캘린더 월("이번 달") 기산 폐기)
  const cycle = billingCycle(me);
  const ownerStoreIds = new Set(myStores.map((s) => s.id));
  const monthUsed = db.campaigns
    .filter((c) => ownerStoreIds.has(c.storeId) && c.createdAt >= cycle.start)
    .reduce((sum, c) => sum + c.quota.S + c.quota.A + c.quota.B + c.quota.C, 0);
  // 모집 한도 리필권(2026-07-31 BM 보완) — 홈 게이지는 **기본 플랜 한도 기준**으로 표기하고
  // 리필 누적 수량은 노출하지 않는다(누적 지출 부담 인지 방지). 대신 사용량에서 리필분을
  // 차감해 게이지가 다시 차오르게 한다: 표시 사용량 = max(0, 사용 − 리필).
  const refill = refillBonus(db, me);
  const monthLimit = PLAN_POLICY[me.plan].monthlyTeamLimit;
  const shownUsed = Math.min(monthLimit, Math.max(0, monthUsed - refill));
  const ownedCoupons = ownedRefills(db, me.id).length; // 보유(미사용) 리필권 — [리필하기] 분기

  // 잔여 카운팅 표기 (2026-08-03 시안) — 게이지와 동일하게 "n 남음 / 한도"로 감소.
  // 단계 색: 잔여 50% 초과 = 퍼플(기본, 시안 블루는 v2 규칙으로 치환) / 11~50% = 노랑 /
  // 1~10% = 빨강(숫자도 빨강) / 0 = 소진 상태(errorSoft 배경 + 안내 + 플랜 업셀 CTA)
  const shownRemain = monthLimit - shownUsed;
  const remainPct = Math.max(0, Math.round((shownRemain / Math.max(monthLimit, 1)) * 100));
  const depleted = shownRemain <= 0;
  const barTone = remainPct > 50 ? "bg-brand" : remainPct > 10 ? "bg-warning" : "bg-error";
  const remainTone = remainPct > 10 ? "text-ink" : "text-error";

  // ── 진행 중인 캠페인 카드 ──
  const now = Date.now();
  const items: HomeCampaignItem[] = myCampaigns
    .filter((c) => c.endAt > now)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((c) => {
      const store = myStores.find((s) => s.id === c.storeId);
      const passes = db.passes.filter((p) => p.campaignId === c.id);
      const isDelivery = c.kind === "delivery";
      const reserveRequired = !isDelivery && !!c.reservationRequired;
      const active = passes.filter((p) => p.status === "active");
      // 예약형은 응답이 필요한 건(미확정 예약)을 앞세운다 — 시안 "예약 확인 필요"
      const pendingCount = reserveRequired
        ? active.filter((p) => p.reservation && p.reservation.status !== "confirmed").length
        : active.length;
      return {
        id: c.id,
        kind: isDelivery ? ("delivery" as const) : ("visit" as const),
        reserveRequired,
        title: c.title,
        storeName: store?.name ?? "",
        daysLeft: Math.max(0, Math.ceil((c.endAt - now) / 86400000)),
        pendingLabel: isDelivery ? "발송 대기" : reserveRequired ? "예약 확인 필요" : "방문 예정",
        pendingCount,
        usedCount: passes.filter((p) => ["used", "review_submitted", "completed"].includes(p.status)).length,
        totalQuota: c.quota.S + c.quota.A + c.quota.B + c.quota.C,
      };
    });

  return (
    <div className="pb-24 bg-canvas">
      {/* 로고 (매장별 드롭다운 필터는 2026-08-04 제거) */}
      <div className="px-5 pt-12 pb-4 flex items-center">
        <span className="text-[15px] font-bold text-brand tracking-title">CATCHPASS</span>
      </div>

      {/* 모집 현황 — 파스텔 카드 + 모집 한도 프로그레스 (시안).
          타이틀은 "모집 현황" + 우측 결제 주기 기간 (2026-08-03 — "이번 달" 표기는 주기와 어긋나 폐기) */}
      <div className="mx-5 rounded-lg bg-brandSoft p-4">
        <div className="flex items-center justify-between">
          <div className="text-[14px] font-bold text-ink">모집 현황</div>
          <span className="text-[11px] text-muted tabular-nums">{cycleLabel(cycle)}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 text-center">
          <div>
            <div className="text-[20px] font-bold text-ink tabular-nums">{pendingVisit}</div>
            <div className="mt-0.5 text-[12px] text-muted">방문 예정</div>
          </div>
          <div className="border-l border-r border-hairlineSoft">
            <div className="text-[20px] font-bold text-ink tabular-nums">{usedDone}</div>
            <div className="mt-0.5 text-[12px] text-muted">사용 완료</div>
          </div>
          <div>
            {/* 검수 중인 리뷰 = 체험자가 제출해 운영팀 검수를 기다리는 건만 (§4-2 — 작성 대기 제외) */}
            <div className="text-[20px] font-bold text-ink tabular-nums">{reviewWait}</div>
            <div className="mt-0.5 text-[12px] text-muted">검수 중인 리뷰</div>
          </div>
        </div>
        {/* 소진 시(잔여 0) 하단 영역은 errorSoft로 카드 가장자리까지 확장 (2026-08-03 시안) */}
        <div className={`mt-4 pt-3 border-t border-hairlineSoft ${depleted ? "-mx-4 -mb-4 px-4 pb-4 rounded-b-lg bg-errorSoft" : ""}`}>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[13px] text-ink tabular-nums">
              모집 한도
              <span className={`font-bold ${remainTone}`}>{shownRemain} 남음</span>
              <span className="-ml-0.5 font-semibold">/ {monthLimit}</span>
              {/* [리필하기] (2026-07-31 2차 보완) — 보유 쿠폰 없으면 구매, 있으면 사용 플로우 */}
              <RefillFlow
                plan={me.plan}
                grant={refillGrantFor(me.plan)}
                price={REFILL_PRICE}
                owned={ownedCoupons}
                trigger="리필하기"
                className="cp-action h-6 px-2 rounded-pill bg-brand text-white text-[11px] font-bold"
              />
            </span>
            <Link href="/o/membership" className="cp-action text-[13px] font-semibold text-ink">
              {me.plan} <span className="text-muted">›</span>
            </Link>
          </div>
          {/* 잔여 게이지 (2026-07-28) — 100%에서 시작해 사용할수록 줄어든다 (전 플랜 유한 한도).
              리필 구매 시 표시 사용량이 차감되어 게이지가 다시 차오른다 (누적 한도 비노출) */}
          <div className="mt-2 h-2 rounded-pill bg-canvas overflow-hidden">
            <div className={`h-full rounded-pill ${barTone}`} style={{ width: `${remainPct}%` }} />
          </div>
          {depleted && (
            <>
              <p className="mt-3 text-[12px] font-medium text-error leading-[1.5]">
                ⚠️ 이번 주기 모집 한도를 모두 사용했어요. 새 캠페인을 만들려면 한도를 늘려주세요.
              </p>
              {/* 업셀 CTA — Premium은 최고 플랜이라 리필 플로우로 대체 (§3.1 업셀 원칙과 정합) */}
              {me.plan === "Premium" ? (
                <RefillFlow
                  plan={me.plan}
                  grant={refillGrantFor(me.plan)}
                  price={REFILL_PRICE}
                  owned={ownedCoupons}
                  trigger="리필권으로 한도 늘리기"
                  className="cp-action mt-3 w-full h-12 rounded-md bg-brand text-white text-[15px] font-bold grid place-items-center"
                />
              ) : (
                <Link
                  href="/o/membership"
                  className="cp-action mt-3 w-full h-12 rounded-md bg-brand text-white text-[15px] font-bold grid place-items-center"
                >
                  플랜 올리기
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      {/* 빠른 실행 — 새 캠페인 등록 | 예약 관리 (시안) */}
      <div className="mx-5 mt-3 grid grid-cols-2 gap-2">
        <Link
          href="/o/campaign/new"
          className="cp-action h-[52px] rounded-md border border-hairline bg-canvas flex items-center justify-center gap-1.5 text-[14px] font-semibold text-ink"
        >
          <Icon name="plus" variant="border" size={17} /> 새 캠페인 등록
        </Link>
        <Link
          href="/o/manage?tab=reservations"
          className="cp-action h-[52px] rounded-md border border-brand bg-canvas flex items-center justify-center gap-1.5 text-[14px] font-semibold text-brand"
        >
          <Icon name="calendar-check" variant="border" size={18} /> 예약 관리
        </Link>
      </div>

      {/* 진행 중인 캠페인 — 유형 칩 + 신형 카드, 전체보기 = [관리] 탭 */}
      <div className="px-5 mt-8 mb-3 flex items-end justify-between">
        <h2 className="text-[18px] font-bold text-ink tracking-title">진행 중인 캠페인</h2>
        <Link href="/o/manage" className="cp-action text-[13px] font-medium text-muted">
          전체보기 <span aria-hidden>›</span>
        </Link>
      </div>
      <HomeCampaigns items={items} showDelivery={DELIVERY_ENABLED} />
    </div>
  );
}
