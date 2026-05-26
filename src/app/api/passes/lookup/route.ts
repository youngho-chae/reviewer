import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { readSession } from "@/lib/auth";

export const runtime = "nodejs";

// 사장님이 코드로 패스 조회 (스캔 결과 화면용)
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const { code } = await req.json();
  const db = getDB();
  const pass = db.passes.find((p) => p.code === code);
  if (!pass) return NextResponse.json({ error: "유효하지 않은 코드" }, { status: 404 });
  if (pass.ownerId !== s.userId) return NextResponse.json({ error: "다른 매장의 체험권" }, { status: 403 });
  const reviewer = db.reviewers.find((r) => r.id === pass.reviewerId);
  const campaign = db.campaigns.find((c) => c.id === pass.campaignId);
  return NextResponse.json({
    pass,
    reviewer: reviewer ? { nickname: reviewer.nickname, grade: reviewer.grade } : null,
    campaign: campaign ? { title: campaign.title, supportAmount: campaign.supportAmount } : null,
  });
}
