import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const { plan } = await req.json();
  if (!["Free", "Basic", "Standard", "Premium"].includes(plan)) {
    return NextResponse.json({ error: "잘못된 플랜" }, { status: 400 });
  }
  const db = await getDBAsync();
  const owner = db.owners.find((o) => o.id === s.userId);
  if (!owner) return NextResponse.json({ error: "사용자 없음" }, { status: 404 });
  owner.plan = plan;
  // 결제 주기 anchor 갱신 (2026-08-03) — 결제(플랜 변경) 시점에 한도 부여·주기 재시작
  owner.planStartedAt = Date.now();
  await saveDBAsync();
  return NextResponse.json({ ok: true, plan });
}
