import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import { Campaign, SnsKind } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const body = await req.json();
  const db = await getDBAsync();
  const store = db.stores.find((x) => x.id === body.storeId && x.ownerId === s.userId);
  if (!store) return NextResponse.json({ error: "잘못된 매장" }, { status: 400 });
  const now = Date.now();
  const c: Campaign = {
    id: rid("cp"),
    storeId: store.id,
    kind: "visit",
    title: String(body.title || "").trim(),
    startAt: now,
    endAt: now + (Number(body.days) || 30) * 86400000,
    supportAmount: Number(body.supportAmount) || 0,
    quota: {
      S: Number(body.quota?.S) || 0,
      A: Number(body.quota?.A) || 0,
      B: Number(body.quota?.B) || 0,
      C: Number(body.quota?.C) || 0,
    },
    used: { S: 0, A: 0, B: 0, C: 0 },
    requiredChannels: (body.requiredChannels || []) as SnsKind[],
    requiredMenus: body.requiredMenus || [],
    description: String(body.description || ""),
    createdAt: now,
  };
  if (!c.title) return NextResponse.json({ error: "제목을 입력해주세요" }, { status: 400 });
  db.campaigns.push(c);
  await saveDBAsync();
  return NextResponse.json({ ok: true, id: c.id });
}
