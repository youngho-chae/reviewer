import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import { appendRecentPass } from "@/lib/recent-passes-cookie";
import { validateReservation, reservationDayEnd, fmtReservationLabel } from "@/lib/reservation";

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
  const rd = String(date || "");
  const rt = String(time || "");
  const rerr = validateReservation(rd, rt, c.endAt);
  if (rerr) return NextResponse.json({ error: rerr }, { status: 400 });

  const now = Date.now();
  const prevLabel = fmtReservationLabel(pass.reservation.date, pass.reservation.time);
  pass.reservation = { date: rd, time: rt, status: "requested", requestedAt: now };
  pass.expiresAt = reservationDayEnd(rd); // 유효기간 = 새 예약일 당일 말 (KST)
  pass.expiringSoonNotified = false; // 기한이 바뀌었으므로 만료 임박 리마인드 재활성

  db.notifications.push({
    id: rid("nt"),
    userId: pass.ownerId,
    role: "owner",
    title: "예약 변경 요청",
    // [확정 정책 8·10] 익명 #last4 — 실명·등급 비노출
    body: `익명 #${pass.reviewerId.slice(-4)} 체험자가 방문 예약을 ${prevLabel} → ${fmtReservationLabel(rd, rt)}로 변경했습니다. 예약을 확인해주세요.`,
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
        requiredChannels: c.requiredChannels, pressMaterials: c.pressMaterials,
        pressKeywords: c.pressKeywords, pressMinChars: c.pressMinChars, description: c.description,
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
