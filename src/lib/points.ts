// ─────────────────────────────────────────────────────────────
// 포인트 정책 코어 — 2026-07-12 레뷰 벤치마크 반영 (docs/벤치마크-레뷰.md §3.1)
// 정책 정본: 운영정책서 §14. 1P = 1원.
//
// [P4] 적립은 실제 발생 이벤트(리뷰 검수 승인)만. [P5] 소비 경로 = 출금 흐름 구현.
// [P1] 등급은 혜택 크기 — 지급 포인트에 지원금과 동일한 등급 배율을 적용한다.
// ─────────────────────────────────────────────────────────────

import { DBShape, Grade, PointTxn, WithdrawalRequest } from "./types";
import { SUPPORT_MULTIPLIER } from "./grade";
import { rid } from "./ids";

// ── 출금 정책 상수 (레뷰: 최소 10,000P·1만 단위·제휴 계좌 5,000P — 우리는 1,000P 단위로 완화) ──
export const MIN_WITHDRAWAL_POINTS = 10000;
export const WITHDRAWAL_UNIT_POINTS = 1000;
export const WITHDRAWAL_FEE = 500; // 이체 수수료 (제휴 은행 면제는 §13 제안)

// ── 원천징수 (국세청 기준 — 벤치마크 문서 §1.3) ──
// 사업소득: 계속·반복 활동 — 소득세 3% + 지방소득세 0.3% = 3.3%. 플랫폼 기본 적용.
export const BUSINESS_INCOME_RATE = 0.033;
// 기타소득: 일시·우발 활동 — 필요경비 60% 인정 후 22% = 지급액의 8.8%.
export const OTHER_INCOME_EFFECTIVE_RATE = 0.088;
// 기타소득 과세최저한 — 기타소득금액(지급액×40%) 건당 5만 원 이하 = 지급액 125,000원 이하 비과세.
export const OTHER_INCOME_EXEMPT_MAX_PAYMENT = 125000;
// 소액부징수 — 원천징수세액 1,000원 미만이면 징수하지 않음 (소득세법 §86).
export const DE_MINIMIS_TAX = 1000;

// 배송형 리뷰 승인 시 지급 포인트 — 기준 포인트 × 등급 배율, 100P 단위 반올림
// (supportForGrade와 동일한 반올림 규칙 — 정책 드리프트 방지).
export function pointsForGrade(base: number, g: Grade): number {
  const raw = (base || 0) * SUPPORT_MULTIPLIER[g];
  return Math.round(raw / 100) * 100;
}

// 사업소득 3.3% 원천징수세액 — 원 단위 절사 + 소액부징수.
export function businessWithholding(payment: number): number {
  const tax = Math.floor(payment * BUSINESS_INCOME_RATE);
  return tax < DE_MINIMIS_TAX ? 0 : tax;
}

// 기타소득 8.8% 원천징수세액 — 과세최저한(지급액 125,000원 이하 0) + 원 단위 절사.
// 현행 정책은 사업소득 고정이지만, 소득 구분 전환에 대비해 병행 구현·테스트한다 (벤치마크 §2.1-3).
export function otherIncomeWithholding(payment: number): number {
  if (payment <= OTHER_INCOME_EXEMPT_MAX_PAYMENT) return 0;
  const tax = Math.floor(payment * OTHER_INCOME_EFFECTIVE_RATE);
  return tax < DE_MINIMIS_TAX ? 0 : tax;
}

export interface WithdrawalQuote {
  amountPoints: number;
  taxWithheld: number;
  fee: number;
  payout: number; // 실지급액 = 신청 − 세금 − 수수료
}

// 출금 신청 견적 — 신청 화면 미리보기와 신청 API가 공유한다 (표시·확정 값 불일치 방지).
export function quoteWithdrawal(amountPoints: number): WithdrawalQuote {
  const taxWithheld = businessWithholding(amountPoints);
  return { amountPoints, taxWithheld, fee: WITHDRAWAL_FEE, payout: amountPoints - taxWithheld - WITHDRAWAL_FEE };
}

// 출금 신청 금액 검증 — 실패 사유 문자열 반환 (null = 통과).
export function validateWithdrawalAmount(amountPoints: number, balance: number): string | null {
  if (!Number.isInteger(amountPoints) || amountPoints <= 0) return "출금 금액을 확인해주세요.";
  if (amountPoints < MIN_WITHDRAWAL_POINTS)
    return `최소 ${MIN_WITHDRAWAL_POINTS.toLocaleString()}P부터 출금할 수 있어요.`;
  if (amountPoints % WITHDRAWAL_UNIT_POINTS !== 0)
    return `${WITHDRAWAL_UNIT_POINTS.toLocaleString()}P 단위로 신청해주세요.`;
  if (amountPoints > balance) return "보유 포인트가 부족합니다.";
  return null;
}

// 잔액 = 원장 합산 (append-only 원장에서 파생 — 별도 잔액 필드를 두지 않는다).
export function pointBalance(db: DBShape, reviewerId: string): number {
  return (db.pointTxns ?? []).reduce((sum, t) => (t.reviewerId === reviewerId ? sum + t.amount : sum), 0);
}

export function pointTxnsOf(db: DBShape, reviewerId: string): PointTxn[] {
  return (db.pointTxns ?? []).filter((t) => t.reviewerId === reviewerId).sort((a, b) => b.createdAt - a.createdAt);
}

export function withdrawalsOf(db: DBShape, reviewerId: string): WithdrawalRequest[] {
  return (db.withdrawals ?? []).filter((w) => w.reviewerId === reviewerId).sort((a, b) => b.requestedAt - a.requestedAt);
}

// 원장 적재 헬퍼 — 호출자가 saveDBAsync로 영속화한다.
export function appendPointTxn(db: DBShape, txn: Omit<PointTxn, "id" | "createdAt"> & { createdAt?: number }): PointTxn {
  const full: PointTxn = { id: rid("pt"), createdAt: txn.createdAt ?? Date.now(), ...txn } as PointTxn;
  if (!db.pointTxns) db.pointTxns = [];
  db.pointTxns.push(full);
  return full;
}
