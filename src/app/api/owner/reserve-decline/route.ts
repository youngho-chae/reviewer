import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import { restoreQuotaSlot } from "@/lib/pass-lifecycle";
import { reservationHistory } from "@/lib/reservation";

export const runtime = "nodejs";

// 사장님 예약 거절 (2026-07-22 §5-1 — v3의 '재제안 후에만' 제약을 개정).
// **확정 전(확인 대기·제안 응답 대기) 어느 단계에서든** 거절할 수 있다 — 매장 사정으로
// 요청을 받지 못하는 경우의 종료 경로. 확정된 예약의 해제는 '취소'(/api/owner/reserve-cancel)로 구분한다 (§5-4).
// 거절 = 체험자 귀책 아님: 슬롯·정원 복구, 패널티·12h 재신청 제한 없음 — 모집 중이면 즉시 재신청 가능.
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const { passId } = await req.json();
  const db = await getDBAsync();
  const pass = db.passes.find((p) => p.id === String(passId || ""));
  if (!pass) return NextResponse.json({ error: "체험권을 찾을 수 없습니다" }, { status: 404 });
  if (pass.ownerId !== s.userId) return NextResponse.json({ error: "내 매장의 체험권이 아닙니다" }, { status: 403 });
  if (pass.status !== "active" || !pass.reservation) {
    return NextResponse.json({ error: "거절할 예약 요청이 없습니다" }, { status: 400 });
  }
  if (pass.reservation.status === "confirmed") {
    return NextResponse.json(
      { error: "이미 확정된 예약이에요 — 확정 예약은 [예약 취소]로 사유와 함께 처리해주세요" },
      { status: 400 },
    );
  }

  const now = Date.now();
  pass.status = "cancelled";
  pass.cancelledAt = now;
  pass.cancelledVia = "owner_declined"; // §15-3 — 패널티·12h 재신청 제한 없음 (체험자 귀책 아님)
  pass.reservation.history = [...reservationHistory(pass.reservation), { at: now, by: "owner", kind: "decline" }];
  restoreQuotaSlot(db, pass);

  const store = db.stores.find((x) => x.id === pass.storeId);
  db.notifications.push({
    id: rid("nt"),
    userId: pass.reviewerId,
    role: "reviewer",
    title: "예약이 확정되지 않았어요",
    body: `매장 사정으로 ${store?.name ?? "매장"} 예약이 확정되지 않았어요. 패널티나 재신청 제한은 없어요 — 모집 중이라면 바로 다시 신청할 수 있어요.`,
    createdAt: now,
    read: false,
    link: "/r/passes", // 종착 상태 → 리스트 (취소 카드가 사유 문구와 함께 노출 — 링크 원칙 2026-08-30)
  });

  await saveDBAsync();
  return NextResponse.json({ ok: true });
}
