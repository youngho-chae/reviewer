import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";

export const runtime = "nodejs";

// 프로필 사진 업로드 (2026-08-05 — 체험자 마이페이지 아바타 꾸미기).
// 클라이언트가 240px JPEG dataURL로 리사이즈해 전달 — 본인 마이페이지 전용 표시.
const MAX_DATA_URL = 400_000; // ≈300KB — 240px JPEG면 충분, DB 비대화 방지

export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "reviewer") return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const { image } = await req.json();
  const db = await getDBAsync();
  const me = db.reviewers.find((r) => r.id === s.userId);
  if (!me) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const img = String(image || "");
  if (!img.startsWith("data:image/")) {
    return NextResponse.json({ error: "이미지 파일을 선택해주세요" }, { status: 400 });
  }
  if (img.length > MAX_DATA_URL) {
    return NextResponse.json({ error: "이미지가 너무 커요 — 다시 시도해주세요" }, { status: 400 });
  }
  me.profileImage = img;
  await saveDBAsync();
  return NextResponse.json({ ok: true });
}
