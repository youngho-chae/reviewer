import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid, isUseCode, normalizeUseCode } from "@/lib/ids";
import { Campaign, RequiredMenu, SnsKind } from "@/lib/types";
import { distributeQuota, PLAN_POLICY, currentMonthStart } from "@/lib/plan-policy";
import { CHANNEL_ORDER } from "@/lib/channels";
import { availableQuotaBonus, consumeQuotaBonus } from "@/lib/referral";

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

  // 월간 모집 팀 수 정책 검증 — 초대 보상(quota_bonus)은 플랜 한도에 가산되며 사용 시 소진
  const policy = PLAN_POLICY[owner.plan];
  if (policy.monthlyTeamLimit !== null) {
    const monthStart = currentMonthStart();
    const ownerStoreIds = new Set(db.stores.filter((x) => x.ownerId === owner.id).map((x) => x.id));
    const monthlyUsed = db.campaigns
      .filter((c) => ownerStoreIds.has(c.storeId) && c.createdAt >= monthStart)
      .reduce((sum, c) => sum + c.quota.S + c.quota.A + c.quota.B + c.quota.C, 0);
    const bonus = availableQuotaBonus(db, owner.id);
    const remaining = policy.monthlyTeamLimit + bonus - monthlyUsed;
    if (totalQuota > remaining) {
      return NextResponse.json(
        {
          error: `${owner.plan} 플랜은 월 ${policy.monthlyTeamLimit}팀까지 모집 가능합니다 (이번 달 ${monthlyUsed}팀 사용${bonus > 0 ? ` · 보너스 +${bonus}팀` : ""} · 잔여 ${Math.max(0, remaining)}팀).`,
        },
        { status: 400 },
      );
    }
    // 플랜 한도를 초과하는 분량만큼 보너스 소진
    const overPlan = monthlyUsed + totalQuota - policy.monthlyTeamLimit;
    if (overPlan > 0) consumeQuotaBonus(db, owner.id, overPlan);
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
        .slice(0, 5) // 필수 주문 메뉴는 선택 입력·최대 5개 (확정 정책 6)
    : [];

  // 필수 채널 — 허용 채널(블/인/틱)만 통과, 중복 제거
  const requiredChannels = ((body.requiredChannels || []) as SnsKind[]).filter(
    (ch, i, arr) => CHANNEL_ORDER.includes(ch) && arr.indexOf(ch) === i,
  );
  if (requiredChannels.length === 0) {
    return NextResponse.json({ error: "필수 채널을 1개 이상 선택해주세요" }, { status: 400 });
  }

  // 강조 키워드 — 최대 5개, 각 20자
  const highlightKeywords: string[] = Array.isArray(body.highlightKeywords)
    ? body.highlightKeywords
        .map((k: unknown) => String(k ?? "").trim().slice(0, 20))
        .filter((k: string) => k.length > 0)
        .slice(0, 5)
    : [];

  const now = Date.now();
  // 캠페인명 — 사장님 내부 관리용 제목 (확정 정책 7). 미입력 시 매장명 자동.
  // 체험자 화면은 항상 매장명(store.name) 중심으로 노출한다.
  const ownerTitle = String(body.title || "").trim().slice(0, 40);
  const c: Campaign = {
    id: rid("cp"),
    storeId: store.id,
    kind: "visit",
    title: ownerTitle || store.name,
    startAt: now,
    endAt: now + (Number(body.days) || 30) * 86400000,
    supportAmount: Number(body.supportAmount) || 0,
    quota: distributeQuota(owner.plan, totalQuota),
    used: { S: 0, A: 0, B: 0, C: 0 },
    requiredChannels,
    requiredMenus,
    description: String(body.description || "").slice(0, 500),
    highlightKeywords,
    createdAt: now,
    useCode,
  };
  db.campaigns.push(c);
  await saveDBAsync();
  return NextResponse.json({ ok: true, id: c.id });
}
