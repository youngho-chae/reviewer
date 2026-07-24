import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { closeCampaign } from "@/lib/campaign-close";

export const runtime = "nodejs";

// 캠페인 조기 종료 (2026-07-24) — 사장님 캠페인 관리 화면 전용.
// 정책·부수효과는 src/lib/campaign-close.ts 단일 코어 참조 (운영자 콘솔과 공유).
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "owner") {
    return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  }
  const { campaignId } = await req.json();
  const db = await getDBAsync();
  const c = db.campaigns.find((x) => x.id === String(campaignId || ""));
  if (!c) return NextResponse.json({ error: "캠페인을 찾을 수 없습니다" }, { status: 404 });
  const store = db.stores.find((st) => st.id === c.storeId);
  if (!store || store.ownerId !== s.userId) {
    return NextResponse.json({ error: "내 캠페인이 아닙니다" }, { status: 403 });
  }
  if (c.endAt <= Date.now()) {
    return NextResponse.json({ error: "이미 종료된 캠페인입니다" }, { status: 400 });
  }

  const result = closeCampaign(db, c, "owner");
  await saveDBAsync();
  return NextResponse.json({ ok: true, ...result });
}
