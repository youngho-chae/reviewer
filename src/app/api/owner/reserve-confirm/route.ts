import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import { fmtReservationLabel } from "@/lib/reservation";

export const runtime = "nodejs";

// 예약 확인 (2026-07-16 리뷰노트 벤치마크) — 사장님이 예약 방문 신청을 확인·확정한다.
// [P1] 예약은 참여 승인/선정이 아니라 일정 조율 — 거절 기능은 두지 않는다.
// 일시가 곤란하면 매장이 연락해 조율하고 체험자가 예약을 변경한다 (/api/passes/reservation).
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const { passId } = await req.json();
  const db = await getDBAsync();
  const pass = db.passes.find((p) => p.id === String(passId || ""));
  if (!pass) return NextResponse.json({ error: "체험권을 찾을 수 없습니다" }, { status: 404 });
  if (pass.ownerId !== s.userId) return NextResponse.json({ error: "내 매장의 체험권이 아닙니다" }, { status: 403 });
  if (pass.status !== "active" || !pass.reservation) {
    return NextResponse.json({ error: "확인할 예약이 없습니다" }, { status: 400 });
  }
  if (pass.reservation.status === "confirmed") {
    return NextResponse.json({ ok: true }); // 멱등 — 이미 확정
  }
  if (pass.reservation.status === "proposed") {
    return NextResponse.json({ error: "다른 시간을 제안한 상태예요 — 체험자 응답을 기다려주세요" }, { status: 400 });
  }

  const now = Date.now();
  pass.reservation.status = "confirmed";
  pass.reservation.confirmedAt = now;

  const store = db.stores.find((x) => x.id === pass.storeId);
  db.notifications.push({
    id: rid("nt"),
    userId: pass.reviewerId,
    role: "reviewer",
    title: "예약이 확정되었어요 📅",
    body: `${store?.name ?? "매장"} ${fmtReservationLabel(pass.reservation.date, pass.reservation.time)} 방문 예약이 확인되었습니다. 예약 시간에 방문해 체험권 QR을 제시해주세요.`,
    createdAt: now,
    read: false,
    link: `/r/passes/${pass.id}`,
  });

  await saveDBAsync();
  return NextResponse.json({ ok: true });
}
