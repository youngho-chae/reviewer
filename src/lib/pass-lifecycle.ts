// 체험권 라이프사이클 스윕 — DB 로드 시마다 실행되는 지연(lazy) 배치.
// 별도 크론 없이도 다음 세 가지 정책을 강제한다:
//   1) 만료 확정: active + 기한 경과 → expired 전이 + 모집 슬롯 복구 + 양측 알림 (노쇼 카운트)
//   2) 리뷰 기한(이용 후 7일) 초과: used 상태 방치 → 노쇼 카운트 + 양측 알림 (1회)
//   3) 만료 임박 알림: 사용 기한 6시간 전 체험자에게 리마인드 (1회)
// 모든 처리는 멱등(플래그/상태 가드)이며, 변경 여부를 반환해 호출자가 영속화를 결정한다.

import { DBShape, Pass } from "./types";
import { rid } from "./ids";

// 체험권 유효기간(발급 후) — 개별 연장·복구 없음 (2026-07-07 회의 확정)
export const PASS_VALIDITY_MS = 72 * 60 * 60 * 1000;
// 리뷰 제출 기한 — 이용(사용 처리) 후 7일
export const REVIEW_DEADLINE_MS = 7 * 24 * 60 * 60 * 1000;
const EXPIRY_REMINDER_MS = 6 * 60 * 60 * 1000;

// 발급 시 차감했던 등급 슬롯을 복구한다 (만료/취소 공용).
// consumedSlot이 없는 구버전 패스는 체험자 등급 슬롯으로 폴백 (N등급은 C 슬롯).
export function restoreQuotaSlot(db: DBShape, pass: Pass): void {
  const c = db.campaigns.find((x) => x.id === pass.campaignId);
  if (!c) return;
  const slot = pass.consumedSlot ?? (pass.reviewerGrade === "N" ? "C" : pass.reviewerGrade);
  if (slot === "S" || slot === "A" || slot === "B" || slot === "C") {
    if (c.used[slot] > 0) c.used[slot] -= 1;
  }
}

export function sweepPassLifecycle(db: DBShape, now: number = Date.now()): boolean {
  let changed = false;

  for (const p of db.passes) {
    // 1) 만료 확정 + 슬롯 복구
    if (p.status === "active" && now > p.expiresAt) {
      p.status = "expired";
      restoreQuotaSlot(db, p);
      const rv = db.reviewers.find((r) => r.id === p.reviewerId);
      if (rv) rv.noShowCount += 1;
      const store = db.stores.find((s) => s.id === p.storeId);
      db.notifications.push({
        id: rid("nt"),
        userId: p.reviewerId,
        role: "reviewer",
        title: "체험권 만료",
        body: `${store?.name ?? "매장"} 체험권이 사용되지 않아 만료되었습니다. 모집 슬롯은 다른 체험자에게 돌아갑니다.`,
        createdAt: now,
        read: false,
        link: `/r/passes/${p.id}`,
      });
      db.notifications.push({
        id: rid("nt"),
        userId: p.ownerId,
        role: "owner",
        title: "체험권 만료 (미방문)",
        body: `발급된 체험권 1매가 미사용 만료되어 모집 슬롯이 복구되었습니다.`,
        createdAt: now,
        read: false,
        link: "/o/home",
      });
      changed = true;
      continue;
    }

    // 2) 리뷰 기한(이용 후 7일) 초과 미제출 — 노쇼 1회 반영 + 양측 알림
    if (p.status === "used" && p.usedAt && now > p.usedAt + REVIEW_DEADLINE_MS && !p.overdueHandled) {
      p.overdueHandled = true;
      const rv = db.reviewers.find((r) => r.id === p.reviewerId);
      if (rv) rv.noShowCount += 1;
      const store = db.stores.find((s) => s.id === p.storeId);
      db.notifications.push({
        id: rid("nt"),
        userId: p.reviewerId,
        role: "reviewer",
        title: "리뷰 기한 초과",
        body: `${store?.name ?? "매장"} 리뷰 제출 기한(이용 후 7일)이 지났습니다. 반복 시 월간 등급 재평가에 감점으로 반영됩니다.`,
        createdAt: now,
        read: false,
        link: `/r/passes/${p.id}`,
      });
      db.notifications.push({
        id: rid("nt"),
        userId: p.ownerId,
        role: "owner",
        title: "리뷰 미제출 안내",
        body: `체험 완료 후 7일 내 리뷰가 제출되지 않은 체험권이 있습니다. 운영팀이 이력을 관리합니다.`,
        createdAt: now,
        read: false,
        link: "/o/reviews",
      });
      changed = true;
      continue;
    }

    // 3) 만료 임박(6시간 전) 리마인드 — 방문형(72h 기한)만
    if (
      p.status === "active" &&
      !p.expiringSoonNotified &&
      p.expiresAt - now > 0 &&
      p.expiresAt - now <= EXPIRY_REMINDER_MS &&
      p.expiresAt - p.issuedAt <= PASS_VALIDITY_MS + 60 * 60 * 1000 // 기자단(캠페인 종료 기한) 제외
    ) {
      p.expiringSoonNotified = true;
      const store = db.stores.find((s) => s.id === p.storeId);
      db.notifications.push({
        id: rid("nt"),
        userId: p.reviewerId,
        role: "reviewer",
        title: "체험권 만료 임박 ⏰",
        body: `${store?.name ?? "매장"} 체험권이 6시간 내에 만료됩니다. 방문이 어려우면 취소해 주세요.`,
        createdAt: now,
        read: false,
        link: `/r/passes/${p.id}`,
      });
      changed = true;
    }
  }

  return changed;
}
