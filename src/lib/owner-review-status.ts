// 사장님 리뷰 현황 상태 정본 (2026-07-31 개선안 — "사장님 리뷰 현황 상태 구분 및 체험자 식별정보 미노출").
//
// [상태 정의 §4-1] 집계 모수 = **사용 처리가 완료된 체험권**(이용 완료) — 캠페인 모집 인원이나
// 아직 매장을 이용하지 않은 발급분은 리뷰 작성 대상이 아니므로 제외한다.
//  - 작성 대기(pending)  : used — 이용 완료했으나 리뷰 미제출. **기한 초과도 작성 대기에 포함**하되
//    "기한 초과" 배지로 구분 (캠페인이 종료돼도 개별 기한이 남아 있으면 작성 대기 유지)
//  - 검수 중(reviewing)  : review_submitted — 제출 후 운영팀 검수 대기
//  - 완료(done)          : completed — 운영팀 검수 승인
//  - 재작성 요청(resubmit): rejected — 반려 후 체험자 수정·재제출 대기 (목록 내 별도 상태)
// 사장님 메인의 "검수 중인 리뷰"에는 reviewing만 포함한다 (§4-2).
//
// [식별정보 미노출 §4-5] 사장님 화면(예약·리뷰·이용 내역)에서는 실명·닉네임·연락처는 물론
// **익명 처리된 체험자 ID(#last4)도 노출하지 않는다** — 개별 건 구분은 시스템 발급 거래 단위
// 번호(예약번호/체험권 번호 = passRefNo)와 이용 일시·매장·상태로 한다. 체험자-예약·리뷰의
// 연결 관계는 내부(어드민)에서만 유지한다. 용어는 "후기" 대신 **"리뷰"**로 통일한다 (§4-6).

import type { Pass } from "./types";
import { reviewDeadline } from "./pass-lifecycle";

export type OwnerReviewState = "pending" | "reviewing" | "done" | "resubmit";

export const OWNER_REVIEW_LABEL: Record<OwnerReviewState, string> = {
  pending: "작성 대기",
  reviewing: "검수 중",
  done: "완료",
  resubmit: "재작성 요청",
};

export function ownerReviewState(p: Pick<Pass, "status">): OwnerReviewState | null {
  switch (p.status) {
    case "used":
      return "pending";
    case "review_submitted":
      return "reviewing";
    case "completed":
      return "done";
    case "rejected":
      return "resubmit";
    default:
      return null; // 미사용 발급분·취소·만료 등 — 리뷰 현황 집계 제외
  }
}

// 작성 대기 중 리뷰 작성 기한 경과 여부 — 작성 대기 수에 포함하되 배지로 표시 (§4-1)
export function isReviewOverdue(p: Pass, now: number = Date.now()): boolean {
  if (p.status !== "used") return false;
  if (p.overdueHandled) return true;
  const deadline = reviewDeadline(p);
  return deadline != null && now > deadline;
}

export interface OwnerReviewSummary {
  usedTotal: number; // 이용 완료 (작성 대기+검수 중+완료+재작성 요청)
  pending: number;
  reviewing: number;
  done: number;
  resubmit: number;
}

// 화면 공통 집계 — 메인·리뷰 관리·캠페인 상세 리뷰 탭이 같은 값을 노출해야 한다 (§4-7)
export function ownerReviewSummary(passes: Array<Pick<Pass, "status">>): OwnerReviewSummary {
  const s: OwnerReviewSummary = { usedTotal: 0, pending: 0, reviewing: 0, done: 0, resubmit: 0 };
  for (const p of passes) {
    const st = ownerReviewState(p);
    if (!st) continue;
    s.usedTotal += 1;
    s[st] += 1;
  }
  return s;
}

// 거래 단위 표기 번호 (§4-5) — 예약번호/체험권 번호 겸용 (예약·체험권은 패스 1:1).
// 파생 표기 전용 — QR 사용 처리 코드(Pass.code)와 무관해 노출해도 부작용이 없다.
export function passRefNo(passId: string): string {
  return `NO-${passId.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase()}`;
}
