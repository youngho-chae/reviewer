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
  await saveDBAsync();
  return NextResponse.json({ ok: true, plan });
}
