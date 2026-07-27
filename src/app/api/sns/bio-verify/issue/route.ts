import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { isSnsKind } from "@/lib/sns-oauth";
import { newBioCode } from "@/lib/sns-bio-verify";

export const runtime = "nodejs";

// 계정 인증코드 발급 (2026-07-25 연결 개편 §1) — 연결 시트를 열 때 호출.
// 8자리 1회성 난수를 표시용으로 반환만 하고, 30분 유효 시작은 [인증하기](arm)에서.
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "reviewer") {
    return NextResponse.json({ error: "체험자 로그인 필요" }, { status: 401 });
  }
  const { kind } = await req.json().catch(() => ({}));
  if (typeof kind !== "string" || !isSnsKind(kind)) {
    return NextResponse.json({ error: "지원하지 않는 채널입니다" }, { status: 400 });
  }
  return NextResponse.json({ code: newBioCode() });
}
