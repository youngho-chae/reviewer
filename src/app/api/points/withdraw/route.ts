import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import { WithdrawalRequest } from "@/lib/types";
import { appendPointTxn, pointBalance, quoteWithdrawal, validateWithdrawalAmount } from "@/lib/points";

export const runtime = "nodejs";

// 포인트 출금 신청 (2026-07-12 레뷰 벤치마크 — 운영정책서 §14).
// 신청 즉시 포인트를 차감하고(이중 신청 방지), 세액·수수료·실지급액을 신청 시점에 확정 보존한다.
// 지급/반려는 운영팀 단일 책임 — /admin/points 큐에서 처리 (반려 시 전액 복구).
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "reviewer") return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const body = await req.json();
  const amountPoints = Number(body.amount);
  const bank = String(body.bank || "").trim().slice(0, 20);
  const account = String(body.account || "").trim().slice(0, 30);
  const holder = String(body.holder || "").trim().slice(0, 30);
  if (!bank || !account || !holder) {
    return NextResponse.json({ error: "입금 계좌 정보(은행·계좌번호·예금주)를 입력해주세요" }, { status: 400 });
  }

  const db = await getDBAsync();
  const me = db.reviewers.find((r) => r.id === s.userId);
  if (!me) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const balance = pointBalance(db, me.id);
  const invalid = validateWithdrawalAmount(amountPoints, balance);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const quote = quoteWithdrawal(amountPoints);
  const now = Date.now();
  const withdrawal: WithdrawalRequest = {
    id: rid("wd"),
    reviewerId: me.id,
    amountPoints,
    incomeType: "business", // 계속·반복 리뷰 활동 — 사업소득 3.3% 원천징수 (운영정책서 §14)
    taxWithheld: quote.taxWithheld,
    fee: quote.fee,
    payout: quote.payout,
    bank,
    account,
    holder,
    status: "requested",
    requestedAt: now,
  };
  if (!db.withdrawals) db.withdrawals = [];
  db.withdrawals.push(withdrawal);
  appendPointTxn(db, {
    reviewerId: me.id,
    type: "withdraw",
    amount: -amountPoints,
    refWithdrawalId: withdrawal.id,
    memo: `출금 신청 (${bank} · 실지급 ${quote.payout.toLocaleString()}원)`,
  });

  await saveDBAsync();
  return NextResponse.json({ ok: true, withdrawalId: withdrawal.id, quote });
}
