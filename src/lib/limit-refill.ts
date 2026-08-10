// 모집 한도 리필권 정책 정본 (2026-07-31 BM 전략안 — "CATCHPASS 모집 한도 리필권 비즈니스 모델 전략안").
//
// 월 정액 멤버십 + 사용량 초과분 리필의 하이브리드 과금. **쿠폰형** (2차 보완):
//  - 가격: 모든 유료 플랜 동일 12,900원/장
//  - 지급: 구매 시점 플랜의 월 모집 한도만큼 (Basic 15 / Standard 50 / Premium 100) — 쿠폰에 고정
//  - Free: 구매 불가 — Basic 업그레이드만 유도 (5건에 12,900원은 가격 신뢰 훼손)
//  - 구매 = 쿠폰 발급 (자동 적용 아님) — 구매 직후 [지금 쓰기]/[나중에 쓰기] 선택,
//    미사용 쿠폰은 마이페이지 **쿠폰함**(/o/coupons)에 보관 (구매도 쿠폰함에서 제공)
//  - 사용: 쿠폰 1장 사용 = 그 결제 주기(캘린더 월 KST — 월 한도 기산과 동일) 한도에 가산.
//    가산분은 사용한 주기까지만 유효·이월 불가 (미사용 쿠폰 자체는 계속 보관)
//  - 진입점: 홈·새 캠페인 등록의 모집 한도 카드 [리필하기] — 보유 쿠폰 없으면 구매 플로우,
//    있으면 "보유한 리필권 n개 중 1개를 사용할까요?" 사용 플로우 (RefillFlow 공용)
//  - 구매 횟수: 무제한 (1차 보완 — 반복 구매 데이터로 제한·Enterprise 전환 기준 추후 결정.
//    주기 2회 이상 반복 구매자는 /admin/refills에서 대량 모집 플랜 제안 후보로 식별만)
//  - 사용자 노출: 홈·생성 폼 한도 카드는 기본 플랜 한도 기준 — 리필 누적 수량 비노출
//    (누적 지출 부담 인지 방지), 사용 시 표시 사용량에서 차감되어 게이지가 다시 차오른다
//
// 가격 설계 의도(전략안 §3): Basic 소진 → Standard 업그레이드가 리필보다 유리(900원↓·20건↑),
// Standard 소진 → Premium 업그레이드와 100원 차이(비대칭 지배 — 업그레이드 유도),
// Premium 소진 → 리필 반복 구매(건당 129원). 결제(PG) 연동 전에는 멤버십과 동일하게
// 즉시 발급 + 운영팀 수기 청구 SOP를 따른다.

import type { DBShape, LimitRefill, Owner } from "./types";
import { PLAN_POLICY, type PlanKey } from "./plan-policy";
import { billingCycle } from "./billing-cycle";

export const REFILL_PRICE = 12900;

// 플랜 월 요금 (업셀 카피 계산용 — 멤버십 화면 표기와 동일 값)
export const PLAN_PRICE: Record<PlanKey, number> = {
  Free: 0,
  Basic: 13900,
  Standard: 25900,
  Premium: 38900,
};

// 다음 업그레이드 플랜 (업셀 추천 카드용 — Premium은 리필이 주력 상품)
export const NEXT_PLAN: Partial<Record<PlanKey, PlanKey>> = {
  Free: "Basic",
  Basic: "Standard",
  Standard: "Premium",
};

// ── 연간 결제 (2026-08-10 통합 멤버십 설계안 §2) ─────────────────────────────
// 연간 = 10개월분 요금으로 12개월 이용 — "할인율" 대신 절감 금액과 "2개월 무료"로 표기(§2②).
export const YEARLY_FREE_MONTHS = 2;
export function yearlyPrice(plan: PlanKey): number {
  return PLAN_PRICE[plan] * (12 - YEARLY_FREE_MONTHS);
}
// 정가(월간 12개월분) — 플랜 비교 카드의 취소선 표기
export function yearlyListPrice(plan: PlanKey): number {
  return PLAN_PRICE[plan] * 12;
}
// 절감 금액(2개월분) — "27,800원 절약" 표기
export function yearlySavings(plan: PlanKey): number {
  return PLAN_PRICE[plan] * YEARLY_FREE_MONTHS;
}
// 월 환산가 — "월 환산 약 11,583원" 표기
export function yearlyMonthlyEquivalent(plan: PlanKey): number {
  return Math.round(yearlyPrice(plan) / 12);
}
// 다음 연간 결제일 = 최근 결제(planStartedAt) + 1년 (KST 날짜, 월 말일 클램프)
export function nextYearlyBillingAt(planStartedAt: number): number {
  const KST = 9 * 3600000;
  const d = new Date(planStartedAt + KST);
  const y = d.getUTCFullYear() + 1;
  const m = d.getUTCMonth();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Date.UTC(y, m, Math.min(d.getUTCDate(), lastDay), 0, 0, 0) - KST;
}

// 현재 결제 주기 키 — 월 한도 기산(currentMonthStart)과 동일하게 캘린더 월(KST) 기준
export function kstMonth(now: number = Date.now()): string {
  return new Date(now + 9 * 3600000).toISOString().slice(0, 7);
}

// 리필권 구매 시 지급 수량 = 구매 시점 플랜의 월 모집 한도
export function refillGrantFor(plan: PlanKey): number {
  return plan === "Free" ? 0 : PLAN_POLICY[plan].monthlyTeamLimit;
}

// 보유 중(미사용) 쿠폰 — 쿠폰함 목록·[리필하기] 분기용 (오래된 구매 순 = 사용 기본 순서)
export function ownedRefills(db: DBShape, ownerId: string): LimitRefill[] {
  return (db.limitRefills ?? [])
    .filter((r) => r.ownerId === ownerId && !r.usedAt)
    .sort((a, b) => a.purchasedAt - b.purchasedAt);
}

// 이번 결제 주기에 **사용(적용)**된 리필 가산 한도 — 사용한 주기까지만 유효·이월 불가.
// 주기 = billing-cycle 정본 (2026-08-03 — 유료: 결제 시점~재결제 전, Free: 가입일 anniversary).
export function refillBonus(db: DBShape, owner: Owner, now: number = Date.now()): number {
  const cycle = billingCycle(owner, now);
  return (db.limitRefills ?? [])
    .filter((r) => r.ownerId === owner.id && r.usedAt && r.usedAt >= cycle.start && r.usedAt <= cycle.end)
    .reduce((sum, r) => sum + r.amount, 0);
}

// 이번 결제 주기 **구매** 내역 (청구·반복 구매 지표용 — 사용 여부 무관)
export function purchasesThisCycle(db: DBShape, ownerId: string, now: number = Date.now()): LimitRefill[] {
  const month = kstMonth(now);
  return (db.limitRefills ?? []).filter((r) => r.ownerId === ownerId && kstMonth(r.purchasedAt) === month);
}

// 사장님의 리필 상태 (구매/사용 API·UI 공유) — 구매 횟수 제한 없음, Free만 미판매
export function refillPurchaseState(db: DBShape, owner: Owner, now: number = Date.now()) {
  return {
    plan: owner.plan,
    grant: refillGrantFor(owner.plan),
    price: REFILL_PRICE,
    owned: ownedRefills(db, owner.id).length,
    purchasedThisCycle: purchasesThisCycle(db, owner.id, now).length,
    canBuy: owner.plan !== "Free",
  };
}
