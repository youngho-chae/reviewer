import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import { restoreQuotaSlot } from "@/lib/pass-lifecycle";
import { reservationHistory, fmtReservationLabel } from "@/lib/reservation";

export const runtime = "nodejs";

// 운영자 수동 예약 취소 (2026-07-22 §13-1) — CS 대응용.
// 문구는 §15-3 고정("운영 정책에 따라 예약이 취소됐어요") — 체험자 12h 재신청 제한 없음.
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "admin") {
    return NextResponse.json({ error: "운영팀 로그인 필요" }, { status: 401 });
  }
  const { passId, reason } = await req.json();
  const db = await getDBAsync();
  const pass = db.passes.find((p) => p.id === String(passId || ""));
  if (!pass || !pass.reservation) return NextResponse.json({ error: "예약 체험권을 찾을 수 없습니다" }, { status: 404 });
  if (pass.status !== "active") {
    return NextResponse.json({ error: "진행 중(사용 전) 예약만 취소할 수 있습니다" }, { status: 400 });
  }

  const now = Date.now();
  const cleanReason = String(reason || "").trim().slice(0, 100);
  pass.status = "cancelled";
  pass.cancelledAt = now;
  pass.cancelledVia = "admin_cancelled";
  if (cleanReason) pass.cancelReason = cleanReason; // 내부 기록 + 체험자 서브 문구에 병기
  pass.reservation.history = [
    ...reservationHistory(pass.reservation),
    { at: now, by: "owner", kind: "decline", ...(cleanReason ? { note: `운영팀: ${cleanReason}` } : { note: "운영팀 취소" }) },
  ];
  restoreQuotaSlot(db, pass);

  const store = db.stores.find((x) => x.id === pass.storeId);
  const label = fmtReservationLabel(pass.reservation.date, pass.reservation.time);
  db.notifications.push({
    id: rid("nt"),
    userId: pass.reviewerId,
    role: "reviewer",
    title: "예약이 취소됐어요",
    body: `운영 정책에 따라 ${store?.name ?? "매장"} ${label} 예약이 취소되었습니다. 재신청 제한은 없어요 — 자세한 내용은 고객센터로 문의해주세요.`,
    createdAt: now,
    read: false,
    link: `/r/passes/${pass.id}`,
  });
  db.notifications.push({
    id: rid("nt"),
    userId: pass.ownerId,
    role: "owner",
    title: "운영팀 예약 취소",
    body: `운영 정책에 따라 ${label} 예약 1건이 취소되었습니다. 시간대 정원과 모집 슬롯은 복구되었어요.`,
    createdAt: now,
    read: false,
    link: "/o/home",
  });

  await saveDBAsync();
  return NextResponse.json({ ok: true });
}
