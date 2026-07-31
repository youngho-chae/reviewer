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

// 이번 결제 주기에 **사용(적용)**된 리필 가산 한도 — 사용한 주기까지만 유효·이월 불가
export function refillBonus(db: DBShape, ownerId: string, now: number = Date.now()): number {
  const month = kstMonth(now);
  return (db.limitRefills ?? [])
    .filter((r) => r.ownerId === ownerId && r.usedMonth === month)
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
