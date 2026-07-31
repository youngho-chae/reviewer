import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { kstMonth, ownedRefills } from "@/lib/limit-refill";

export const runtime = "nodejs";

// 보유 리필권(쿠폰) 사용 (2026-07-31 2차 보완) — 이번 결제 주기 한도에 가산.
// body.refillId 지정 시 그 쿠폰, 미지정 시 가장 오래 보유한 쿠폰부터 사용.
// 가산분은 사용한 주기까지만 유효·이월 불가.
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const db = await getDBAsync();
  const owner = db.owners.find((o) => o.id === s.userId);
  if (!owner) return NextResponse.json({ error: "사장님 정보를 찾을 수 없습니다" }, { status: 400 });
  const body = await req.json().catch(() => ({}));

  const owned = ownedRefills(db, owner.id);
  if (owned.length === 0) {
    return NextResponse.json({ error: "보유 중인 리필권이 없어요. 먼저 리필권을 구매해주세요." }, { status: 400 });
  }
  const target = body.refillId ? owned.find((r) => r.id === body.refillId) : owned[0];
  if (!target) return NextResponse.json({ error: "해당 리필권을 찾을 수 없어요." }, { status: 400 });

  const now = Date.now();
  target.usedAt = now;
  target.usedMonth = kstMonth(now);
  await saveDBAsync();
  return NextResponse.json({ ok: true, amount: target.amount, owned: owned.length - 1 });
}
