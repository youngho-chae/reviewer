import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import { restoreQuotaSlot } from "@/lib/pass-lifecycle";
import { reviewerCancelBlockedReason, reservationHistory, fmtReservationLabel } from "@/lib/reservation";

export const runtime = "nodejs";

// 체험자가 사용 전(active) 체험권을 직접 취소.
// 취소 즉시 모집 슬롯이 복구되어 다른 체험자가 참여할 수 있다.
// 취소는 노쇼로 집계하지 않는다 — 방치(만료)보다 취소를 유도하기 위한 정책.
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "reviewer") return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const { passId } = await req.json();
  const db = await getDBAsync();
  const pass = db.passes.find((p) => p.id === String(passId || ""));
  if (!pass) return NextResponse.json({ error: "체험권을 찾을 수 없습니다" }, { status: 404 });
  if (pass.reviewerId !== s.userId) return NextResponse.json({ error: "본인의 체험권이 아닙니다" }, { status: 403 });
  if (pass.status !== "active") {
    return NextResponse.json({ error: "사용 전 상태의 체험권만 취소할 수 있습니다" }, { status: 400 });
  }
  // 확정 예약 취소 기한 — 방문 전날 23:59(KST)까지, 당일엔 매장 문의 안내 (2026-07-22 §13-C 기본안)
  const blocked = reviewerCancelBlockedReason(pass.reservation);
  if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });

  const now = Date.now();
  pass.status = "cancelled";
  pass.cancelledAt = now;
  if (pass.reservation) {
    pass.reservation.history = [...reservationHistory(pass.reservation), { at: now, by: "reviewer", kind: "decline" }];
  }
  restoreQuotaSlot(db, pass);

  db.notifications.push({
    id: rid("nt"),
    userId: pass.ownerId,
    role: "owner",
    title: pass.reservation ? "예약 취소" : "체험권 참여 취소",
    // [확정 정책 8] 익명 #last4 — 실명·등급 비노출
    body: pass.reservation
      ? `익명 #${pass.reviewerId.slice(-4)} 체험자가 ${fmtReservationLabel(pass.reservation.date, pass.reservation.time)} 예약을 취소했습니다. 시간대 정원과 모집 슬롯이 복구되었어요.`
      : `익명 #${pass.reviewerId.slice(-4)} 체험자가 참여를 취소했습니다. 모집 슬롯이 복구되었습니다.`,
    createdAt: now,
    read: false,
    link: "/o/home",
  });

  await saveDBAsync();
  return NextResponse.json({ ok: true });
}
