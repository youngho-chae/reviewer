import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import Icon from "@/components/Icon";
import RefillFlow from "@/components/RefillFlow";
import CouponUseButton from "../coupons/CouponUseButton";
import BillingSwitchRow from "./BillingSwitchRow";
import { PLAN_POLICY, PLAN_BENEFITS } from "@/lib/plan-policy";
import {
  ownedRefills,
  refillBonus,
  refillGrantFor,
  REFILL_PRICE,
  PLAN_PRICE,
  NEXT_PLAN,
  yearlyPrice,
  nextYearlyBillingAt,
} from "@/lib/limit-refill";
import { billingCycle, cycleLabel, cycleAnchorAt } from "@/lib/billing-cycle";

export const dynamic = "force-dynamic";

// 통합 멤버십 화면 (2026-08-10 설계안 반영) — 구 [멤버십/구독]과 [쿠폰함]을 하나로.
//  히어로(플랜·결제 방식·다음 결제) → 이번 주기 모집 게이지 → 한도 업셀 배너(조건부) →
//  {플랜} 혜택 카드(캐치패스·캐치랭크 §2③) → 리필권(쿠폰함 통합) → 멤버십 관리 → 각주.
// 시안 블루 액센트는 v2 규칙(퍼플=인터랙션)으로 치환.

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
  const anchor = cycleAnchorAt(me);
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
  const gaugeTone = remainPct > 0.5 ? "bg-brand" : remainPct > 0.1 ? "bg-[#EAB308]" : "bg-error";

  // 한도 업셀 배너 (§showUpsell) — 직전 3개 주기 월평균 모집이 기본 한도의 80% 이상 + 상위 플랜 존재
  const recent: number[] = [];
  let probe = cycle.start - 1;
  for (let i = 0; i < 3; i++) {
    const c = billingCycle(me, probe);
    recent.push(
      db.campaigns
        .filter((x) => storeIds.has(x.storeId) && x.createdAt >= c.start && x.createdAt <= c.end)
        .reduce((sum, x) => sum + x.quota.S + x.quota.A + x.quota.B + x.quota.C, 0),
    );
    probe = c.start - 1;
  }
  const avg3 = Math.round(recent.reduce((a, b) => a + b, 0) / 3);
  const upsellPlan = NEXT_PLAN[me.plan];
  const showUpsell = !!upsellPlan && avg3 >= baseLimit * 0.8;

  // 리필권 (쿠폰함 통합)
  const owned = ownedRefills(db, me.id);
  const usedRefills = (db.limitRefills ?? [])
    .filter((r) => r.ownerId === me.id && r.usedAt)
    .sort((a, b) => (b.usedAt ?? 0) - (a.usedAt ?? 0));

  const benefits = PLAN_BENEFITS[me.plan];

  return (
    <div className="pb-24 bg-canvas">
      {/* top-app-bar */}
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-3 flex items-center">
          <Link href="/o/me" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="더보기로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
          <h1 className="text-[18px] font-bold text-ink tracking-title">멤버십</h1>
        </div>
      </div>

      {/* 히어로 — 다크 카드 (시안 1a): 플랜 · 결제 방식 칩 · 기간 · 다음 결제 · [멤버십 관리] */}
      <section className="bg-ink px-5 pt-6 pb-6">
        <div className="text-[12px] text-white/60">내 멤버십</div>
        <div className="mt-1.5 flex items-center gap-2.5">
          <span className="text-[28px] font-bold text-white tracking-title leading-none">{me.plan}</span>
          {billing && (
            <span className="inline-flex items-center px-2 py-1 rounded-[6px] bg-white/15 text-[11px] font-semibold text-white">
              {billing === "yearly" ? "연간 이용 중" : "월간 이용 중"}
            </span>
          )}
        </div>
        <div className="mt-2 text-[13px] text-white/50 tabular-nums">
          {isFree
            ? "멤버십 미가입 — 언제든 시작할 수 있어요"
            : billing === "yearly"
              ? `${fmtDate(anchor)} ~ ${fmtDate(nextYearlyBillingAt(anchor) - 1)}`
              : `이번 주기 ${cycleLabel(cycle)}`}
        </div>
        <div className="mt-5 pt-4 border-t border-white/15 flex items-end justify-between gap-3">
          {isFree ? (
            <div>
              <div className="text-[12px] text-white/60">다음 결제 없음</div>
              <div className="mt-1 text-[16px] font-bold text-white">0원 — Free 플랜</div>
            </div>
          ) : (
            <div>
              <div className="text-[12px] text-white/60">다음 {billing === "yearly" ? "연간" : "월간"} 결제</div>
              <div className="mt-1 text-[16px] font-bold text-white tabular-nums">
                {billing === "yearly"
                  ? `${fmtDate(nextYearlyBillingAt(anchor))} · ${yearlyPrice(me.plan).toLocaleString()}원`
                  : `${fmtDate(cycle.end + 1)} · ${PLAN_PRICE[me.plan].toLocaleString()}원`}
              </div>
            </div>
          )}
          <a
            href={isFree ? "/o/membership/plans" : "#manage"}
            className="cp-action shrink-0 inline-flex items-center gap-1 h-9 px-3.5 rounded-pill bg-white/15 text-[13px] font-semibold text-white"
          >
            {isFree ? "플랜 시작하기" : "멤버십 관리"} <Icon name="chevron-right" variant="border" size={12} />
          </a>
        </div>
      </section>

      {/* 이번 주기 체험단 모집 — 잔여 카운팅·게이지 (홈과 동일 정본·기본 한도 기준 표기) */}
      <section className="px-5 -mt-3">
        <div className="rounded-lg border border-hairline bg-canvas p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[14px] font-bold text-ink">이번 주기 체험단 모집</div>
            <div className="text-[11px] text-muted tabular-nums">{cycleLabel(cycle)}</div>
          </div>
          <div className="mt-2.5">
            <span className={`text-[26px] font-bold tabular-nums ${remainPct <= 0.1 ? "text-error" : "text-brand"}`}>{remain}건</span>
            <span className="ml-1.5 text-[13px] text-muted tabular-nums">남음 / {baseLimit}건</span>
          </div>
          <div className="mt-2 h-2 rounded-pill bg-sunken overflow-hidden">
            <div className={`h-full rounded-pill ${gaugeTone}`} style={{ width: `${Math.max(2, Math.round(remainPct * 100))}%` }} />
          </div>
          <p className="mt-2 text-[12px] text-muted">다음 주기에도 {baseLimit}건이 새로 제공돼요.</p>
          <div className="mt-3 pt-3 border-t border-hairlineSoft grid grid-cols-2">
            {isFree ? (
              <Link href="/o/membership/plans" className="cp-action text-center text-[14px] font-bold text-brand">
                플랜 시작하기
              </Link>
            ) : (
              <a href="#refill" className="cp-action text-center text-[14px] font-bold text-brand">
                리필하기
              </a>
            )}
            <Link href="/o/membership/plans" className="cp-action text-center text-[14px] font-bold text-brand border-l border-hairlineSoft">
              플랜 보기
            </Link>
          </div>
        </div>
      </section>

      {/* 한도 업셀 배너 — 직전 3개 주기 월평균이 한도에 근접할 때만 (시안 showUpsell) */}
      {showUpsell && (
        <section className="px-5 mt-3">
          <Link href="/o/membership/plans" className="cp-action flex items-center gap-3 rounded-lg border-[1.5px] border-brand bg-canvas p-4">
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-bold text-ink">이번 주기 한도가 곧 부족해질 수 있어요</span>
              <span className="block mt-1 text-[12px] text-ink2 leading-[1.5]">
                최근 3개월 동안 월평균 {avg3}건을 모집했어요. 상위 플랜으로 여유를 확보해 보세요.
              </span>
            </span>
            <Icon name="chevron-right" variant="border" size={16} className="shrink-0 text-brand" />
          </Link>
        </section>
      )}

      {/* {플랜} 혜택 — 캐치패스·캐치랭크 한 카드 (§2③, 우선순위 §8) */}
      <section className="px-5 mt-3">
        <div className="rounded-lg border border-hairline bg-canvas p-4">
          <div className="text-[15px] font-bold text-ink">{me.plan} 혜택</div>
          <div className="mt-3">
            <div className="text-[12px] font-bold text-brand">• 캐치패스</div>
            <ul className="mt-1.5 space-y-1.5">
              {benefits.catchpass.map((b) => (
                <li key={b} className="flex items-start gap-2 text-[13px] text-ink">
                  <span className="shrink-0 text-successStrong" aria-hidden>✓</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
          {benefits.catchrank.length > 0 && (
            <div className="mt-3.5 pt-3.5 border-t border-hairlineSoft">
              <div className="text-[12px] font-bold text-brand">• 캐치랭크</div>
              <ul className="mt-1.5 space-y-1.5">
                {benefits.catchrank.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-[13px] text-ink">
                    <span className="shrink-0 text-successStrong" aria-hidden>✓</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <details className="mt-3.5 pt-1 group">
            <summary className="cp-action list-none cursor-pointer text-center text-[13px] font-semibold text-ink2">
              전체 혜택 보기 <span className="inline-block group-open:rotate-180 transition-transform" aria-hidden>⌄</span>
            </summary>
            <ul className="mt-2.5 pt-2.5 border-t border-hairlineSoft space-y-1.5">
              {benefits.common.map((b) => (
                <li key={b} className="flex items-start gap-2 text-[13px] text-ink2">
                  <span className="shrink-0 text-muted" aria-hidden>✓</span>
                  {b}
                </li>
              ))}
            </ul>
          </details>
        </div>
      </section>

      {/* 모집 한도 리필권 — 구 쿠폰함 통합 (구매·보유·사용 내역) */}
      <section id="refill" className="px-5 mt-3 scroll-mt-16">
        <div className="rounded-lg border border-hairline bg-canvas p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[15px] font-bold text-ink">🎟️ 모집 한도 리필권</div>
              <p className="mt-1 text-[12px] text-ink2 leading-[1.5]">이번 주기 모집 한도를 한 번 더 충전할 수 있어요.</p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[16px] font-bold text-ink tabular-nums">{REFILL_PRICE.toLocaleString()}원</div>
              <div className="text-[11px] text-muted">/1장</div>
            </div>
          </div>

          {/* 보유 쿠폰 */}
          {owned.length > 0 && (
            <div className="mt-3 space-y-2">
              {owned.map((r) => (
                <div key={r.id} className="rounded-md border border-brand/40 bg-brandSoft/40 px-3.5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-ink">리필권 +{r.amount}건</div>
                    <div className="mt-0.5 text-[11px] text-muted tabular-nums">{fmtShort(r.purchasedAt)} 구매 · 사용 전까지 보관</div>
                  </div>
                  <CouponUseButton refillId={r.id} amount={r.amount} />
                </div>
              ))}
            </div>
          )}

          <div className="mt-3">
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
                trigger="리필권 구매하기"
                className="cp-action w-full h-11 rounded-md border border-brand text-brand text-[14px] font-bold"
              />
            )}
          </div>
          <p className="mt-2 text-[11px] text-muted leading-[1.6]">
            구매하면 쿠폰으로 발급돼요 — 바로 쓰거나 보관할 수 있어요. 사용한 결제 주기의 모집 한도에 추가되고, 그
            주기까지만 유효해요 (남은 수량 이월 불가).
          </p>

          {/* 사용 내역 */}
          {usedRefills.length > 0 && (
            <details className="mt-3 group">
              <summary className="cp-action list-none cursor-pointer text-[12px] font-semibold text-ink2">
                사용 내역 {usedRefills.length}건 <span className="inline-block group-open:rotate-180 transition-transform" aria-hidden>⌄</span>
              </summary>
              <div className="mt-2 space-y-1.5">
                {usedRefills.map((r) => (
                  <div key={r.id} className="rounded-sm bg-sunken px-3 py-2 flex items-center justify-between text-[12px] tabular-nums">
                    <span className="text-ink2">리필권 +{r.amount}건</span>
                    <span className="text-muted">
                      {fmtShort(r.usedAt!)} 사용{r.usedAt! >= cycle.start && r.usedAt! <= cycle.end ? " · 이번 주기 적용 중" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </section>

      {/* 멤버십 관리 — 리스트 (시안: 상위 플랜 변경 / 결제 방식 변경 / 자동 갱신 해지 / 해지) */}
      <section id="manage" className="px-5 mt-6 scroll-mt-16">
        <div className="rounded-lg border border-hairline bg-canvas overflow-hidden">
          <Link href="/o/membership/plans" className="cp-action flex items-center justify-between px-4 py-4 border-b border-hairlineSoft">
            <span className="text-[14px] font-semibold text-ink">{isFree ? "플랜 시작하기" : "상위 플랜으로 변경"}</span>
            <Icon name="chevron-right" variant="border" size={14} className="text-mutedSoft" />
          </Link>
          {!isFree && <BillingSwitchRow plan={me.plan} billing={billing!} />}
          <div className="flex items-center justify-between px-4 py-4 border-b border-hairlineSoft">
            <span className="text-[14px] font-semibold text-ink">자동 갱신 해지</span>
            <span className="text-[11px] text-muted">결제(PG) 연동 전 — 운영팀 문의</span>
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <span className="text-[14px] font-semibold text-mutedSoft">멤버십 해지</span>
            <span className="text-[11px] text-muted">help@catchrank.co.kr</span>
          </div>
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
