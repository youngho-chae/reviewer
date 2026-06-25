import { NextResponse } from "next/server";
import { getDBAsync } from "@/lib/db";
import { counterWithNoise } from "@/lib/referral";

export const runtime = "nodejs";

export async function GET() {
  const db = await getDBAsync();
  const c = counterWithNoise(db);
  return NextResponse.json(c, {
    headers: {
      // 짧은 캐시 — 클라이언트가 1.5~2초 주기로 폴링해도 부담 없도록.
      "Cache-Control": "public, max-age=1",
    },
  });
}
