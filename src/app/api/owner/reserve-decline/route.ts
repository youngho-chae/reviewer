import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import { restoreQuotaSlot } from "@/lib/pass-lifecycle";
import { reservationHistory, reviewerCounterUsed } from "@/lib/reservation";

export const runtime = "nodejs";

// 사장님 예약 거절 (2026-07-16 v3) — **체험자가 재제안(1회)까지 한 뒤에만** 가능하다.
// 협상은 서로 각 1회씩: 체험자 희망 → 사장님 제안(1회) → 체험자 재제안(1회) → 사장님 확인 또는 거절.
// 최초 희망에 대한 일방 거절은 여전히 불가 — [예약 확인]/[다른 시간 제안]으로 조율한다.
// 거절 = 신청 취소: 슬롯 복구, 체험자 패널티·12h 재신청 제한 없음 (일정 불일치일 뿐).
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const { passId } = await req.json();
  const db = await getDBAsync();
  const pass = db.passes.find((p) => p.id === String(passId || ""));
  if (!pass) return NextResponse.json({ error: "체험권을 찾을 수 없습니다" }, { status: 404 });
  if (pass.ownerId !== s.userId) return NextResponse.json({ error: "내 매장의 체험권이 아닙니다" }, { status: 403 });
  if (pass.status !== "active" || !pass.reservation || pass.reservation.status !== "requested") {
    return NextResponse.json({ error: "거절할 예약 요청이 없습니다" }, { status: 400 });
  }
  if (!reviewerCounterUsed(pass.reservation)) {
    return NextResponse.json(
      { error: "최초 희망 시간은 거절할 수 없어요 — [예약 확인] 또는 [다른 시간 제안]으로 조율해주세요" },
      { status: 400 },
    );
  }

  const now = Date.now();
  pass.status = "cancelled";
  pass.cancelledAt = now;
  pass.cancelledVia = "proposal_declined"; // 패널티·12h 재신청 제한 없음 (체험자 귀책 아님)
  pass.reservation.history = [...reservationHistory(pass.reservation), { at: now, by: "owner", kind: "decline" }];
  restoreQuotaSlot(db, pass);

  const store = db.stores.find((x) => x.id === pass.storeId);
  db.notifications.push({
    id: rid("nt"),
    userId: pass.reviewerId,
    role: "reviewer",
    title: "예약 일정을 맞추지 못했어요",
    body: `${store?.name ?? "매장"}과 방문 일정이 맞지 않아 신청이 취소되었습니다. 패널티나 재신청 제한은 없어요 — 언제든 다시 신청할 수 있어요.`,
    createdAt: now,
    read: false,
    link: `/r/passes/${pass.id}`,
  });

  await saveDBAsync();
  return NextResponse.json({ ok: true });
}
