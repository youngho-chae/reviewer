// 체험권 라이프사이클 스윕 — DB 로드 시마다 실행되는 지연(lazy) 배치.
// 별도 크론 없이도 다음 세 가지 정책을 강제한다:
//   1) 만료 확정: active + 기한 경과 → expired 전이 + 모집 슬롯 복구 + 양측 알림 (노쇼 카운트)
//   2) 리뷰 기한(이용 후 7일) 초과: used 상태 방치 → 노쇼 카운트 + 양측 알림 (1회)
//   3) 만료 임박 알림: 사용 기한 6시간 전 체험자에게 리마인드 (1회)
//   4) 리뷰 마감 임박 알림: 제출 기한 24시간 전 체험자에게 리마인드 (1회)
// 모든 처리는 멱등(플래그/상태 가드)이며, 변경 여부를 반환해 호출자가 영속화를 결정한다.

import { DBShape, Pass } from "./types";
import { rid } from "./ids";
import {
  reservationEpoch,
  reservationHistory,
  fmtReservationLabel,
  fmtTime12,
  kstTodayStr,
  OWNER_RESPONSE_REMIND_MS,
} from "./reservation";

// 체험권 유효기간(발급 후) — 개별 연장·복구 없음 (2026-07-07 회의 확정)
export const PASS_VALIDITY_MS = 72 * 60 * 60 * 1000;
// 리뷰 제출 기한 — 이용(사용 처리) 후 7일
export const REVIEW_DEADLINE_MS = 7 * 24 * 60 * 60 * 1000;

