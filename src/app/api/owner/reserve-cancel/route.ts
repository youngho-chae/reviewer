import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import { restoreQuotaSlot } from "@/lib/pass-lifecycle";
import { reservationHistory, fmtReservationLabel } from "@/lib/reservation";

export const runtime = "nodejs";

// 사장님 확정 예약 취소 (2026-07-22 §5-3) — 매장 휴무·시설 문제·직원 부재·외부 예약 중복 등
// 예외 상황에서 고객센터를 거치지 않고 사장님 화면에서 직접 처리한다.
//  - 취소 사유 입력 필수 — 체험자에게 그대로 안내 (분쟁 예방)
//  - 발급된 QR 즉시 사용 불가 (status=cancelled — use/use-by-code가 차단)
//  - 체험자 패널티·12h 재신청 제한 없음 (매장 귀책), 슬롯·시간대 정원 즉시 복구
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const { passId, reason } = await req.json();
  const db = await getDBAsync();
  const pass = db.passes.find((p) => p.id === String(passId || ""));
  if (!pass) return NextResponse.json({ error: "체험권을 찾을 수 없습니다" }, { status: 404 });
  if (pass.ownerId !== s.userId) return NextResponse.json({ error: "내 매장의 체험권이 아닙니다" }, { status: 403 });
  if (pass.status !== "active" || !pass.reservation || pass.reservation.status !== "confirmed") {
    return NextResponse.json({ error: "취소할 확정 예약이 없습니다" }, { status: 400 });
  }
  const cleanReason = String(reason || "").trim().slice(0, 100);
  if (!cleanReason) {
    return NextResponse.json({ error: "취소 사유를 입력해주세요 — 체험자에게 그대로 안내돼요" }, { status: 400 });
  }

  const now = Date.now();
  pass.status = "cancelled";
  pass.cancelledAt = now;
  pass.cancelledVia = "owner_cancelled"; // §15-3 — 패널티·12h 재신청 제한 없음 (매장 귀책)
  pass.cancelReason = cleanReason;
  pass.reservation.history = [...reservationHistory(pass.reservation), { at: now, by: "owner", kind: "decline", note: cleanReason }];
  restoreQuotaSlot(db, pass);

  const store = db.stores.find((x) => x.id === pass.storeId);
  db.notifications.push({
    id: rid("nt"),
    userId: pass.reviewerId,
    role: "reviewer",
    title: "확정된 예약이 취소됐어요",
    body: `매장 사정으로 ${store?.name ?? "매장"} ${fmtReservationLabel(pass.reservation.date, pass.reservation.time)} 예약이 취소되었습니다. (사유: ${cleanReason}) 재신청 제한은 없어요 — 모집 중이라면 바로 다시 신청할 수 있어요.`,
    createdAt: now,
    read: false,
    link: `/r/passes/${pass.id}`,
  });

  await saveDBAsync();
  return NextResponse.json({ ok: true });
}
