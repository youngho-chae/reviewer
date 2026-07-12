import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { isSnsKind, applySnsDisconnect } from "@/lib/sns-oauth";
import { writeSnsState } from "@/lib/sns-cookie";

export const runtime = "nodejs";

// 채널 연동 해제 (2026-07-10) — sns 제거 + 채널별 등급·표기 등급(연동 채널 중 최고) 재계산.
// 해제 후 해당 채널 캠페인에는 새로 참여할 수 없다(연동 필요 상태 복귀 — 원래 허용된 3가지 참여 조건 중 하나).
// 진행 중인 체험권·이력은 유지된다(참여 시점 등급이 패스에 스냅샷됨).
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "reviewer") {
    return NextResponse.json({ error: "체험자 로그인 필요" }, { status: 401 });
  }
  const { kind } = await req.json();
  if (typeof kind !== "string" || !isSnsKind(kind)) {
    return NextResponse.json({ error: "지원하지 않는 채널입니다" }, { status: 400 });
  }
  const db = await getDBAsync();
  const applied = applySnsDisconnect(db, s.userId, kind);
  if (!applied.ok) return NextResponse.json({ error: applied.error }, { status: 400 });
  await saveDBAsync();
  const me = db.reviewers.find((r) => r.id === s.userId)!;
  // 인스턴스 불일치 스톱갭 — 본인 시점 즉시 반영 (sns-cookie.ts)
  await writeSnsState(me.id, me.sns);
  return NextResponse.json({ ok: true, grade: me.grade, channelGrades: me.channelGrades });
}
