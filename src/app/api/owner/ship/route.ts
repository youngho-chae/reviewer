import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import { courierOf, courierLabel } from "@/lib/couriers";

export const runtime = "nodejs";

// 배송형 발송 처리 (2026-07-12 레뷰 벤치마크) — 사장님이 상품 발송 후 운송장과 함께 확정.
// usedAt을 세팅해 방문형의 '사용 처리'와 동일한 지점으로 합류시킨다 — 이후 리뷰 7일 기한,
// 기한 초과 스윕, 재평가 집계가 기존 로직 그대로 작동한다 (src/lib/pass-lifecycle.ts).
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const { passId, trackingNo, courier } = await req.json();
  const db = await getDBAsync();
  const pass = db.passes.find((p) => p.id === String(passId || ""));
  if (!pass) return NextResponse.json({ error: "체험권을 찾을 수 없습니다" }, { status: 404 });
  if (pass.ownerId !== s.userId) return NextResponse.json({ error: "내 매장의 체험권이 아닙니다" }, { status: 403 });

  const c = db.campaigns.find((x) => x.id === pass.campaignId);
  if (!c || c.kind !== "delivery") {
    return NextResponse.json({ error: "배송형 캠페인의 체험권만 발송 처리할 수 있습니다" }, { status: 400 });
  }
  if (pass.status !== "active") {
    return NextResponse.json({ error: "발송 대기 상태의 체험권만 처리할 수 있습니다" }, { status: 400 });
  }

  const now = Date.now();
  pass.status = "used";
  pass.usedAt = now; // 리뷰 제출 기한(7일) 기산점
  pass.shippedAt = now;
  const tn = String(trackingNo || "").trim().slice(0, 30);
  if (tn) pass.trackingNo = tn;
  // 택배사 (2026-07-16 리뷰노트 벤치마크) — 체험자 배송 조회 링크용 (couriers.ts 목록만 허용)
  const cr = courierOf(String(courier || ""));
  if (cr) pass.courier = cr.code;

  const store = db.stores.find((x) => x.id === pass.storeId);
  db.notifications.push({
    id: rid("nt"),
    userId: pass.reviewerId,
    role: "reviewer",
    title: "상품이 발송되었어요 📦",
    body: `${store?.name ?? "매장"} 체험 상품이 발송되었습니다.${tn ? ` ${cr ? `${courierLabel(cr.code)} ` : ""}운송장 ${tn}.` : ""} 수령 후 7일 이내에 리뷰를 등록해주세요.`,
    createdAt: now,
    read: false,
    link: `/r/passes/${pass.id}`,
  });

  await saveDBAsync();
  return NextResponse.json({ ok: true });
}
