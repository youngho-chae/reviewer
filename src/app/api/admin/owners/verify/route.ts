import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import { logAdminAction } from "@/lib/admin-audit";

export const runtime = "nodejs";

// 사업자 인증 완료 처리 (확정 정책 9 — 운영팀 수기 인증).
// pending → verified 전환 + 사장님 알림. "인증된 사장님" 권한 부여 지점.
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "admin") {
    return NextResponse.json({ error: "운영팀 로그인 필요" }, { status: 401 });
  }
  const { ownerId, action } = await req.json();
  const db = await getDBAsync();
  const owner = db.owners.find((o) => o.id === String(ownerId || ""));
  if (!owner) return NextResponse.json({ error: "사장님 계정을 찾을 수 없습니다" }, { status: 404 });

  // 인증 회수 (2026-09-07 감사 개편) — 즉시 승인 체계의 오승인·데모 통과·타인 번호 도용을
  // 되돌릴 단방향 공백 봉합. pending 복귀 → /o/* 접근이 다시 인증 대기 화면으로 게이트된다.
  if (action === "revoke") {
    if (owner.bizStatus !== "verified") return NextResponse.json({ error: "인증 완료 상태가 아닙니다" }, { status: 400 });
    owner.bizStatus = "pending";
    delete owner.bizVerifiedAt;
    delete owner.bizVerifiedVia;
    delete owner.bizNumber; // 재제출부터 다시 — 대기 화면이 BizInfoForm을 렌더하도록
    db.notifications.push({
      id: rid("nt"),
      userId: owner.id,
      role: "owner",
      title: "사업자 인증 확인 필요",
      body: "사업자 정보 재확인이 필요해 인증이 일시 해제되었습니다. 사업장명과 사업자등록번호를 다시 제출해주세요 — 자세한 내용은 고객센터로 문의해주세요.",
      createdAt: Date.now(),
      read: false,
      link: "/o/home",
    });
    logAdminAction(db, s, "owner_verify_revoke", "owner", owner.id);
    await saveDBAsync();
    return NextResponse.json({ ok: true, bizStatus: "pending" });
  }

  if (owner.bizStatus === "verified") {
    return NextResponse.json({ ok: true, already: true });
  }

  owner.bizStatus = "verified";
  owner.bizVerifiedAt = Date.now();
  owner.bizVerifiedVia = "admin"; // 운영팀 수기 승인 (2026-09-07 — 인증 경로 표기)
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
  logAdminAction(db, s, "owner_verify", "owner", owner.id);
  await saveDBAsync();
  return NextResponse.json({ ok: true });
}
