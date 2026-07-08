import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";

export const runtime = "nodejs";

// 관심 목록 토글 (2026-07-07 회의) — 캠페인 단위 저장.
// 이미 저장돼 있으면 해제, 없으면 저장. 종료된 캠페인도 저장 상태는 유지된다.
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "reviewer") return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const { campaignId } = await req.json();
  const db = await getDBAsync();
  const c = db.campaigns.find((x) => x.id === String(campaignId || ""));
  if (!c) return NextResponse.json({ error: "캠페인을 찾을 수 없습니다" }, { status: 404 });

  if (!db.interests) db.interests = [];
  const idx = db.interests.findIndex((i) => i.reviewerId === s.userId && i.campaignId === c.id);
  let saved: boolean;
  if (idx >= 0) {
    db.interests.splice(idx, 1);
    saved = false;
  } else {
    db.interests.push({ reviewerId: s.userId, campaignId: c.id, createdAt: Date.now() });
    saved = true;
  }
  await saveDBAsync();
  return NextResponse.json({ saved });
}
