import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { isSnsKind } from "@/lib/sns-oauth";
import { armBioCode, BIO_CODE_RE, BIO_CODE_TTL_SECONDS } from "@/lib/sns-bio-verify";

export const runtime = "nodejs";

// 인증 무장 (2026-07-25 연결 개편 §1 · 2026-07-28 UI 트리거 = [복사]) — 발급된
// 인증코드를 서명 쿠키로 무장.
// 여기서부터 30분 카운팅이 시작되고, 화면의 SNS 주소 입력이 활성화된다.
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "reviewer") {
    return NextResponse.json({ error: "체험자 로그인 필요" }, { status: 401 });
  }
  const { kind, code } = await req.json().catch(() => ({}));
  if (typeof kind !== "string" || !isSnsKind(kind)) {
    return NextResponse.json({ error: "지원하지 않는 채널입니다" }, { status: 400 });
  }
  if (typeof code !== "string" || !BIO_CODE_RE.test(code)) {
    return NextResponse.json({ error: "인증코드가 올바르지 않아요 — 시트를 다시 열어주세요" }, { status: 400 });
  }
  const expiresAt = await armBioCode(kind, code);
  return NextResponse.json({ ok: true, expiresAt, ttlSeconds: BIO_CODE_TTL_SECONDS });
}
