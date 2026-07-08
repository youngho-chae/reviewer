// ─────────────────────────────────────────────────────────────
// 캠페인 노출 정책 (2026-07-07 회의 확정)
//
// "발급 소진"과 "실제 체험 완료"를 구분한다:
//  - open        : 기간 내 + 잔여 발급분 있음 → 정상 노출·발급 가능
//  - issued_out  : 기간 내 + 발급분은 소진됐지만 아직 사용되지 않은(살아있는)
//                  체험권이 남아 있음 → 계속 노출하되 발급 불가 표시.
//                  (만료·취소로 슬롯이 복구되면 자동으로 open 복귀)
//  - closed      : 기간 종료, 또는 발급 소진 + 살아있는 체험권 0 → 종료·비노출
//
// 대기·웨이팅 기능은 MVP에 포함하지 않는다 (추후 검토).
// ─────────────────────────────────────────────────────────────

import type { Campaign, Pass } from "./types";

export type CampaignExposure = "open" | "issued_out" | "closed";

export function campaignRemain(c: Campaign): number {
  const totalQ = c.quota.S + c.quota.A + c.quota.B + c.quota.C;
  const usedQ = c.used.S + c.used.A + c.used.B + c.used.C;
  return totalQ - usedQ;
}

export function campaignExposure(c: Campaign, passes: Pass[], now: number = Date.now()): CampaignExposure {
  if (c.endAt <= now) return "closed";
  if (campaignRemain(c) > 0) return "open";
  // 발급 소진 — 살아있는(사용 전) 체험권이 남아 있으면 계속 노출
  const hasLiving = passes.some((p) => p.campaignId === c.id && p.status === "active" && p.expiresAt > now);
  return hasLiving ? "issued_out" : "closed";
}

/** 목록 노출 여부 — open / issued_out만 노출 */
export function isCampaignVisible(c: Campaign, passes: Pass[], now: number = Date.now()): boolean {
  return campaignExposure(c, passes, now) !== "closed";
}
