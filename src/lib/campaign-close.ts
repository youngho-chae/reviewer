// 캠페인 조기 종료 (2026-07-24) — 사장님 캠페인 관리·운영자 콘솔 공용 코어.
//
// 정책:
//  - 종료 = endAt을 현재 시각으로 당김 → 신규 발급 즉시 차단·탐색 비노출·홈 '종료' 필터로 이동.
//  - 이미 QR을 발급받았거나(방문형 active) 예약이 확정된(reservation confirmed) 건은
//    종료 후에도 각자의 유효 기한까지 그대로 참여할 수 있다 — 보유자에게 안내 알림 발송.
//  - 잔여 수량: 발급 시 이미 quota.used로 차감되어 있으므로 종료 시점 발급분은 "사용한 것으로
//    간주"된 상태 그대로 둔다. 체험자가 끝내 참여하지 않으면(만료·취소) 기존 복원 경로
//    (restoreQuotaSlot — 스윕·취소 API)가 해당 인원만큼 자동 복원한다.
//  - 확정 전 예약 요청(requested/proposed)은 QR이 열리기 전이므로 종료와 함께 자동 취소 —
//    cancelledVia "campaign_closed" (체험자 무패널티·슬롯 즉시 복구).
import type { DBShape, Campaign } from "./types";
import { rid } from "./ids";
import { restoreQuotaSlot } from "./pass-lifecycle";
import { reservationHistory } from "./reservation";

export interface CloseResult {
  keptQr: number; // 종료 후에도 참여 가능한 방문형 QR 발급 건
  keptConfirmed: number; // 종료 후에도 참여 가능한 확정 예약 건
  cancelledRequests: number; // 자동 취소된 확정 전 예약 요청 건
}

export function closeCampaign(db: DBShape, c: Campaign, by: "owner" | "admin", now: number = Date.now()): CloseResult {
  c.endAt = now;
  c.closedAt = now;
  c.closedBy = by;

  const result: CloseResult = { keptQr: 0, keptConfirmed: 0, cancelledRequests: 0 };
  const store = db.stores.find((s) => s.id === c.storeId);

  for (const p of db.passes) {
    if (p.campaignId !== c.id || p.status !== "active") continue;

    // 확정 전 예약 요청 — QR이 열리기 전이므로 종료와 함께 자동 취소 (무패널티·슬롯 복구)
    if (p.reservation && p.reservation.status !== "confirmed") {
      p.status = "cancelled";
      p.cancelledAt = now;
      p.cancelledVia = "campaign_closed";
      p.reservation.history = [...reservationHistory(p.reservation), { at: now, by: "owner", kind: "decline" }];
      restoreQuotaSlot(db, p);
      result.cancelledRequests += 1;
      db.notifications.push({
        id: rid("nt"),
        userId: p.reviewerId,
        role: "reviewer",
        title: "예약 요청 취소 (캠페인 종료)",
        body: `${store?.name ?? "매장"} 캠페인이 종료되어 확정 전 예약 요청이 취소됐어요. 페널티나 재신청 제한은 없어요.`,
        createdAt: now,
        read: false,
        link: "/r/passes", // 종착 상태 → 리스트 (취소 카드가 사유 문구와 함께 노출 — 링크 원칙 2026-08-30)
      });
      continue;
    }

    // 생존 건 — QR 발급(방문형)·확정 예약은 종료 후에도 유효 기한까지 참여 가능함을 안내
    if (p.reservation?.status === "confirmed") result.keptConfirmed += 1;
    else result.keptQr += 1;
    db.notifications.push({
      id: rid("nt"),
      userId: p.reviewerId,
      role: "reviewer",
      title: "캠페인 종료 안내",
      body: `${store?.name ?? "매장"} 캠페인이 종료되었지만, 이미 ${
        p.reservation?.status === "confirmed" ? "확정된 예약" : "발급받은 체험권"
      }은 유효 기한까지 그대로 참여할 수 있어요.`,
      createdAt: now,
      read: false,
      link: `/r/passes/${p.id}`,
    });
  }

  return result;
}
