import { NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession, destroySession } from "@/lib/auth";

export const runtime = "nodejs";

// 회원 탈퇴 — 개인정보보호법상 파기 의무 이행.
//  - 계정(이메일/비밀번호/닉네임/SNS 정보)과 알림·미사용 보상을 즉시 삭제한다.
//  - 체험권(거래 기록)은 전자상거래법 보존 의무에 따라 유지하되, 계정 삭제로 개인 식별 정보와 분리된다.
//  - 사장님 탈퇴 시 진행 중 캠페인은 모집 종료 처리(발급된 체험권의 사용·리뷰는 정상 진행).
export async function DELETE() {
  const s = await readSession();
  if (!s || (s.role !== "reviewer" && s.role !== "owner")) {
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  }
  const db = await getDBAsync();

  if (s.role === "reviewer") {
    const idx = db.reviewers.findIndex((r) => r.id === s.userId);
    if (idx === -1) return NextResponse.json({ error: "계정을 찾을 수 없습니다" }, { status: 404 });
    db.reviewers.splice(idx, 1);
  } else {
    const idx = db.owners.findIndex((o) => o.id === s.userId);
    if (idx === -1) return NextResponse.json({ error: "계정을 찾을 수 없습니다" }, { status: 404 });
    db.owners.splice(idx, 1);
    // 소유 매장의 진행 중 캠페인 — 모집 즉시 종료 (이미 발급된 체험권은 정상 진행)
    const myStoreIds = new Set(db.stores.filter((x) => x.ownerId === s.userId).map((x) => x.id));
    const now = Date.now();
    for (const c of db.campaigns) {
      if (myStoreIds.has(c.storeId) && c.endAt > now) c.endAt = now;
    }
  }

  // 개인 알림·미사용 보상 삭제
  db.notifications = db.notifications.filter((n) => n.userId !== s.userId);
  if (db.rewards) db.rewards = db.rewards.filter((r) => r.ownerUserId !== s.userId || !!r.usedAt);

  await saveDBAsync();
  await destroySession();
  return NextResponse.json({ ok: true });
}
