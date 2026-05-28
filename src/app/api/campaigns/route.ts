import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import { Campaign, SnsKind } from "@/lib/types";
import { distributeQuota } from "@/lib/plan-policy";

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

  const requiredMenus = Array.isArray(body.requiredMenus)
    ? body.requiredMenus.map((m: unknown) => String(m).trim()).filter(Boolean)
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
  };
  db.campaigns.push(c);
  await saveDBAsync();
  return NextResponse.json({ ok: true, id: c.id });
}
