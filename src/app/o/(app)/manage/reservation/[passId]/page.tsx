import { notFound } from "next/navigation";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import {
  fmtReservationLabel,
  reservationHistoryCards,
  reviewerCounterUsed,
  ownerProposalUsed,
  campaignDateOptions,
  campaignSlotStatuses,
  campaignTimeSlots,
  reservationTakenCount,
  scheduleOf,
} from "@/lib/reservation";
import ReservationDetail, { type ReservationDetailData } from "./ReservationDetail";
import { passRefNo } from "@/lib/owner-review-status";

export const dynamic = "force-dynamic";

// 예약 정보 상세 (2026-07-28 시안 — [관리]-[예약관리] 카드의 [예약 정보] = 다음 depth).
// 상태 칩 → 캠페인명 → 예약번호(§4-5 식별정보 비노출)·신청 일정·인원 → (요청/재제안) [예약 확정] +
// [거절]·[다른 일정 제안(캘린더·오전/오후 시트)] → 안내 → 예약 내역 타임라인.
export default async function OwnerReservationDetail({ params }: { params: Promise<{ passId: string }> }) {
  const { passId } = await params;
  const me = await getCurrentOwner();
  const db = await getDBAsync();
  const p = db.passes.find((x) => x.id === passId && x.ownerId === me.id);
  if (!p || !p.reservation) notFound();
  const r = p.reservation;
  const c = db.campaigns.find((x) => x.id === p.campaignId);
  const store = db.stores.find((s) => s.id === c?.storeId);

  const state: ReservationDetailData["state"] =
    p.status === "cancelled"
      ? "cancelled"
      : r.status === "confirmed"
        ? "confirmed"
        : r.status === "proposed"
          ? "proposed"
          : reviewerCounterUsed(r)
            ? "counter"
            : "requested";

  // 제안 시트 선택지 — 캠페인 스케줄 기준 날짜(14일 윈도우·휴무·차단) + 날짜별 시간 슬롯 상태
  const dateOptions = c ? campaignDateOptions(c) : [];
  const slotsByDate: Record<string, Array<{ time: string; label: string; disabled: boolean }>> = {};
  if (c) {
    const schedule = scheduleOf(c);
    for (const d of dateOptions) {
      if (d.disabled) continue;
      const takenByTime: Record<string, number> = {};
      for (const t of campaignTimeSlots(schedule)) {
        takenByTime[t] = reservationTakenCount(db.passes, c.id, d.date, t, p.id);
      }
      slotsByDate[d.date] = campaignSlotStatuses(c, d.date, takenByTime).map((s) => ({
        time: s.time,
        label: s.label,
        disabled: s.disabled,
      }));
    }
  }

  const data: ReservationDetailData = {
    passId: p.id,
    state,
    campaignTitle: c?.title ?? "캠페인",
    storeName: store?.name ?? "",
    refNo: passRefNo(p.id), // [§4-5] 익명 ID 대신 예약번호
    label: fmtReservationLabel(r.date, r.time),
    partySize: r.partySize,
    proposalUsed: ownerProposalUsed(r),
    cards: reservationHistoryCards(r).map((card) => ({
      actor: card.actor,
      title: card.title,
      rows: card.rows,
    })),
    dateOptions: dateOptions.map((d) => ({ date: d.date, label: d.label, disabled: d.disabled })),
    slotsByDate,
  };
  // 취소 건 — 마지막 카드가 이미 취소 문장을 담고 있어 별도 문구는 두지 않는다 (§15.4는 체험자 화면용)

  return <ReservationDetail data={data} />;
}