// 리뷰 제출 마감 시각 (2026-07-22 §8-2) — 예약형은 QR 사용 시점이 아니라 **확정 방문일** 기준
// (방문일 말 KST + 7일 — 일정 변경 시 자동 재계산). 그 외에는 사용 처리 시점 + 7일.
// 사용 전(usedAt 없음)이면 null.
export function reviewDeadline(p: Pass): number | null {
  if (!p.usedAt) return null;
  if (p.reservation?.date) {
    return Date.parse(`${p.reservation.date}T23:59:59+09:00`) + REVIEW_DEADLINE_MS;
  }
  return p.usedAt + REVIEW_DEADLINE_MS;
}
// 취소 후 동일 캠페인 재신청 제한 — 발급 API(/api/passes)와 매장 상세 CTA가 공유
export const CANCEL_REAPPLY_COOLDOWN_MS = 12 * 60 * 60 * 1000;
// 배송형 발송 지연 안내 기준 — 신청 후 이 시간 경과 미발송이면 체험자·사장님 화면에 지연 표시
// (2026-07-16 리뷰노트 벤치마크 — 표시 전용, 상태 전이 없음. 리뷰 기한은 발송 후 7일 롤링이라 불이익 없음)
export const SHIP_DELAY_NOTICE_MS = 3 * 24 * 60 * 60 * 1000;
const EXPIRY_REMINDER_MS = 6 * 60 * 60 * 1000;
const REVIEW_DUE_REMINDER_MS = 24 * 60 * 60 * 1000;

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
    // 0) 예약 미확정 자동 취소 (§13 확정 필요 B 기본안) — 방문 희망 시각까지 사장님이 확정하지
    //    않으면(확인 대기·제안 응답 대기 모두) 자동 취소한다. 매장 사정으로 처리 —
    //    체험자 패널티·노쇼 카운트·12h 재신청 제한 없음, 슬롯·정원 즉시 복구.
    if (
      p.status === "active" &&
      p.reservation &&
      p.reservation.status !== "confirmed" &&
      now > reservationEpoch(p.reservation.date, p.reservation.time)
    ) {
      p.status = "cancelled";
      p.cancelledAt = now;
      p.cancelledVia = "owner_declined";
      p.reservation.history = [...reservationHistory(p.reservation), { at: now, by: "owner", kind: "decline" }];
      restoreQuotaSlot(db, p);
      const store0 = db.stores.find((s) => s.id === p.storeId);
      db.notifications.push({
        id: rid("nt"),
        userId: p.reviewerId,
        role: "reviewer",
        title: "예약이 확정되지 않아 취소됐어요",
        body: `${store0?.name ?? "매장"} ${fmtReservationLabel(p.reservation.date, p.reservation.time)} 예약이 방문 시간까지 확정되지 않아 자동 취소되었습니다. 패널티나 재신청 제한은 없어요 — 언제든 다시 신청할 수 있어요.`,
        createdAt: now,
        read: false,
        link: `/r/passes/${p.id}`,
      });
      db.notifications.push({
        id: rid("nt"),
        userId: p.ownerId,
        role: "owner",
        title: "미응답 예약 자동 취소",
        body: `확정하지 않은 예약 요청(${fmtReservationLabel(p.reservation.date, p.reservation.time)})이 방문 시간 경과로 자동 취소되었습니다. 모집 슬롯은 복구되었어요 — 다음 요청은 24시간 안에 확인해주세요.`,
        createdAt: now,
        read: false,
        link: "/o/home",
      });
      changed = true;
      continue;
    }

    // 0-1) 예약 요청 24시간 무응답 — 사장님 리마인드 (§13-B, 1회)
    if (
      p.status === "active" &&
      p.reservation &&
      p.reservation.status === "requested" &&
      !p.ownerRemindNotified &&
      now - p.reservation.requestedAt > OWNER_RESPONSE_REMIND_MS
    ) {
      p.ownerRemindNotified = true;
      db.notifications.push({
        id: rid("nt"),
        userId: p.ownerId,
        role: "owner",
        title: "예약 요청이 기다리고 있어요 ⏰",
        body: `익명 #${p.reviewerId.slice(-4)} 체험자의 ${fmtReservationLabel(p.reservation.date, p.reservation.time)} 방문 예약 요청에 아직 응답하지 않았어요. 방문 시간까지 확정되지 않으면 자동 취소됩니다.`,
        createdAt: now,
        read: false,
        link: "/o/home",
      });
      changed = true;
    }

    // 0-2) 확정 예약 방문 전날 리마인드 — 체험자 (§11-3, 1회)
    if (
      p.status === "active" &&
      p.reservation &&
      p.reservation.status === "confirmed" &&
      !p.visitRemindNotified &&
      kstTodayStr(now + 24 * 60 * 60 * 1000) === p.reservation.date
    ) {
      p.visitRemindNotified = true;
      const store1 = db.stores.find((s) => s.id === p.storeId);
      db.notifications.push({
        id: rid("nt"),
        userId: p.reviewerId,
        role: "reviewer",
        title: "내일 방문 예약이 있어요 📅",
        body: `${store1?.name ?? "매장"} 방문 예약이 내일 ${fmtTime12(p.reservation.time)}이에요. 방문해서 체험권 QR을 제시해주세요 · 방문이 어려우면 오늘까지 취소할 수 있어요.`,
        createdAt: now,
        read: false,
        link: `/r/passes/${p.id}`,
      });
      changed = true;
    }

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
        // 예약형 미방문 만료는 문구로만 구분 (§10-4 — 별도 노쇼 신고·추가 패널티 없음, §13-D 기본안).
        body: p.reservation
          ? `${store?.name ?? "매장"} 예약 방문일이 지나 체험권이 만료되었습니다. 모집 슬롯은 다른 체험자에게 돌아갑니다.`
          : `${store?.name ?? "매장"} 체험권이 사용되지 않아 만료되었습니다. 모집 슬롯은 다른 체험자에게 돌아갑니다.`,
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

    // 2) 리뷰 기한 초과 미제출 — 노쇼 1회 반영 + 양측 알림
    //    (기한 = reviewDeadline: 예약형은 확정 방문일 기준, 그 외 이용 후 7일 — §8-2)
    if (p.status === "used" && p.usedAt && now > (reviewDeadline(p) as number) && !p.overdueHandled) {
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

    // 3-0) 예약 확정 체험권 만료 24시간 전 리마인드 (§11-3 — QR은 방문일 다음날까지 유효)
    if (
      p.status === "active" &&
      p.reservation &&
      p.reservation.status === "confirmed" &&
      !p.expiringSoonNotified &&
      p.expiresAt - now > 0 &&
      p.expiresAt - now <= 24 * 60 * 60 * 1000
    ) {
      p.expiringSoonNotified = true;
      const store2 = db.stores.find((s) => s.id === p.storeId);
      db.notifications.push({
        id: rid("nt"),
        userId: p.reviewerId,
        role: "reviewer",
        title: "체험권 만료 24시간 전 ⏰",
        body: `${store2?.name ?? "매장"} 체험권(예약 ${fmtReservationLabel(p.reservation.date, p.reservation.time)})이 24시간 내에 만료돼요. 아직 방문 전이라면 서둘러 사용해주세요.`,
        createdAt: now,
        read: false,
        link: `/r/passes/${p.id}`,
      });
      changed = true;
      continue;
    }

    // 3) 만료 임박(6시간 전) 리마인드 — 방문형(72h 기한)만
    if (
      p.status === "active" &&
      !p.reservation &&
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
      continue;
    }

    // 4) 리뷰 마감 임박(24시간 전) 리마인드 — used + 미제출
    if (p.status === "used" && p.usedAt && !p.reviewDueSoonNotified && !p.overdueHandled) {
      const left = (reviewDeadline(p) as number) - now;
      if (left > 0 && left <= REVIEW_DUE_REMINDER_MS) {
        p.reviewDueSoonNotified = true;
        const store = db.stores.find((s) => s.id === p.storeId);
        db.notifications.push({
          id: rid("nt"),
          userId: p.reviewerId,
          role: "reviewer",
          title: "리뷰 마감 24시간 전 ⏰",
          body: `${store?.name ?? "매장"} 리뷰 제출 기한이 24시간 이내로 다가왔어요. 기한이 지나면 제출할 수 없고 등급 재평가에 감점으로 반영됩니다.`,
          createdAt: now,
          read: false,
          link: `/r/passes/${p.id}`,
        });
        changed = true;
      }
    }
  }

  return changed;
}
