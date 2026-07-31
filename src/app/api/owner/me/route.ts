import { NextResponse } from "next/server";
import { getDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { PLAN_POLICY, currentMonthStart } from "@/lib/plan-policy";
import { refillBonus, refillPurchaseState } from "@/lib/limit-refill";

export const runtime = "nodejs";

export async function GET() {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const db = await getDBAsync();
  const owner = db.owners.find((o) => o.id === s.userId);
  const stores = db.stores.filter((st) => st.ownerId === s.userId);

  // 이번 달 사용량 계산 (모집 팀 수 합계) — 한도에는 리필권 가산 포함 (2026-07-31 BM)
  let monthlyUsed = 0;
  let monthlyLimit: number | null = null;
  let refill = null;
  if (owner) {
    const policy = PLAN_POLICY[owner.plan];
    monthlyLimit = policy.monthlyTeamLimit + refillBonus(db, owner.id);
    const monthStart = currentMonthStart();
    const storeIds = new Set(stores.map((st) => st.id));
    monthlyUsed = db.campaigns
      .filter((c) => storeIds.has(c.storeId) && c.createdAt >= monthStart)
      .reduce((sum, c) => sum + c.quota.S + c.quota.A + c.quota.B + c.quota.C, 0);
    refill = { bonus: refillBonus(db, owner.id), ...refillPurchaseState(db, owner) };
  }

  // 대표 매장 (2026-07-31) — 지정값이 내 매장이 아니면 첫 매장 폴백
  const primaryStoreId =
    owner?.primaryStoreId && stores.some((st) => st.id === owner.primaryStoreId)
      ? owner.primaryStoreId
      : stores[0]?.id;

  return NextResponse.json({
    owner: { id: owner?.id, storeName: owner?.storeName, plan: owner?.plan, primaryStoreId },
    stores,
    monthly: { used: monthlyUsed, limit: monthlyLimit },
    refill, // 모집 한도 리필권 상태 (2026-07-31 BM — bonus/grant/price/구매 횟수/구매 가능)
  });
}
