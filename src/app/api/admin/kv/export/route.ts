import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { kvAvailable, kvCurrentKey, kvLoadRaw } from "@/lib/kv";

export const runtime = "nodejs";

// KV 백업 export (2026-08-07 — 운영팀 전용): 지정 키(기본 = 현재 배포 키)의 DB 원문 JSON을
// 그대로 반환한다. 정기 백업·복구 전 스냅샷 확보용 — 다운로드해 보관하면 이후 사고 시
// POST /api/admin/kv/restore 의 payload로 되살릴 수 있다.
export async function GET(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "운영팀 로그인 필요" }, { status: 401 });
  if (!kvAvailable()) return NextResponse.json({ error: "KV 미설정 환경입니다" }, { status: 400 });

  const key = req.nextUrl.searchParams.get("key") || kvCurrentKey();
  if (!key.startsWith("catchpass:db:")) {
    return NextResponse.json({ error: "catchpass:db:* 키만 조회할 수 있습니다" }, { status: 400 });
  }
  const db = await kvLoadRaw<unknown>(key);
  if (!db) return NextResponse.json({ error: `키에 데이터가 없습니다: ${key}` }, { status: 404 });
  return new NextResponse(JSON.stringify({ key, exportedAt: Date.now(), db }), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="catchpass-kv-${Date.now()}.json"`,
    },
  });
}
