// 모집 한도 리필권 정책 정본 (2026-07-31 BM 전략안 — "CATCHPASS 모집 한도 리필권 비즈니스 모델 전략안").
//
// 월 정액 멤버십 + 사용량 초과분 리필의 하이브리드 과금:
//  - 가격: 모든 유료 플랜 동일 12,900원
//  - 지급: 구매 시점 플랜의 월 모집 한도만큼 (Basic 15 / Standard 50 / Premium 100)
//  - Free: 구매 불가 — Basic 업그레이드만 유도 (5건에 12,900원은 가격 신뢰 훼손)
//  - 적용: 결제 완료 즉시 이번 결제 주기(캘린더 월 KST — 월 한도 기산과 동일) 한도에 가산
//  - 유효기간: 현재 결제 주기 종료(월말 KST)까지 · 미사용 수량 이월 불가
//  - 사용 순서: 기본 한도 소진 후 리필 한도 사용 (가산 산술이라 자동 충족)
//  - 플랜 변경: 이미 구매한 리필 수량은 주기 종료까지 유지 (amount 구매 시점 고정)
//  - 구매 횟수: 무제한 (2026-07-31 보완 — 주기당 횟수 제한 해제. 반복 구매 데이터를 보고
//    제한·Enterprise 전환 기준은 추후 결정. 주기 2회 이상 반복 구매자는 /admin/refills에서
//    대량 모집 플랜 제안 후보로 식별만 한다)
//  - 사용자 노출: 홈 모집 한도 게이지는 기본 플랜 한도 기준 — 리필 누적 수량은 비노출
//    (누적 지출 부담 인지 방지), 구매 시 사용량에서 리필분을 차감해 게이지가 다시 차오른다
//
// 가격 설계 의도(전략안 §3): Basic 소진 → Standard 업그레이드가 리필보다 유리(900원↓·20건↑),
// Standard 소진 → Premium 업그레이드와 100원 차이(비대칭 지배 — 업그레이드 유도),
// Premium 소진 → 리필 반복 구매(건당 129원). 결제(PG) 연동 전에는 멤버십과 동일하게
// 즉시 적용 + 운영팀 수기 청구 SOP를 따른다.

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

// 이번 결제 주기의 구매 내역
export function refillsThisCycle(db: DBShape, ownerId: string, now: number = Date.now()): LimitRefill[] {
  const month = kstMonth(now);
  return (db.limitRefills ?? []).filter((r) => r.ownerId === ownerId && r.month === month);
}

// 이번 결제 주기의 리필 가산 한도 (미사용분 이월 불가 — 당월 레코드만 합산)
export function refillBonus(db: DBShape, ownerId: string, now: number = Date.now()): number {
  return refillsThisCycle(db, ownerId, now).reduce((sum, r) => sum + r.amount, 0);
}

// 사장님의 리필 구매 가능 상태 (구매 API·UI 공유) — 횟수 제한 없음, Free만 미판매
export function refillPurchaseState(db: DBShape, owner: Owner, now: number = Date.now()) {
  return {
    plan: owner.plan,
    grant: refillGrantFor(owner.plan),
    price: REFILL_PRICE,
    purchasedThisCycle: refillsThisCycle(db, owner.id, now).length,
    canBuy: owner.plan !== "Free",
  };
}
