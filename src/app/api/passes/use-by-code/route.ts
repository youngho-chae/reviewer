import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid, normalizeUseCode } from "@/lib/ids";

export const runtime = "nodejs";

// 체험권 화면(체험자 세션)에서 사장님이 캠페인 4자리 코드를 직접 입력해 사용 처리.
// 코드는 화면에 노출되지 않으므로, 올바른 4자리 입력 = 사장님 확인으로 간주.
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

  const entered = normalizeUseCode(String(code || ""));
  if (entered.length !== 4 || entered !== campaign.useCode) {
    return NextResponse.json({ error: "사용처리 코드가 일치하지 않습니다" }, { status: 400 });
  }

  // 결제 금액 — 미입력 시 지원금 한도를 그대로 적용
  const support = campaign.supportAmount || 0;
  const paid = paidAmount === undefined || paidAmount === null || paidAmount === ""
    ? support
    : Math.max(0, Number(paidAmount) || 0);
  const applied = Math.min(paid, support);

  pass.paidAmount = paid;
  pass.supportApplied = applied;
  pass.usedAt = Date.now();
  pass.status = "used";

  db.notifications.push({
    id: rid("nt"),
    userId: pass.reviewerId,
    role: "reviewer",
    title: "체험권 사용 처리",
    body: `결제 ₩${paid.toLocaleString()} · 지원 ₩${applied.toLocaleString()} 적용. 리뷰를 작성해주세요.`,
    createdAt: Date.now(),
    read: false,
    link: `/r/passes/${pass.id}`,
  });

  await saveDBAsync();
  return NextResponse.json({ ok: true, support: applied });
}
