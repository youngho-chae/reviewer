import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { passRefNo } from "@/lib/owner-review-status";
import { rid } from "@/lib/ids";
import { appendRecentPass } from "@/lib/recent-passes-cookie";
import {
  validateReservationForCampaign,
  reservationDayEnd,
  fmtReservationLabel,
  reservationHistory,
  reviewerCounterUsed,
} from "@/lib/reservation";

export const runtime = "nodejs";

// 예약 변경 (2026-07-16 리뷰노트 벤치마크) — 체험자가 사용 전 방문 예정 일시를 변경한다.
// 변경 시 예약은 확인 대기로 복귀하고 체험권 유효기간(예약일 당일 말)이 재계산된다.
// 취소 후 재신청(12h 쿨다운)과 달리 슬롯을 놓지 않는 일정 조율 경로 — 사장님에게 변경 알림.
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "reviewer") return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const { passId, date, time } = await req.json();
  const db = await getDBAsync();
  const pass = db.passes.find((p) => p.id === String(passId || ""));
  if (!pass || pass.reviewerId !== s.userId) {
    return NextResponse.json({ error: "체험권을 찾을 수 없습니다" }, { status: 404 });
  }
  const c = db.campaigns.find((x) => x.id === pass.campaignId);
  if (!c || c.kind !== "visit" || !c.reservationRequired || !pass.reservation) {
    return NextResponse.json({ error: "예약 방문 체험권이 아닙니다" }, { status: 400 });
  }
  if (pass.status !== "active") {
    return NextResponse.json({ error: "사용 전 체험권만 예약을 변경할 수 있어요" }, { status: 400 });
  }
  // 제안 응답 대기 중에는 변경 대신 응답(수락/재제안/거절)으로 처리 (v3 — 협상 1회 제한과 충돌 방지)
  if (pass.reservation.status === "proposed") {
    return NextResponse.json({ error: "사장님이 제안한 시간에 먼저 응답해주세요" }, { status: 400 });
  }
  // 예약 확정 후에는 변경 불가 (2026-07-22 §3-3 — 확정 전 '예약 대기' 상태에서만)
  if (pass.reservation.status === "confirmed") {
    return NextResponse.json({ error: "확정된 예약은 변경할 수 없어요 — 방문이 어려우면 취소 후 다시 신청해주세요" }, { status: 400 });
  }
  // 재제안(기타 요청) 이후에는 변경 불가 — 협상 각 1회 제한 우회 방지 (v3)
  if (reviewerCounterUsed(pass.reservation)) {
    return NextResponse.json({ error: "재요청한 일정은 변경할 수 없어요 — 사장님 응답을 기다려주세요" }, { status: 400 });
  }
  // 희망 일정 변경은 1회만 (2026-07-22 §3-3 — 무제한 변경 금지)
  if (pass.reservation.changeUsed) {
    return NextResponse.json({ error: "예약 변경은 1회만 가능해요 — 일정이 어려우면 취소 후 다시 신청해주세요" }, { status: 400 });
  }
  const rd = String(date || "");
  const rt = String(time || "");
  // 종합 검증 (§3-2) — 오픈일·요일·브레이크·차단·시간대 정원·과거·종료일 (본인 기존 슬롯은 제외)
  const rerr = validateReservationForCampaign(c, db.passes, c.id, rd, rt, { excludePassId: pass.id });
  if (rerr) return NextResponse.json({ error: rerr }, { status: 400 });

  const now = Date.now();
  const prevLabel = fmtReservationLabel(pass.reservation.date, pass.reservation.time);
  pass.reservation = {
    date: rd,
    time: rt,
    partySize: pass.reservation.partySize, // 인원수 유지 (2026-07-17)
    status: "requested",
    requestedAt: now,
    changeUsed: true, // 1회 소진 — 이후 [예약 변경하기] 비활성 (§3-3)
    // 변경 = 내 희망 일시 재요청 — 히스토리에 request로 기록 (제안/재제안 횟수와 무관)
    history: [...reservationHistory(pass.reservation), { at: now, by: "reviewer", kind: "request", date: rd, time: rt }],
  };
  pass.expiresAt = reservationDayEnd(rd); // 유효기간 = 새 예약일 당일 말 (KST)
  pass.expiringSoonNotified = false; // 기한이 바뀌었으므로 만료 임박 리마인드 재활성

  db.notifications.push({
    id: rid("nt"),
    userId: pass.ownerId,
    role: "owner",
    title: "예약 변경 요청",
    // [확정 정책 8·10] 익명 #last4 — 실명·등급 비노출
    body: `예약 ${passRefNo(pass.id)} 체험자가 방문 예약을 ${prevLabel} → ${fmtReservationLabel(rd, rt)}로 변경했습니다. 예약을 확인해주세요.`,
    createdAt: now,
    read: false,
    link: "/o/home",
  });
  await saveDBAsync();

  // 멀티 인스턴스 쿠키 스톱갭 — 변경된 예약·기한을 본인 시점에서 즉시 반영
  const store = db.stores.find((x) => x.id === pass.storeId);
  if (store) {
    await appendRecentPass({
      pass,
      campaign: {
        id: c.id, title: c.title, kind: c.kind, supportAmount: c.supportAmount,
        requiredChannels: c.requiredChannels, description: c.description,
      },
      store: {
        id: store.id, name: store.name, area: store.area, category: store.category,
        coverEmoji: store.coverEmoji, lat: store.lat, lng: store.lng,
        naverPlaceId: store.naverPlaceId, address: store.address, hours: store.hours,
        rating: store.rating, reviewCount: store.reviewCount, ownerId: store.ownerId,
      },
    });
  }

  return NextResponse.json({ ok: true, reservation: pass.reservation, expiresAt: pass.expiresAt });
}
