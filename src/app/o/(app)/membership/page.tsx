import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import Icon from "@/components/Icon";
import RefillFlow from "@/components/RefillFlow";
import CouponUseButton from "../coupons/CouponUseButton";
import BillingSwitchRow from "./BillingSwitchRow";
import CancelMembershipRow from "./CancelMembershipRow";
import { PLAN_POLICY, PLAN_BENEFITS } from "@/lib/plan-policy";
import {
  ownedRefills,
  refillBonus,
  refillGrantFor,
  REFILL_PRICE,
  PLAN_PRICE,
  yearlyPrice,
  nextYearlyBillingAt,
} from "@/lib/limit-refill";
import { billingCycle, cycleLabel, cycleAnchorAt } from "@/lib/billing-cycle";

export const dynamic = "force-dynamic";

// 내 멤버십 (2026-08-12 와이어프레임 개편) — 구 다크 히어로·별도 모집 카드·업셀 배너를
// **플랜 카드 하나로 통합**: 플랜명+이용 중 칩+[플랜 전체 보기] → 이번 주기 → 다음 결제
// 예정일/예상 금액 박스 → 모집 한도 게이지(+소진 경고). 이어서 모집한도 리필권 카드
// (보유 n장 [사용하기]·[리필권 구매]·안내 불릿·최근 구매/사용내역 5건 접힘),
// {플랜} 혜택 카드(캐치패스/캐치랭크 섹션 밴드 — 전체 노출, 구 아코디언 폐기).
// 멤버십 관리 리스트(결제 방식 전환·해지 임시 활성)는 와이어프레임 밖이지만 기능 유지.

const fmtDate = (t: number) => {
  const d = new Date(t + 9 * 3600000);
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}`;
};
const fmtShort = (t: number) => {
  const d = new Date(t + 9 * 3600000);
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}`;
};

