import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import { restoreQuotaSlot, REVIEW_DEADLINE_MS } from "@/lib/pass-lifecycle";
import { supportForGrade, receiptSupportFor } from "@/lib/grade";
import { boostedLimit } from "@/lib/referral";
import { appendPointTxn, pointsForGrade } from "@/lib/points";
import { logAdminAction } from "@/lib/admin-audit";

export const runtime = "nodejs";

// 체험권 정정 API (2026-09-07 감사 개편 — 운영 개입 수단).
// 감사 결과 패스 상태는 전부 단방향이라 오사용 처리·오승인/오반려·재제출 소진이 영구 확정되고,
// CS 안내("고객센터로 문의해주세요")에 대응하는 도구가 없었다. 유일한 정정 수단이
// KV 전체 롤백이던 구조적 공백의 봉합 — 전 액션 감사 로그(adminActions) 기록.
//
// action:
//  - fix_amount     : used 이후 결제액 정정 — supportApplied 재계산 (use API와 동일 산식)
//  - revert_use     : used → active 복귀 (사용 기록 소거·부스트 복원, 기한 경과 시 24h 연장)
//  - reopen_review  : completed/rejected → review_submitted (검수 재개 — 승인 부수 효과 상쇄)
//  - allow_resubmit : rejected 재제출 소진/기한 초과 구제 — 횟수 리셋 + 기한 재시작 + 알림
//  - force_cancel   : active 강제 취소 (예약 유무 무관 — 오발급·중복 무효화, 무패널티·슬롯 복구)
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "운영팀 로그인 필요" }, { status: 401 });
  const { passId, action, paidAmount, reason } = await req.json();
  const cleanReason = String(reason || "").trim().slice(0, 300);
  if (!cleanReason) return NextResponse.json({ error: "정정 사유를 입력해주세요" }, { status: 400 });

  const db = await getDBAsync();
  const pass = db.passes.find((p) => p.id === String(passId || ""));
  if (!pass) return NextResponse.json({ error: "체험권을 찾을 수 없습니다" }, { status: 404 });
  const c = db.campaigns.find((x) => x.id === pass.campaignId);
  const store = db.stores.find((x) => x.id === pass.storeId);
  const storeName = store?.name ?? "매장";
  const reviewer = db.reviewers.find((r) => r.id === pass.reviewerId);
  const now = Date.now();

  const notifyReviewer = (title: string, body: string, link: string) => {
    if (!reviewer) return; // 탈퇴 회원 — 고아 알림 방지 (PR① 가드와 동일 원칙)
    db.notifications.push({ id: rid("nt"), userId: pass.reviewerId, role: "reviewer", title, body, createdAt: now, read: false, link });
  };
  const notifyOwner = (title: string, body: string) => {
    if (!db.owners.some((o) => o.id === pass.ownerId)) return;
    db.notifications.push({ id: rid("nt"), userId: pass.ownerId, role: "owner", title, body, createdAt: now, read: false, link: "/o/home" });
  };

  if (action === "fix_amount") {
    // 결제액 정정 — used 이후 상태(used/review_submitted/completed/rejected)에서 허용.
    // W 상생지수·상생 매출의 입력값이라 오입력이 등급으로 전이되던 결함의 정정 경로.
    if (!pass.usedAt) return NextResponse.json({ error: "사용 처리 전 체험권은 결제액이 없습니다" }, { status: 400 });
    const paid = Math.max(0, Number(paidAmount) || 0);
    if (paidAmount === undefined || paidAmount === null || paidAmount === "") {
      return NextResponse.json({ error: "정정할 결제 금액을 입력해주세요" }, { status: 400 });
    }
    if (pass.receiptReview && paid <= 0) {
      return NextResponse.json({ error: "영수증 리뷰는 결제 금액이 필요합니다" }, { status: 400 });
    }
    const before = `paid ${pass.paidAmount ?? "-"} / support ${pass.supportApplied ?? "-"}`;
    let support: number;
    if (pass.receiptReview) {
      support = receiptSupportFor(paid, c?.supportAmount || 0);
    } else {
      const baseLimit = supportForGrade(c?.supportAmount || 0, pass.reviewerGrade);
      // 사용 시점에 부스트가 적용됐던 건은 동일 한도로 재계산 (supportBoostPct 기록 기준)
      const limit = pass.supportBoostPct ? boostedLimit(c?.supportAmount || 0, baseLimit, pass.supportBoostPct) : baseLimit;
      support = Math.min(paid, limit);
    }
    pass.paidAmount = paid;
    pass.supportApplied = support;
    logAdminAction(db, s, "pass_fix_amount", "pass", pass.id, `${before} → paid ${paid} / support ${support} · ${cleanReason}`);
    await saveDBAsync();
    return NextResponse.json({ ok: true, paidAmount: paid, supportApplied: support });
  }

  if (action === "revert_use") {
    if (pass.status !== "used") return NextResponse.json({ error: "사용 처리(used) 상태만 되돌릴 수 있습니다" }, { status: 400 });
    pass.status = "active";
    delete pass.usedAt;
    delete pass.paidAmount;
    delete pass.supportApplied;
    // 사용 시점에 소진된 초대 부스트 복원
    if (pass.boostRewardId && db.rewards) {
      const rw = db.rewards.find((r) => r.id === pass.boostRewardId);
      if (rw) delete rw.usedAt;
    }
    delete pass.supportBoostPct;
    delete pass.boostRewardId;
    // 스윕 플래그 초기화 — 리마인드가 다시 정상 동작하도록
    pass.overdueHandled = false;
    pass.reviewDueSoonNotified = false;
    // 기한 경과 건은 즉시 재만료(스윕) 방지를 위해 24시간 연장
    if (pass.expiresAt <= now + 60 * 60 * 1000) pass.expiresAt = now + 24 * 60 * 60 * 1000;
    notifyReviewer("체험권 사용 처리 정정", `${storeName} 체험권의 사용 처리가 운영팀에 의해 취소되었습니다. 체험권을 다시 사용할 수 있어요.`, `/r/passes/${pass.id}`);
    notifyOwner("사용 처리 정정", `${storeName} 체험권 1건의 사용 처리가 운영팀에 의해 취소되었습니다.`);
    logAdminAction(db, s, "pass_revert_use", "pass", pass.id, cleanReason);
    await saveDBAsync();
    return NextResponse.json({ ok: true, status: pass.status });
  }

  if (action === "reopen_review") {
    if (pass.status !== "completed" && pass.status !== "rejected") {
      return NextResponse.json({ error: "검수 완료(completed) 또는 반려(rejected) 상태만 재개할 수 있습니다" }, { status: 400 });
    }
    const wasCompleted = pass.status === "completed";
    if (wasCompleted) {
      // 승인 부수 효과 상쇄 — 완료 카운트 감소 + 배송형 적립 상쇄 원장 (P4: 정정도 이벤트로 기록)
      if (reviewer && reviewer.completedReviews > 0) reviewer.completedReviews -= 1;
      if (reviewer && c?.kind === "delivery" && (c.pointReward ?? 0) > 0) {
        const points = pointsForGrade(c.pointReward as number, pass.reviewerGrade, reviewer.grade === "S+");
        if (points > 0) {
          appendPointTxn(db, { reviewerId: pass.reviewerId, type: "adjust", amount: -points, refPassId: pass.id, memo: `${storeName} 검수 재개 — 승인 적립 상쇄` });
        }
      }
      delete pass.completedAt;
    }
    pass.status = "review_submitted";
    pass.reviewStatus = "pending";
    notifyReviewer("리뷰 검수 재개", `${storeName} 리뷰가 운영팀에 의해 다시 검수 대기 상태가 되었어요. 결과를 다시 안내드릴게요.`, "/r/passes?tab=review");
    logAdminAction(db, s, wasCompleted ? "review_reopen_from_completed" : "review_reopen_from_rejected", "pass", pass.id, cleanReason);
    await saveDBAsync();
    return NextResponse.json({ ok: true, status: pass.status });
  }

  if (action === "allow_resubmit") {
    if (pass.status !== "rejected") return NextResponse.json({ error: "반려(rejected) 상태만 재제출을 허용할 수 있습니다" }, { status: 400 });
    pass.resubmitCount = 0;
    pass.rejectedAt = now; // 재제출 기한(반려 후 7일) 재시작
    pass.resubmitDueSoonNotified = false;
    pass.resubmitOverdueNotified = false;
    notifyReviewer(
      "리뷰 재제출 기한이 연장되었어요",
      `${storeName} 리뷰를 다시 제출할 수 있도록 재제출 기한이 연장되었습니다 (지금부터 7일). 수정 후 제출해주세요.`,
      `/r/passes/${pass.id}`,
    );
    logAdminAction(db, s, "pass_allow_resubmit", "pass", pass.id, cleanReason);
    await saveDBAsync();
    return NextResponse.json({ ok: true, resubmitDeadline: now + REVIEW_DEADLINE_MS });
  }

  if (action === "force_cancel") {
    // 기존 어드민 취소가 예약형(reservation 보유)에만 걸려 있어 방문형 오발급 무효화 경로가 없었다.
    if (pass.status !== "active") return NextResponse.json({ error: "진행 중(active) 체험권만 취소할 수 있습니다" }, { status: 400 });
    pass.status = "cancelled";
    pass.cancelledAt = now;
    pass.cancelledVia = "admin_cancelled"; // 무패널티 — 12h 쿨다운 판정(!cancelledVia)에 걸리지 않음
    restoreQuotaSlot(db, pass);
    notifyReviewer("체험권이 취소됐어요", `운영 정책에 따라 ${storeName} 체험권이 취소되었습니다. 재신청 제한은 없어요 — 자세한 내용은 고객센터로 문의해주세요.`, "/r/passes");
    notifyOwner("운영팀 체험권 취소", `${storeName} 체험권 1건이 운영팀에 의해 취소되었습니다. 모집 슬롯은 복구되었어요.`);
    logAdminAction(db, s, "pass_force_cancel", "pass", pass.id, cleanReason);
    await saveDBAsync();
    return NextResponse.json({ ok: true, status: pass.status });
  }

  return NextResponse.json({ error: "지원하지 않는 action" }, { status: 400 });
}
