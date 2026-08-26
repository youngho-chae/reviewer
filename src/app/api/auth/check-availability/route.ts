import { NextRequest, NextResponse } from "next/server";
import { getDBAsync } from "@/lib/db";

export const runtime = "nodejs";

// 가입 중복 확인 (2026-08-18) — 가입 폼이 이메일·닉네임의 사용 가능 여부를 조회한다.
// role: "reviewer"(기본) | "owner" — 이메일 풀 선택 (계정은 역할별 분리). 닉네임은 체험자 전용.
// 게스트 접근 가능(가입 전) — 응답은 가용 여부 boolean만 (계정 존재 이상의 정보 비노출).
// 최종 검증은 signup API의 409가 정본 (폼 확인은 UX 보조).
export async function POST(req: NextRequest) {
  const { field, value, role } = await req.json().catch(() => ({}));
  const v = String(value || "").trim();
  if (!v) return NextResponse.json({ error: "값을 입력해주세요" }, { status: 400 });
  const db = await getDBAsync();

  if (field === "email") {
    const email = v.toLowerCase();
    const taken =
      role === "owner" ? db.owners.some((o) => o.email === email) : db.reviewers.some((r) => r.email === email);
    return NextResponse.json({ available: !taken });
  }
  if (field === "nickname") {
    const nick = v.toLowerCase();
    return NextResponse.json({
      available: !db.reviewers.some((r) => (r.nickname || "").trim().toLowerCase() === nick),
    });
  }
  return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
}