export default async function MembershipPage() {
  const me = await getCurrentOwner();
  const db = await getDBAsync();

  const isFree = me.plan === "Free";
  const billing = isFree ? null : (me.billing ?? "monthly");
  const cycle = billingCycle(me);

  // 이번 주기 모집 사용량 — 홈·캠페인 생성 검증과 동일 정본 계산 (기본 한도 기준 표기)
  const myStores = db.stores.filter((s) => s.ownerId === me.id);
  const storeIds = new Set(myStores.map((s) => s.id));
  const cycleUsed = db.campaigns
    .filter((c) => storeIds.has(c.storeId) && c.createdAt >= cycle.start)
    .reduce((sum, c) => sum + c.quota.S + c.quota.A + c.quota.B + c.quota.C, 0);
  const refill = refillBonus(db, me);
  const baseLimit = PLAN_POLICY[me.plan].monthlyTeamLimit;
  const shownUsed = Math.min(baseLimit, Math.max(0, cycleUsed - refill));
  const remain = baseLimit - shownUsed;
  const remainPct = baseLimit > 0 ? remain / baseLimit : 0;
  const depleted = remain <= 0;
  const gaugeTone = remainPct > 0.5 ? "bg-brand" : remainPct > 0.1 ? "bg-[#EAB308]" : "bg-error";

  // 다음 결제 예정 — 연간: 결제 anchor(planStartedAt) +1년 / 월간: 이번 주기 종료 다음 날.
  // (모집 주기 cycle.start는 월 단위로 전진하므로 연간 결제 기준으로 쓰면 안 된다)
  const anchor = cycleAnchorAt(me);
  const nextBillAt = isFree ? null : billing === "yearly" ? nextYearlyBillingAt(anchor) : cycle.end + 1;
  const nextBillAmount = isFree ? null : billing === "yearly" ? yearlyPrice(me.plan) : PLAN_PRICE[me.plan];

  // 리필권 (쿠폰함 통합) — 보유는 오래된 구매 순(사용 기본 순서), 내역은 구매/사용 이벤트 병합
  const owned = ownedRefills(db, me.id);
  const myRefills = (db.limitRefills ?? []).filter((r) => r.ownerId === me.id);
  const history = [
    ...myRefills.map((r) => ({ kind: "buy" as const, at: r.purchasedAt, amount: r.amount })),
    ...myRefills.filter((r) => r.usedAt).map((r) => ({ kind: "use" as const, at: r.usedAt!, amount: r.amount })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 5);

  const benefits = PLAN_BENEFITS[me.plan];

  return (
    <div className="pb-24 bg-canvas">
      {/* top-app-bar — 뒤로가기 + 중앙 타이틀 (와이어프레임) */}
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-3 grid grid-cols-[40px_1fr_40px] items-center">
          <Link href="/o/me" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="마이로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
          <h1 className="text-[16px] font-bold text-ink tracking-title text-center">내 멤버십</h1>
          <span />
        </div>
      </div>

      {/* 플랜 카드 — 플랜명·칩·[플랜 전체 보기] + 이번 주기 + 다음 결제 박스 + 모집 한도 게이지 */}
      <section className="px-5 pt-2">
        <div className="rounded-lg border-[1.5px] border-brand bg-canvas p-4">
          <div className="flex items-center gap-2">
            <span className="text-[20px] font-bold text-ink tracking-title leading-none">{me.plan}</span>
            {billing && (
              <span className="shrink-0 inline-flex items-center px-2 py-1 rounded-pill bg-brandSoft text-[11px] font-bold text-brand">
                {billing === "yearly" ? "연간 이용 중" : "월간 이용 중"}
              </span>
            )}
            <Link
              href="/o/membership/plans"
              className="cp-action ml-auto shrink-0 inline-flex items-center h-9 px-3.5 rounded-md border border-brand text-[13px] font-bold text-brand"
            >
              플랜 전체 보기
            </Link>
          </div>
          <div className="mt-2 text-[13px] text-ink2 tabular-nums">
            이번 주기 <span className="font-semibold text-ink">{cycleLabel(cycle)}</span>
          </div>

          {/* 다음 결제 예정 박스 — Free는 미가입 안내 */}
          <div className="mt-3 rounded-md bg-sunken px-3.5 py-3 space-y-1.5">
            {isFree ? (
              <div className="text-[13px] text-muted">멤버십 미가입 — 언제든 시작할 수 있어요</div>
            ) : (
              <>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted">다음 결제 예정일</span>
                  <span className="font-semibold text-ink tabular-nums">{fmtDate(nextBillAt!)}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted">결제 예상 금액</span>
                  <span className="font-bold text-ink tabular-nums">{nextBillAmount!.toLocaleString()}원</span>
                </div>
              </>
            )}
          </div>

          {/* 모집 한도 — 잔여 카운팅 + 게이지 (홈과 동일 정본·기본 한도 기준 표기) */}
          <div className="mt-3.5 flex items-baseline gap-2 text-[13px] tabular-nums">
            <span className="text-ink font-semibold">모집 한도</span>
            <span className={`text-[16px] font-bold ${depleted || remainPct <= 0.1 ? "text-error" : "text-ink"}`}>{remain} 남음</span>
            <span className="text-muted">/ {baseLimit}</span>
          </div>
          <div className="mt-2 h-2 rounded-pill bg-sunken overflow-hidden">
            <div className={`h-full rounded-pill ${gaugeTone}`} style={{ width: `${Math.max(2, Math.round(remainPct * 100))}%` }} />
          </div>
          {depleted && (
            <div className="mt-2.5 rounded-md bg-errorSoft px-3 py-2.5 text-[12px] text-error leading-[1.5]">
              ⓘ 이번 주기 모집 한도를 모두 사용했어요. 새 캠페인을 만들려면 한도를 늘려주세요
            </div>
          )}
        </div>
      </section>

      {/* 모집한도 리필권 — 보유 n장 [사용하기] + [리필권 구매] + 안내 불릿 + 최근 내역 */}
      <section id="refill" className="px-5 mt-3 scroll-mt-16">
        <div className="rounded-lg border border-hairline bg-canvas p-4">
          <div className="text-[15px] font-bold text-ink">모집한도 리필권</div>

          {/* 보유 리필권 행 — 사용은 오래된 구매분부터 1장 (와이어프레임 단일 행) */}
          <div className="mt-3 rounded-md border border-hairline px-3.5 py-3 flex items-center gap-3">
            <span className="flex-1 text-[14px] text-ink">
              보유 리필권 <span className="font-bold tabular-nums">{owned.length}장</span>
            </span>
            {owned.length > 0 ? (
              <CouponUseButton refillId={owned[0].id} amount={owned[0].amount} />
            ) : (
              <span className="shrink-0 h-9 px-3.5 rounded-md bg-sunken text-[13px] font-bold text-mutedSoft inline-flex items-center">
                사용하기
              </span>
            )}
          </div>

          <div className="mt-2.5">
            {isFree ? (
              <p className="text-[12px] text-muted leading-[1.5]">
                Free 플랜은 리필권을 구매할 수 없어요 —{" "}
                <Link href="/o/membership/plans" className="text-brand font-medium">Basic으로 업그레이드</Link>하면 매월 15건을
                모집할 수 있어요.
              </p>
            ) : (
              <RefillFlow
                plan={me.plan}
                grant={refillGrantFor(me.plan)}
                price={REFILL_PRICE}
                owned={owned.length}
                mode="buy"
                trigger="리필권 구매"
                className="cp-action w-full h-11 rounded-md border border-hairline text-ink text-[14px] font-bold"
              />
            )}
          </div>

          {/* 안내 불릿 (와이어프레임 원문) */}
          <ul className="mt-3 space-y-1 text-[12px] text-muted leading-[1.55]">
            <li className="flex gap-1.5"><span className="shrink-0">·</span><span>이번 주기 모집 한도를 한 번 더 충전할 수 있어요.</span></li>
            <li className="flex gap-1.5"><span className="shrink-0">·</span><span>만료기간 없이 사용 전까지 보관돼요.</span></li>
            <li className="flex gap-1.5"><span className="shrink-0">·</span><span>리필권을 구매하면 바로 사용하거나 보관할 수 있어요.</span></li>
            <li className="flex gap-1.5"><span className="shrink-0">·</span><span>사용한 결제 주기의 모집 한도에 추가되고, 그 주기까지만 유효해요. (남은 수량 이월 불가)</span></li>
          </ul>

          {/* 최근 구매/사용 내역 (최대 5건) — 접힘 */}
          {history.length > 0 && (
            <details className="mt-3.5 group">
              <summary className="cp-action list-none cursor-pointer text-center text-[13px] font-semibold text-ink2">
                최근 구매/사용내역 (최대 5건) <span className="inline-block group-open:rotate-180 transition-transform" aria-hidden>⌄</span>
              </summary>
              <div className="mt-2.5 rounded-md bg-sunken px-3.5 py-1 divide-y divide-hairline">
                {history.map((h, i) => (
                  <div key={i} className="py-2.5 flex items-center justify-between text-[13px] tabular-nums">
                    <span className={h.kind === "use" ? "font-semibold text-ink" : "text-ink2"}>
                      {h.kind === "use" ? `사용 +${h.amount}건` : "구매"}
                    </span>
                    <span className="text-muted">{fmtShort(h.at)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </section>

      {/* {플랜} 혜택 — 캐치패스·캐치랭크 섹션 밴드, 전체 노출 (와이어프레임 — 구 아코디언 폐기) */}
      <section className="px-5 mt-3">
        <div className="rounded-lg border border-hairline bg-canvas p-4">
          <div className="text-[16px] font-bold text-ink tracking-title">{me.plan} 혜택</div>

          <div className="mt-3 rounded-md bg-sunken px-3.5 py-2 text-[13px] font-bold text-ink">캐치패스</div>
          <ul className="mt-2.5 px-1 space-y-2">
            {benefits.catchpass.map((b) => (
              <li key={b} className="flex items-start gap-2 text-[13px] text-ink">
                <span className="shrink-0 text-successStrong font-bold" aria-hidden>✓</span>
                {b}
              </li>
            ))}
          </ul>

          {benefits.catchrank.length > 0 && (
            <>
              <div className="mt-3.5 rounded-md bg-sunken px-3.5 py-2 text-[13px] font-bold text-ink">캐치랭크</div>
              <ul className="mt-2.5 px-1 space-y-2">
                {benefits.catchrank.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-[13px] text-ink">
                    <span className="shrink-0 text-successStrong font-bold" aria-hidden>✓</span>
                    {b}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      {/* 멤버십 관리 — 결제 방식 전환·해지(임시 활성) 유지 (와이어프레임 밖 — 기능 보존) */}
      <section id="manage" className="px-5 mt-6 scroll-mt-16">
        <div className="rounded-lg border border-hairline bg-canvas overflow-hidden">
          {!isFree && <BillingSwitchRow plan={me.plan} billing={billing!} />}
          <div className="flex items-center justify-between px-4 py-4 border-b border-hairlineSoft">
            <span className="text-[14px] font-semibold text-ink">자동 갱신 해지</span>
            <span className="text-[11px] text-muted">결제(PG) 연동 전 — 운영팀 문의</span>
          </div>
          {/* 멤버십 해지 (2026-08-11 임시 활성) — 유료 플랜만: 확인 모달 → Free 전환 */}
          {isFree ? (
            <div className="flex items-center justify-between px-4 py-4">
              <span className="text-[14px] font-semibold text-mutedSoft">멤버십 해지</span>
              <span className="text-[11px] text-muted">이용 중인 멤버십이 없어요</span>
            </div>
          ) : (
            <CancelMembershipRow plan={me.plan} />
          )}
        </div>
        {/* 각주 — 연간 상품 성격·월간 전환 정산 (시안 원문) */}
        <p className="mt-3 text-[11px] text-muted leading-[1.6]">
          연간 멤버십은 10개월분 요금으로 12개월 이용하는 상품이에요. 월간으로 변경하면 이용한 기간은 월간
          정상요금으로 다시 계산하고 남은 금액을 돌려드려요. 플랜 요금은 결제(PG) 연동 전까지 운영팀이 확인 후
          청구합니다. 해지·환불은{" "}
          <Link href="/legal/terms" className="text-brand font-medium">이용약관 제10조</Link>를 확인해주세요.
        </p>
      </section>
    </div>
  );
}
