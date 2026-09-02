import type { Pass, PassStatus } from "./types";
import { REVIEW_DEADLINE_MS, reviewDeadline } from "./pass-lifecycle";

// 파생 표시 상태 (2026-07-10 확정).
//
// PassStatus(7종 실상태)는 확장하지 않는다 — 상태 머신·스윕·API 분기가 전부 실상태에
// 걸려 있고, "기한 초과"는 시간 경과만으로 결정되는 **표시 계층**의 개념이기 때문.
//  - overdue          : used인데 리뷰 제출 기한이 지남 → 제출 CTA 제거. 기한은 reviewDeadline
//                       정본(예약형 = 확정 방문일 말 +7일, 그 외 이용 후 7일) — 서버 차단·스윕
//                       R-16과 동일 기준 (2026-09-02 정합화 — 구 usedAt+7일 자체 계산 폐기)
//  - resubmit_expired : rejected인데 재제출 기한(반려 후 7일)이 지났거나 1회 재제출을 소진
// 서버는 이미 기한/횟수를 각각 차단하므로(/api/passes/review) 여기 판정은 UI 전용이다.
export type PassDisplayStatus = PassStatus | "overdue" | "resubmit_expired";

export function passDisplayStatus(
  p: Pick<Pass, "status" | "usedAt" | "reservation" | "overdueHandled" | "rejectedAt" | "resubmitCount">,
  now: number = Date.now(),
): PassDisplayStatus {
  if (p.status === "used") {
    const deadline = reviewDeadline(p);
    if (p.overdueHandled || (deadline != null && now > deadline)) return "overdue";
  }
  if (p.status === "rejected") {
    const deadline = p.rejectedAt ? p.rejectedAt + REVIEW_DEADLINE_MS : null;
    if ((p.resubmitCount ?? 0) >= 1 || (deadline != null && now > deadline)) return "resubmit_expired";
  }
  return p.status;
}

// 목록 카드 상태 뱃지 — 라벨 + *Soft 토큰 배경 문법 (v2).
// PassesView(방문형·배송형)·상세가 이 단일 정의를 공유한다.
export const DISPLAY_BADGE: Record<PassDisplayStatus, { label: string; cls: string }> = {
  active: { label: "사용가능", cls: "bg-successSoft text-successStrong" },
  cancelled: { label: "취소", cls: "bg-sunken text-mutedSoft" },
  expired: { label: "만료", cls: "bg-sunken text-mutedSoft" },
  used: { label: "작성 대기 중", cls: "bg-brandSoft text-brand" },
  overdue: { label: "제출 기한 초과", cls: "bg-sunken text-mutedSoft" },
  review_submitted: { label: "검수중", cls: "bg-sunken text-muted" },
  completed: { label: "검수 완료", cls: "bg-sunken text-muted" },
  rejected: { label: "반려", cls: "bg-errorSoft text-error" },
  resubmit_expired: { label: "재제출 기한 초과", cls: "bg-sunken text-mutedSoft" },
};
