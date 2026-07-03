import { NextResponse } from "next/server";
import { getDBAsync } from "@/lib/db";
import { snapshotCounter } from "@/lib/referral";

export const runtime = "nodejs";

// 실제 발행된 보상 이벤트만 반환 — 조작/노이즈 없음 (VER.1 MVP 원칙)
export async function GET() {
  const db = await getDBAsync();
  const c = snapshotCounter(db);
  return NextResponse.json(c, {
    headers: {
      // 짧은 캐시 — 클라이언트 폴링 부담 완화
      "Cache-Control": "public, max-age=5",
    },
  });
}
