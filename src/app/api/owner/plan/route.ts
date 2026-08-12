import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const { plan, billing } = await req.json();
  if (!["Free", "Basic", "Standard", "Premium"].includes(plan)) {
    return NextResponse.json({ error: "잘못된 플랜" }, { status: 400 });
  }
  // 결제 방식 (2026-08-10 §2①) — 월간/연간은 별개 상품이 아니라 결제 방식. 미지정은 유지(구버전 monthly).
  if (billing !== undefined && !["monthly", "yearly"].includes(billing)) {
    return NextResponse.json({ error: "잘못된 결제 방식" }, { status: 400 });
  }
  const db = await getDBAsync();
  const owner = db.owners.find((o) => o.id === s.userId);
  if (!owner) return NextResponse.json({ error: "사용자 없음" }, { status: 404 });
  const planChanged = owner.plan !== plan;
  const billingChanged = billing !== undefined && (owner.billing ?? "monthly") !== billing;
  if (!planChanged && !billingChanged) {
    return NextResponse.json({ error: "현재 이용 중인 플랜과 동일합니다" }, { status: 400 });
  }
  owner.plan = plan;
  // Free = 멤버십 없음 — 결제 방식도 함께 소거 (2026-08-11: billing 미전달 해지 시 연간 표기가
  // 잔존하던 결함 수정. 유료 플랜은 billing 전달 시에만 갱신 — 미전달은 기존 방식 유지)
  if (plan === "Free") owner.billing = undefined;
  else if (billing !== undefined) owner.billing = billing;
  // 결제 주기 anchor 갱신 (2026-08-03) — 결제(플랜 변경) 시점에 한도 부여·주기 재시작.
  // 결제 방식만 바꾼 경우(연간↔월간)는 anchor 유지 — 모집 주기가 초기화되면 한도가 이중 부여된다.
  if (planChanged) owner.planStartedAt = Date.now();
  await saveDBAsync();
  return NextResponse.json({ ok: true, plan, billing: owner.billing ?? "monthly" });
}
