import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import {
  reservationHistory,
  fmtReservationLabel,
  OWNER_CANCEL_REASONS,
  ownerCancelReasonLabel,
  ownerCancelledReviewerCopy,
  type OwnerCancelReasonCode,
} from "@/lib/reservation";

export const runtime = "nodejs";

// 사장님 확정 예약 취소 (2026-07-22 §5-3 · 2026-08-04 개정) — 매장 휴무·시설 문제·직원 부재 등
// 예외 상황에서 고객센터를 거치지 않고 사장님 화면에서 직접 처리한다.
//  - 취소 사유 = 4지선다 + 직접 입력 (2026-08-04 — cancelReasonCode로 데이터화, 어드민 통계)
//  - 체험자에게는 선택 사유를 정제한 사과 톤 안내 문구로 노출 (ownerCancelledReviewerCopy)
//  - 발급된 QR 즉시 사용 불가 (status=cancelled — use/use-by-code가 차단)
//  - 체험자 패널티·12h 재신청 제한 없음 (매장 귀책), 시간대 정원은 자연 복구
//  - **모집 슬롯은 복원하지 않는다** (2026-08-04 패널티 — 확정 후 매장 취소 건은 사용 처리가
//    완료된 것으로 간주, restoreQuotaSlot 미호출. 운영정책서 §15.3)
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const { passId, reasonCode, reason } = await req.json();
  const db = await getDBAsync();
  const pass = db.passes.find((p) => p.id === String(passId || ""));
  if (!pass) return NextResponse.json({ error: "체험권을 찾을 수 없습니다" }, { status: 404 });
  if (pass.ownerId !== s.userId) return NextResponse.json({ error: "내 매장의 체험권이 아닙니다" }, { status: 403 });
  if (pass.status !== "active" || !pass.reservation || pass.reservation.status !== "confirmed") {
    return NextResponse.json({ error: "취소할 확정 예약이 없습니다" }, { status: 400 });
  }
  // 사유 검증 — 4지선다 코드 필수, 직접 입력(custom)은 텍스트 필수.
  // 구 클라이언트 호환: reasonCode 없이 reason만 오면 custom으로 수용.
  const code = OWNER_CANCEL_REASONS.some((r) => r.code === reasonCode)
    ? (reasonCode as OwnerCancelReasonCode)
    : String(reason || "").trim()
      ? ("custom" as const)
      : null;
  if (!code) {
    return NextResponse.json({ error: "취소 사유를 선택해주세요 — 체험자에게 안내돼요" }, { status: 400 });
  }
  const customText = String(reason || "").trim().slice(0, 100);
  if (code === "custom" && !customText) {
    return NextResponse.json({ error: "취소 사유를 입력해주세요 — 체험자에게 안내돼요" }, { status: 400 });
  }
  const cleanReason = code === "custom" ? customText : ownerCancelReasonLabel(code);

  const now = Date.now();
  pass.status = "cancelled";
  pass.cancelledAt = now;
  pass.cancelledVia = "owner_cancelled"; // §15-3 — 체험자 패널티·12h 재신청 제한 없음 (매장 귀책)
  pass.cancelReasonCode = code;
  pass.cancelReason = cleanReason;
  pass.reservation.history = [...reservationHistory(pass.reservation), { at: now, by: "owner", kind: "decline", note: cleanReason }];
  // restoreQuotaSlot 미호출 (2026-08-04) — 확정 취소 건은 사용 처리 완료로 간주, 모집 슬롯 미복원

  const store = db.stores.find((x) => x.id === pass.storeId);
  db.notifications.push({
    id: rid("nt"),
    userId: pass.reviewerId,
    role: "reviewer",
    title: "확정된 예약이 취소됐어요",
    body: `${store?.name ?? "매장"} ${fmtReservationLabel(pass.reservation.date, pass.reservation.time)} 예약이 취소되었습니다. ${ownerCancelledReviewerCopy(code, cleanReason)}`,
    createdAt: now,
    read: false,
    link: `/r/passes/${pass.id}`,
  });

  await saveDBAsync();
  return NextResponse.json({ ok: true });
}
