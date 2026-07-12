import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid, normalizeUseCode } from "@/lib/ids";
import { supportForGrade } from "@/lib/grade";
import { findSupportBoost, boostedLimit } from "@/lib/referral";

export const runtime = "nodejs";

// 4자리 코드 오입력 가드 — 연속 5회 실패 시 10분 잠금 (0000~9999 브루트포스 방지).
const CODE_MAX_ATTEMPTS = 5;
const CODE_LOCK_MS = 10 * 60 * 1000;

// 체험권 화면(체험자 세션)에서 사장님이 캠페인 4자리 코드를 직접 입력해 사용 처리.
// 코드는 화면에 노출되지 않으므로, 올바른 4자리 입력 = 사장님 확인으로 간주.
// [불변] 인증 실패 경로에서 체험권 상태는 변경하지 않는다 — 유일한 예외는
// 기한 경과 시 expired 전이(정당한 라이프사이클 전이)뿐이다.
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "reviewer") {
    return NextResponse.json({ error: "체험자 로그인 필요" }, { status: 401 });
  }
  const { passId, code, paidAmount } = await req.json();
  const db = await getDBAsync();

  const pass = db.passes.find((p) => p.id === String(passId || ""));
  if (!pass) return NextResponse.json({ error: "체험권을 찾을 수 없습니다" }, { status: 404 });
  if (pass.reviewerId !== s.userId) {
    return NextResponse.json({ error: "본인의 체험권이 아닙니다" }, { status: 403 });
  }
  if (pass.status === "used" || pass.status === "review_submitted" || pass.status === "completed") {
    return NextResponse.json({ error: "이미 사용 처리된 체험권입니다" }, { status: 400 });
  }
  if (pass.status !== "active") {
    return NextResponse.json({ error: "사용할 수 없는 체험권입니다" }, { status: 400 });
  }
  if (Date.now() > pass.expiresAt) {
    pass.status = "expired";
    await saveDBAsync();
    return NextResponse.json({ error: "만료된 체험권입니다" }, { status: 400 });
  }

  const campaign = db.campaigns.find((c) => c.id === pass.campaignId);
  if (!campaign) return NextResponse.json({ error: "캠페인 정보를 찾을 수 없습니다" }, { status: 400 });

  // 잠금 중이면 코드 대조 자체를 거부 (정답 입력도 차단)
  const now = Date.now();
  if (pass.useCodeLockUntil && pass.useCodeLockUntil > now) {
    const leftMin = Math.max(1, Math.ceil((pass.useCodeLockUntil - now) / 60000));
    return NextResponse.json(
      { error: `코드를 연속 ${CODE_MAX_ATTEMPTS}회 잘못 입력해 잠시 잠겼어요. 약 ${leftMin}분 후 다시 시도해주세요.` },
      { status: 400 },
    );
  }

  const entered = normalizeUseCode(String(code || ""));
  if (entered.length !== 4 || entered !== campaign.useCode) {
    const fails = (pass.useCodeFailCount ?? 0) + 1;
    if (fails >= CODE_MAX_ATTEMPTS) {
      pass.useCodeFailCount = 0;
      pass.useCodeLockUntil = now + CODE_LOCK_MS;
      await saveDBAsync(); // 실패 카운트/잠금도 영속 — 새로고침 우회 방지
      return NextResponse.json(
        { error: `코드를 연속 ${CODE_MAX_ATTEMPTS}회 잘못 입력해 잠시 잠겼어요. 약 ${Math.ceil(CODE_LOCK_MS / 60000)}분 후 다시 시도해주세요.` },
        { status: 400 },
      );
    }
    pass.useCodeFailCount = fails;
    await saveDBAsync();
    return NextResponse.json(
      { error: `사용처리 코드가 일치하지 않습니다 (남은 시도 ${CODE_MAX_ATTEMPTS - fails}회)` },
      { status: 400 },
    );
  }
  // 성공 — 실패 카운트/잠금 리셋
  pass.useCodeFailCount = 0;
  pass.useCodeLockUntil = undefined;

  // 지원금 한도 = 기준 지원금 × 채널 등급 배율 (v2.16)
  const baseLimit = supportForGrade(campaign.supportAmount || 0, pass.reviewerGrade);
  // 초대 보상(지원금 부스트) 자동 적용 — 기준 지원금(S등급 100%)을 넘지 않는 선에서 가산
  const boost = findSupportBoost(db, pass.reviewerId);
  const support = boost ? boostedLimit(campaign.supportAmount || 0, baseLimit, boost.value) : baseLimit;
  const paid = paidAmount === undefined || paidAmount === null || paidAmount === ""
    ? support
    : Math.max(0, Number(paidAmount) || 0);
  const applied = Math.min(paid, support);
  // 부스트가 실제 이득을 준 경우에만 보상 소진
  if (boost && applied > baseLimit) {
    boost.usedAt = Date.now();
    pass.supportBoostPct = boost.value;
    pass.boostRewardId = boost.id;
  }

  pass.paidAmount = paid;
  pass.supportApplied = applied;
  pass.usedAt = Date.now();
  pass.status = "used";

  db.notifications.push({
    id: rid("nt"),
    userId: pass.reviewerId,
    role: "reviewer",
    title: "체험권 사용 처리",
    body: `결제 ${paid.toLocaleString()}원 · 지원 ${applied.toLocaleString()}원 적용. 리뷰를 작성해주세요.`,
    createdAt: Date.now(),
    read: false,
    link: `/r/passes/${pass.id}`,
  });

  await saveDBAsync();
  return NextResponse.json({ ok: true, support: applied });
}
