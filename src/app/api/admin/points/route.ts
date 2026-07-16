import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import { appendPointTxn } from "@/lib/points";

export const runtime = "nodejs";

// 운영팀 출금 처리 (2026-07-12 레뷰 벤치마크) — requested → paid | rejected.
// paid: 실지급 완료 기록 (실서비스는 이 지점에서 이체·원천징수 신고 연동).
// rejected: 차감했던 포인트 전액 복구 (append-only 원장에 복구 트랜잭션 적재).
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "운영팀 로그인 필요" }, { status: 401 });
  const { withdrawalId, decision, reason } = await req.json();
  if (decision !== "paid" && decision !== "reject") {
    return NextResponse.json({ error: "decision은 paid 또는 reject" }, { status: 400 });
  }

  const db = await getDBAsync();
  const wd = (db.withdrawals ?? []).find((w) => w.id === String(withdrawalId || ""));
  if (!wd) return NextResponse.json({ error: "출금 신청을 찾을 수 없습니다" }, { status: 404 });
  if (wd.status !== "requested") {
    return NextResponse.json({ error: "대기 상태의 신청만 처리할 수 있습니다" }, { status: 400 });
  }

  const now = Date.now();
  if (decision === "paid") {
    wd.status = "paid";
    wd.processedAt = now;
    db.notifications.push({
      id: rid("nt"),
      userId: wd.reviewerId,
      role: "reviewer",
      title: "포인트 출금 완료 💸",
      body: `${wd.amountPoints.toLocaleString()}P 출금이 완료되었습니다. 세금 ${wd.taxWithheld.toLocaleString()}원·수수료 ${wd.fee.toLocaleString()}원을 제외한 ${wd.payout.toLocaleString()}원이 입금됩니다.`,
      createdAt: now,
      read: false,
      link: "/r/me/points",
    });
  } else {
    wd.status = "rejected";
    wd.processedAt = now;
    wd.rejectReason = String(reason || "").slice(0, 300) || "계좌 정보 확인 불가";
    appendPointTxn(db, {
      reviewerId: wd.reviewerId,
      type: "withdraw_refund",
      amount: wd.amountPoints,
      refWithdrawalId: wd.id,
      memo: `출금 반려 복구 (${wd.rejectReason})`,
    });
    db.notifications.push({
      id: rid("nt"),
      userId: wd.reviewerId,
      role: "reviewer",
      title: "포인트 출금 반려",
      body: `출금 신청이 반려되어 ${wd.amountPoints.toLocaleString()}P가 복구되었습니다. 사유: ${wd.rejectReason}`,
      createdAt: now,
      read: false,
      link: "/r/me/points",
    });
  }

  await saveDBAsync();
  return NextResponse.json({ ok: true, status: wd.status });
}
