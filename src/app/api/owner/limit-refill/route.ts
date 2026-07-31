import { NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import { refillPurchaseState, kstMonth, REFILL_PRICE } from "@/lib/limit-refill";

export const runtime = "nodejs";

// 모집 한도 리필권 구매 (2026-07-31 BM 전략안 — 정본 src/lib/limit-refill.ts).
// 결제(PG) 연동 전에는 멤버십과 동일 SOP: 즉시 적용 + 운영팀 수기 청구 (미납 시 조정).
export async function POST() {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const db = await getDBAsync();
  const owner = db.owners.find((o) => o.id === s.userId);
  if (!owner) return NextResponse.json({ error: "사장님 정보를 찾을 수 없습니다" }, { status: 400 });

  const state = refillPurchaseState(db, owner);
  // Free는 미판매 (전략안 §6 — 가격 신뢰 훼손 방지, Basic 업그레이드 유도).
  // 구매 횟수 제한 없음 (2026-07-31 보완 — 주기당 상한 해제).
  if (!state.canBuy) {
    return NextResponse.json(
      { error: "Free 플랜은 리필권을 구매할 수 없어요. Basic으로 업그레이드하면 매월 15건을 모집할 수 있어요." },
      { status: 403 },
    );
  }

  const now = Date.now();
  const refill = {
    id: rid("rf"),
    ownerId: owner.id,
    plan: owner.plan,
    amount: state.grant, // 구매 시점 플랜의 월 한도만큼 지급 — 플랜 변경해도 주기 종료까지 유지
    price: REFILL_PRICE,
    month: kstMonth(now), // 현재 결제 주기(캘린더 월 KST)까지만 유효 · 이월 불가
    purchasedAt: now,
  };
  (db.limitRefills ??= []).push(refill);
  await saveDBAsync();
  return NextResponse.json({
    ok: true,
    amount: refill.amount,
    price: refill.price,
    month: refill.month,
    purchasedThisCycle: state.purchasedThisCycle + 1,
  });
}
