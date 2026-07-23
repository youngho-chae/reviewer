import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import { restoreQuotaSlot } from "@/lib/pass-lifecycle";
import {
  validateReservation,
  validateReservationForCampaign,
  reservationDayEnd,
  reservationEpoch,
  fmtReservationLabel,
  reservationHistory,
  reviewerCounterUsed,
  isDateBlocked,
  isSlotBlocked,
  reservationTakenCount,
  slotCapacityOf,
} from "@/lib/reservation";

export const runtime = "nodejs";

// 사장님 시간 제안에 대한 체험자 응답 (2026-07-16 예약형 v2).
//  - accept : 제안 슬롯 중 하나 수락 → 예약 확정 + 체험권(QR) 활성화
//  - counter: 기타 일시 직접 입력 → 확인 대기로 재요청 (QR 계속 미노출)
//  - decline: 거절 → 이용 취소. **패널티·12h 재신청 제한 없음** (일정 불일치일 뿐 — cancelledVia 기록)
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "reviewer") return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const { passId, action, date, time } = await req.json();
  const db = await getDBAsync();
  const pass = db.passes.find((p) => p.id === String(passId || ""));
  if (!pass || pass.reviewerId !== s.userId) {
    return NextResponse.json({ error: "체험권을 찾을 수 없습니다" }, { status: 404 });
  }
  if (pass.status !== "active" || !pass.reservation || pass.reservation.status !== "proposed") {
    return NextResponse.json({ error: "응답할 시간 제안이 없습니다" }, { status: 400 });
  }
  const c = db.campaigns.find((x) => x.id === pass.campaignId);
  const store = db.stores.find((x) => x.id === pass.storeId);
  const now = Date.now();
  const masked = `#${pass.reviewerId.slice(-4)}`; // [확정 정책 8] 익명 표기

  if (action === "accept") {
    const rd = String(date || "");
    const rt = String(time || "");
    const hit = (pass.reservation.proposal?.slots ?? []).some((sl) => sl.date === rd && sl.time === rt);
    if (!hit) return NextResponse.json({ error: "제안된 시간 중에서 선택해주세요" }, { status: 400 });
    if (reservationEpoch(rd, rt) <= now) {
      return NextResponse.json({ error: "지난 시간이에요 — 기타 입력으로 새 시간을 요청해주세요" }, { status: 400 });
    }
    // 수락 시점 차단·정원 재확인 — 제안 이후 사장님 차단이나 다른 예약으로 찼을 수 있다 (§13-A).
    // (요일·브레이크·14일 윈도우는 제안 시점에 이미 필터됨 — 여기선 시점 의존 조건만)
    if (c) {
      if (isDateBlocked(c.reservationBlocks, rd, now) || isSlotBlocked(c.reservationBlocks, rd, rt)) {
        return NextResponse.json({ error: "매장 사정으로 마감된 시간이에요 — 기타 입력으로 새 시간을 요청해주세요" }, { status: 400 });
      }
      if (reservationTakenCount(db.passes, c.id, rd, rt, pass.id) >= slotCapacityOf(c)) {
        return NextResponse.json({ error: "해당 시간대 예약이 마감되었어요 — 기타 입력으로 새 시간을 요청해주세요" }, { status: 400 });
      }
    }
    pass.reservation = {
      date: rd,
      time: rt,
      partySize: pass.reservation.partySize, // 인원수 유지 (2026-07-17)
      changeUsed: pass.reservation.changeUsed,
      status: "confirmed", // 수락 = 즉시 확정 — 체험권(QR) 활성화
      requestedAt: pass.reservation.requestedAt,
      confirmedAt: now,
      history: [...reservationHistory(pass.reservation), { at: now, by: "reviewer", kind: "accept", date: rd, time: rt }],
    };
    pass.expiresAt = reservationDayEnd(rd);
    pass.expiringSoonNotified = false;
    db.notifications.push({
      id: rid("nt"),
      userId: pass.ownerId,
      role: "owner",
      title: "제안한 예약 시간 수락 📅",
      body: `익명 ${masked} 체험자가 ${fmtReservationLabel(rd, rt)} 방문을 수락했습니다. 예약이 확정되었어요.`,
      createdAt: now,
      read: false,
      link: "/o/home",
    });
    await saveDBAsync();
    return NextResponse.json({ ok: true, status: "confirmed" });
  }

  if (action === "counter") {
    // 재제안은 1회만 (2026-07-16 v3) — 소진 후에는 수락 또는 거절만 가능
    if (reviewerCounterUsed(pass.reservation)) {
      return NextResponse.json(
        { error: "다른 시간 요청은 1회만 보낼 수 있어요 — 제안된 시간을 수락하거나 취소해주세요" },
        { status: 400 },
      );
    }
    const rd = String(date || "");
    const rt = String(time || "");
    // 재제안도 스케줄·차단·정원 검증을 통과해야 한다 (§3-2 — 본인 기존 슬롯은 제외)
    const rerr = c
      ? validateReservationForCampaign(c, db.passes, c.id, rd, rt, { excludePassId: pass.id })
      : validateReservation(rd, rt, pass.expiresAt);
    if (rerr) return NextResponse.json({ error: rerr }, { status: 400 });
    const prevLabel = fmtReservationLabel(pass.reservation.date, pass.reservation.time);
    pass.reservation = {
      date: rd,
      time: rt,
      partySize: pass.reservation.partySize, // 인원수 유지 (2026-07-17)
      changeUsed: pass.reservation.changeUsed, // 변경 1회 소진 여부 유지 (§3-3 — counter와 별개 카운트)
      status: "requested",
      requestedAt: now,
      history: [...reservationHistory(pass.reservation), { at: now, by: "reviewer", kind: "counter", date: rd, time: rt }],
    };
    pass.expiresAt = reservationDayEnd(rd);
    pass.expiringSoonNotified = false;
    db.notifications.push({
      id: rid("nt"),
      userId: pass.ownerId,
      role: "owner",
      title: "체험자 재제안 — 새 방문 시간 요청",
      body: `익명 ${masked} 체험자가 제안 대신 ${fmtReservationLabel(rd, rt)} 방문을 요청했습니다 (기존 희망 ${prevLabel}). 예약을 확인하거나 거절할 수 있어요.`,
      createdAt: now,
      read: false,
      link: "/o/home",
    });
    await saveDBAsync();
    return NextResponse.json({ ok: true, status: "requested" });
  }

  if (action === "decline") {
    // 거절 = 이용 취소 — 슬롯 복구. 패널티 없음 + 12h 재신청 제한 미적용 (cancelledVia)
    pass.status = "cancelled";
    pass.cancelledAt = now;
    pass.cancelledVia = "proposal_declined";
    pass.reservation.history = [...reservationHistory(pass.reservation), { at: now, by: "reviewer", kind: "decline" }];
    restoreQuotaSlot(db, pass);
    db.notifications.push({
      id: rid("nt"),
      userId: pass.ownerId,
      role: "owner",
      title: "예약 제안 거절 (신청 취소)",
      body: `익명 ${masked} 체험자가 제안한 시간이 맞지 않아 신청을 취소했습니다. 모집 슬롯이 복구되었어요.`,
      createdAt: now,
      read: false,
      link: "/o/home",
    });
    await saveDBAsync();
    return NextResponse.json({ ok: true, status: "cancelled" });
  }

  return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
}
