import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid, normalizePassCode } from "@/lib/ids";

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
    pass.status = "expired";
    await saveDBAsync();
    return NextResponse.json({ error: "만료된 체험권입니다" }, { status: 400 });
  }
  const c = db.campaigns.find((x) => x.id === pass.campaignId);
  const paid = Math.max(0, Number(paidAmount) || 0);
  const support = Math.min(paid, c?.supportAmount || 0);
  pass.paidAmount = paid;
  pass.supportApplied = support;
  pass.usedAt = Date.now();
  pass.status = "used";
  db.notifications.push({
    id: rid("nt"),
    userId: pass.reviewerId,
    role: "reviewer",
    title: "체험권 사용 처리",
    body: `결제 ₩${paid.toLocaleString()} · 지원 ₩${support.toLocaleString()} 적용. 리뷰를 작성해주세요.`,
    createdAt: Date.now(),
    read: false,
    link: `/r/passes/${pass.id}`,
  });
  await saveDBAsync();
  return NextResponse.json({ ok: true, support });
}
