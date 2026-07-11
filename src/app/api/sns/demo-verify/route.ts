import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { rid } from "@/lib/ids";
import { isSnsKind, oauthConfigured, applySnsConnect } from "@/lib/sns-oauth";

export const runtime = "nodejs";

// 데모 검증 연동 (OAuth 키 미설정 환경 전용) — 플로우 시연용.
// 실 키가 설정된 프로바이더는 403 — 데모 경로로 실검증을 우회할 수 없다.
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "reviewer") {
    return NextResponse.json({ error: "체험자 로그인 필요" }, { status: 401 });
  }
  const { kind, url, influence, accountName } = await req.json();
  if (typeof kind !== "string" || !isSnsKind(kind)) {
    return NextResponse.json({ error: "지원하지 않는 채널입니다" }, { status: 400 });
  }
  if (oauthConfigured(kind)) {
    return NextResponse.json({ error: "이 채널은 실제 로그인 검증이 활성화되어 있습니다" }, { status: 403 });
  }
  const db = await getDBAsync();
  const applied = applySnsConnect(db, s.userId, {
    kind,
    url: String(url || "").slice(0, 300),
    influence: Math.max(0, Number(influence) || 0),
    verified: true,
    verifiedAt: Date.now(),
    verifiedVia: "demo",
    providerAccountId: rid("demo"),
    accountName: String(accountName || "").slice(0, 60) || "데모 계정",
  });
  if (!applied.ok) return NextResponse.json({ error: applied.error }, { status: 400 });
  await saveDBAsync();
  const me = db.reviewers.find((r) => r.id === s.userId)!;
  return NextResponse.json({ ok: true, grade: me.grade, channelGrades: me.channelGrades });
}
