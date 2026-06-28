import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid, isUseCode, normalizeUseCode } from "@/lib/ids";
import { Campaign, RequiredMenu, SnsKind } from "@/lib/types";
import { distributeQuota, PLAN_POLICY, currentMonthStart } from "@/lib/plan-policy";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const body = await req.json();
  const db = await getDBAsync();
  const owner = db.owners.find((o) => o.id === s.userId);
  if (!owner) return NextResponse.json({ error: "사장님 정보를 찾을 수 없습니다" }, { status: 400 });
  const store = db.stores.find((x) => x.id === body.storeId && x.ownerId === s.userId);
  if (!store) return NextResponse.json({ error: "잘못된 매장" }, { status: 400 });

  const totalQuota = Math.max(0, Math.floor(Number(body.totalQuota) || 0));
  if (totalQuota <= 0) return NextResponse.json({ error: "모집 인원을 1명 이상 입력해주세요" }, { status: 400 });

  // 사용처리 4자리 숫자 코드 — 필수
  const useCode = normalizeUseCode(String(body.useCode ?? ""));
  if (!isUseCode(useCode)) {
    return NextResponse.json({ error: "사용처리 코드는 숫자 4자리로 입력해주세요" }, { status: 400 });
  }
  // 동일 사장님의 진행 중(미마감) 캠페인 간 4자리 코드 중복 방지 (조회 모호성 제거)
  const ownerStoreIdSet = new Set(db.stores.filter((x) => x.ownerId === owner.id).map((x) => x.id));
  const dupActive = db.campaigns.some(
    (c) => ownerStoreIdSet.has(c.storeId) && c.endAt > Date.now() && c.useCode === useCode,
  );
  if (dupActive) {
    return NextResponse.json(
      { error: `사용처리 코드 ${useCode}는 진행 중인 다른 캠페인에서 사용 중입니다. 다른 4자리를 입력해주세요.` },
      { status: 400 },
    );
  }

  // 월간 모집 팀 수 정책 검증
  const policy = PLAN_POLICY[owner.plan];
  if (policy.monthlyTeamLimit !== null) {
    const monthStart = currentMonthStart();
    const ownerStoreIds = new Set(db.stores.filter((x) => x.ownerId === owner.id).map((x) => x.id));
    const monthlyUsed = db.campaigns
      .filter((c) => ownerStoreIds.has(c.storeId) && c.createdAt >= monthStart)
      .reduce((sum, c) => sum + c.quota.S + c.quota.A + c.quota.B + c.quota.C, 0);
    const remaining = policy.monthlyTeamLimit - monthlyUsed;
    if (totalQuota > remaining) {
      return NextResponse.json(
        {
          error: `${owner.plan} 플랜은 월 ${policy.monthlyTeamLimit}팀까지 모집 가능합니다 (이번 달 ${monthlyUsed}팀 사용 · 잔여 ${Math.max(0, remaining)}팀).`,
        },
        { status: 400 },
      );
    }
  }

  // 필수 주문 메뉴 — { name, price? } 형태로 정규화
  const requiredMenus: RequiredMenu[] = Array.isArray(body.requiredMenus)
    ? body.requiredMenus
        .map((m: unknown) => {
          if (typeof m === "string") return { name: m.trim() };
          if (m && typeof m === "object") {
            const obj = m as { name?: unknown; price?: unknown };
            const name = String(obj.name ?? "").trim();
            const priceNum =
              typeof obj.price === "number"
                ? obj.price
                : typeof obj.price === "string" && obj.price.trim() !== ""
                  ? Number(String(obj.price).replace(/\D/g, ""))
                  : NaN;
            const price = Number.isFinite(priceNum) && priceNum > 0 ? priceNum : undefined;
            return { name, price };
          }
          return { name: "" };
        })
        .filter((m: RequiredMenu) => m.name.length > 0)
    : [];

  const now = Date.now();
  // 캠페인 제목은 매장명으로 자동 설정 — 사장님이 별도 입력하지 않음
  const c: Campaign = {
    id: rid("cp"),
    storeId: store.id,
    kind: "visit",
    title: store.name,
    startAt: now,
    endAt: now + (Number(body.days) || 30) * 86400000,
    supportAmount: Number(body.supportAmount) || 0,
    quota: distributeQuota(owner.plan, totalQuota),
    used: { S: 0, A: 0, B: 0, C: 0 },
    requiredChannels: (body.requiredChannels || []) as SnsKind[],
    requiredMenus,
    description: String(body.description || ""),
    createdAt: now,
    useCode,
  };
  db.campaigns.push(c);
  await saveDBAsync();
  return NextResponse.json({ ok: true, id: c.id });
}
