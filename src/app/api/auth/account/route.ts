import { NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession, destroySession } from "@/lib/auth";
import { restoreQuotaSlot } from "@/lib/pass-lifecycle";
import { closeCampaign } from "@/lib/campaign-close";
import { passRefNo } from "@/lib/owner-review-status";
import { fmtReservationLabel } from "@/lib/reservation";
import { rid } from "@/lib/ids";

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
    // 진행 중인 체험권(예약 포함) 일괄 취소 + 모집 슬롯 즉시 복구 (2026-08-18 —
    // 구현 전에는 스윕 만료까지 슬롯이 잠겨 있었다. 탈퇴 화면에서 사전 고지)
    // 2026-09-07 탈퇴 정합: ①취소 경위(account_deleted) 기록 + 사장님 통보(확정 예약이
    // 소리 없이 사라지던 누수 봉합 — 익명 원칙: 체험권 번호로 구분) ②작성 대기(used)·
    // 반려(rejected) 건은 종결 처리(스윕 리마인드·기한 초과 알림 중단 — 더 진행 불가)
    // ③검수 중(review_submitted)은 유지 — 리뷰는 이미 게시됨(사장님 보호), 고아 원장은
    // decide의 탈퇴 가드가 차단.
    const now = Date.now();
    for (const p of db.passes) {
      if (p.reviewerId !== s.userId) continue;
      if (p.status === "active") {
        p.status = "cancelled";
        p.cancelledAt = now;
        p.cancelledVia = "account_deleted";
        restoreQuotaSlot(db, p);
        if (db.owners.some((o) => o.id === p.ownerId)) {
          db.notifications.push({
            id: rid("nt"),
            userId: p.ownerId,
            role: "owner",
            title: "체험권 취소 (체험자 사정)",
            body: `체험자 사정으로 체험권 ${passRefNo(p.id)}${
              p.reservation?.date ? ` (예약 ${fmtReservationLabel(p.reservation.date, p.reservation.time)})` : ""
            }이 취소되었습니다. 모집 슬롯은 복구되었어요.`,
            createdAt: now,
            read: false,
            link: "/o/home",
          });
        }
      } else if (p.status === "used" || p.status === "rejected") {
        p.overdueHandled = true;
        p.reviewDueSoonNotified = true;
        p.resubmitDueSoonNotified = true;
        p.resubmitOverdueNotified = true;
      }
    }
  } else {
    const idx = db.owners.findIndex((o) => o.id === s.userId);
    if (idx === -1) return NextResponse.json({ error: "계정을 찾을 수 없습니다" }, { status: 404 });
    db.owners.splice(idx, 1);
    const myStoreIds = new Set(db.stores.filter((x) => x.ownerId === s.userId).map((x) => x.id));
    const now = Date.now();
    // 2026-09-07 탈퇴 정합 — 사용 처리 주체(사장님)가 사라지므로 active 패스(확정 예약·발급
    // QR 포함)를 전부 무패널티 취소하고 체험자에게 통보한다. 구현 전에는 endAt만 당겨
    // 미확정 예약이 무통보 방치되고 확정 QR이 좌초 → 만료 노쇼 감점으로 전가되던 누수.
    for (const p of db.passes) {
      if (p.ownerId !== s.userId || p.status !== "active") continue;
      const store = db.stores.find((x) => x.id === p.storeId);
      p.status = "cancelled";
      p.cancelledAt = now;
      p.cancelledVia = "owner_deleted";
      restoreQuotaSlot(db, p);
      db.notifications.push({
        id: rid("nt"),
        userId: p.reviewerId,
        role: "reviewer",
        title: "체험권 취소 (매장 운영 중단)",
        body: `${store?.name ?? "매장"} 매장 운영이 중단되어 체험권이 취소되었습니다. 페널티나 재신청 제한은 없어요.`,
        createdAt: now,
        read: false,
        link: "/r/passes", // 종착 상태 → 리스트 (링크 원칙 2026-08-30)
      });
    }
    // 진행 중 캠페인 — 종료 정본(closeCampaign) 경유: closedAt/closedBy 기록.
    // 미확정 예약·생존 건 처리는 위에서 이미 전부 취소했으므로 캠페인 쪽 루프는 무동작.
    for (const c of db.campaigns) {
      if (myStoreIds.has(c.storeId) && c.endAt > now) closeCampaign(db, c, "owner", now);
    }
  }

  // 개인 알림·미사용 보상·푸시 구독 삭제 (미사용 리필권도 소멸 — 탈퇴 화면 사전 고지)
  db.notifications = db.notifications.filter((n) => n.userId !== s.userId);
  if (db.rewards) db.rewards = db.rewards.filter((r) => r.ownerUserId !== s.userId || !!r.usedAt);
  if (db.pushSubs) db.pushSubs = db.pushSubs.filter((p) => p.userId !== s.userId);
  if (db.limitRefills) db.limitRefills = db.limitRefills.filter((r) => r.ownerId !== s.userId || !!r.usedAt);

  await saveDBAsync();
  await destroySession();
  return NextResponse.json({ ok: true });
}
