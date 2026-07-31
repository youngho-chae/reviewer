import type { Campaign, Pass, Store } from "@/lib/types";
import { fmtReservationLabel, reservationEpoch, reservationHistoryLines, reviewerCounterUsed } from "@/lib/reservation";
import { passRefNo } from "@/lib/owner-review-status";
import type { ManagedReservation } from "./ReservationManager";

// 예약관리 카드 데이터 빌더 (2026-07-28) — [관리]-[예약관리]와 캠페인 관리의
// [예약관리] 탭이 공유한다. 예약 정보가 있는 패스(active + 취소)를 상태별 카드로 매핑.
export function buildManagedReservations(
  passes: Pass[],
  campaigns: Campaign[],
  stores: Store[],
): ManagedReservation[] {
  return passes
    .filter((p) => p.reservation && (p.status === "active" || p.status === "cancelled"))
    .map((p) => {
      const r = p.reservation!;
      const c = campaigns.find((x) => x.id === p.campaignId);
      const store = stores.find((s) => s.id === c?.storeId);
      // 원 요청 일시 (재제안 카드의 흐림 표기용) — 히스토리 첫 줄 = 최초 신청
      const firstLine = reservationHistoryLines(r)[0];
      const state: ManagedReservation["state"] =
        p.status === "cancelled"
          ? "cancelled"
          : r.status === "confirmed"
            ? "confirmed"
            : r.status === "proposed"
              ? "proposed"
              : reviewerCounterUsed(r)
                ? "counter"
                : "requested";
      return {
        passId: p.id,
        storeId: store?.id ?? "",
        storeName: store?.name ?? "매장",
        campaignTitle: c?.title ?? "캠페인",
        // [2026-07-31 §4-5] 체험자 식별정보(익명 ID 포함) 비노출 — 예약번호(거래 단위)로 구분
        refNo: passRefNo(p.id),
        label: fmtReservationLabel(r.date, r.time),
        ...(r.partySize ? { partySize: r.partySize } : {}),
        state,
        ...(state === "counter" && firstLine?.timeLabel ? { originalLabel: firstLine.timeLabel } : {}),
        epoch: reservationEpoch(r.date, r.time),
      };
    })
    .sort((a, b) => {
      const pr = { requested: 0, counter: 0, proposed: 1, confirmed: 2, cancelled: 3 } as const;
      return pr[a.state] - pr[b.state] || a.epoch - b.epoch;
    });
}
