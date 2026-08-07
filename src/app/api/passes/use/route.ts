import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid, normalizePassCode } from "@/lib/ids";
import { supportForGrade, receiptSupportFor } from "@/lib/grade";
import { findSupportBoost, boostedLimit } from "@/lib/referral";
import { expirePass } from "@/lib/pass-lifecycle";

export const runtime = "nodejs";

// 사장님이 QR 스캔 → 결제 금액 입력 → 사용 처리
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const { code, paidAmount } = await req.json();
  const norm = normalizePassCode(String(code || ""));
  const db = await getDBAsync();
  const pass = db.passes.find((p) => normalizePassCode(p.code) === norm);
  if (!pass) return NextResponse.json({ error: "유효하지 않은 체험권 코드입니다" }, { status: 404 });
  if (pass.ownerId !== s.userId) return NextResponse.json({ error: "다른 매장의 체험권입니다" }, { status: 403 });
  if (pass.status === "used" || pass.status === "review_submitted" || pass.status === "completed") {
    return NextResponse.json({ error: "이미 사용 처리된 체험권입니다" }, { status: 400 });
  }
  if (pass.status !== "active") return NextResponse.json({ error: "사용할 수 없는 체험권입니다" }, { status: 400 });
  if (Date.now() > pass.expiresAt) {
    // 즉석 만료 — 스윕과 동일 정본(expirePass: 슬롯 복구·노쇼 카운트·양측 알림) 공유 (2026-08-05 D7)
    expirePass(db, pass);
    await saveDBAsync();
    return NextResponse.json({ error: "만료된 체험권입니다" }, { status: 400 });
  }
  // 예약형 (2026-07-16 v2) — 예약 확정 전에는 사용 처리 불가 (확정 전 QR 미노출과 동일 기준)
  if (pass.reservation && pass.reservation.status !== "confirmed") {
    return NextResponse.json({ error: "예약이 확정되지 않은 체험권입니다 — 예약 확인 후 사용해주세요" }, { status: 400 });
  }
  const c = db.campaigns.find((x) => x.id === pass.campaignId);
  const paid = Math.max(0, Number(paidAmount) || 0);
  let support: number;
  if (pass.receiptReview) {
    // 영수증 리뷰 (2026-08-07 정정) — 할인 = 결제 금액의 10% (정액 아님 · 상한 = 기준 지원금 P2).
    // 결제액 기반 산정이라 결제 금액 입력이 필수이며, 정액 한도 개념인 초대 부스트는 미적용.
    if (paid <= 0) {
      return NextResponse.json(
        { error: "결제 금액을 입력해주세요 — 영수증 리뷰는 결제 금액의 10%가 할인돼요" },
        { status: 400 },
      );
    }
    support = receiptSupportFor(paid, c?.supportAmount || 0);
  } else {
    // 지원금 한도 = 기준 지원금 × 채널 등급 배율 (v2.16)
    const baseLimit = supportForGrade(c?.supportAmount || 0, pass.reviewerGrade);
    // 초대 보상(지원금 부스트) 자동 적용 — 기준 지원금(S등급 100%)을 넘지 않는 선에서 가산.
    // 부스트가 실제 이득을 준 경우에만 보상을 소진한다.
    const boost = findSupportBoost(db, pass.reviewerId);
    const limit = boost ? boostedLimit(c?.supportAmount || 0, baseLimit, boost.value) : baseLimit;
    support = Math.min(paid, limit);
    if (boost && support > baseLimit) {
      boost.usedAt = Date.now();
      pass.supportBoostPct = boost.value;
      pass.boostRewardId = boost.id;
    }
  }
  pass.paidAmount = paid;
  pass.supportApplied = support;
  pass.usedAt = Date.now();
  pass.status = "used";
  db.notifications.push({
    id: rid("nt"),
    userId: pass.reviewerId,
    role: "reviewer",
    title: "체험권 사용 처리",
    body: `결제 ${paid.toLocaleString()}원 · 지원 ${support.toLocaleString()}원 적용. 리뷰를 작성해주세요.`,
    createdAt: Date.now(),
    read: false,
    link: `/r/passes/${pass.id}`,
  });
  await saveDBAsync();
  return NextResponse.json({ ok: true, support });
}
