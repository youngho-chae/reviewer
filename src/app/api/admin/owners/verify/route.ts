import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";

export const runtime = "nodejs";

// 사업자 인증 완료 처리 (확정 정책 9 — 운영팀 수기 인증).
// pending → verified 전환 + 사장님 알림. "인증된 사장님" 권한 부여 지점.
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "admin") {
    return NextResponse.json({ error: "운영팀 로그인 필요" }, { status: 401 });
  }
  const { ownerId } = await req.json();
  const db = await getDBAsync();
  const owner = db.owners.find((o) => o.id === String(ownerId || ""));
  if (!owner) return NextResponse.json({ error: "사장님 계정을 찾을 수 없습니다" }, { status: 404 });
  if (owner.bizStatus === "verified") {
    return NextResponse.json({ ok: true, already: true });
  }

  owner.bizStatus = "verified";
  owner.bizVerifiedAt = Date.now();
  db.notifications.push({
    id: rid("nt"),
    userId: owner.id,
    role: "owner",
    title: "사업자 인증 완료 ✅",
    body: "사업자 정보 확인이 완료되었습니다. 지금부터 캠페인 생성 등 사장님 기능을 모두 이용할 수 있어요.",
    createdAt: Date.now(),
    read: false,
    link: "/o/home",
  });
  await saveDBAsync();
  return NextResponse.json({ ok: true });
}
