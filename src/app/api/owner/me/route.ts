import { NextResponse } from "next/server";
import { getDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { PLAN_POLICY, currentMonthStart } from "@/lib/plan-policy";

export const runtime = "nodejs";

export async function GET() {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const db = await getDBAsync();
  const owner = db.owners.find((o) => o.id === s.userId);
  const stores = db.stores.filter((st) => st.ownerId === s.userId);

  // 이번 달 사용량 계산 (모집 팀 수 합계)
  let monthlyUsed = 0;
  let monthlyLimit: number | null = null;
  if (owner) {
    const policy = PLAN_POLICY[owner.plan];
    monthlyLimit = policy.monthlyTeamLimit;
    const monthStart = currentMonthStart();
    const storeIds = new Set(stores.map((st) => st.id));
    monthlyUsed = db.campaigns
      .filter((c) => storeIds.has(c.storeId) && c.createdAt >= monthStart)
      .reduce((sum, c) => sum + c.quota.S + c.quota.A + c.quota.B + c.quota.C, 0);
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
  });
}
