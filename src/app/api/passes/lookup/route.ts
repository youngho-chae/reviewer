import { NextRequest, NextResponse } from "next/server";
import { getDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { normalizePassCode, isUseCode, normalizeUseCode } from "@/lib/ids";
import type { Pass } from "@/lib/types";

export const runtime = "nodejs";

// 사장님이 코드로 패스 조회 (스캔 결과 화면용)
// 두 가지 입력 지원:
//  - code: QR 스캔 시 인코딩된 8자 고유 패스 코드 → 해당 패스 직접 조회
//  - code가 4자리 숫자면: 캠페인 사용처리 코드(useCode)로 간주 →
//    사장님의 캠페인 중 일치하는 활성 체험권을 조회 (가장 최근 발급분)
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const { code } = await req.json();
  const raw = String(code || "").trim();
  const db = await getDBAsync();

  let pass: Pass | undefined;

  if (isUseCode(raw)) {
    // 4자리 캠페인 사용처리 코드로 조회
    const useCode = normalizeUseCode(raw);
    const ownerCampaignIds = new Set(
      db.campaigns.filter((c) => c.useCode === useCode).map((c) => c.id),
    );
    // 이 사장님 소유 + active 상태인 체험권 중 가장 최근 발급분
    const candidates = db.passes
      .filter((p) => p.ownerId === s.userId && ownerCampaignIds.has(p.campaignId) && p.status === "active")
      .sort((a, b) => b.issuedAt - a.issuedAt);
    if (candidates.length === 0) {
      // active가 없으면 동일 코드의 임의 상태 패스라도 찾아 상태 안내
      pass = db.passes
        .filter((p) => p.ownerId === s.userId && ownerCampaignIds.has(p.campaignId))
        .sort((a, b) => b.issuedAt - a.issuedAt)[0];
      if (!pass) {
        return NextResponse.json({ error: "해당 코드로 사용 대기 중인 체험권이 없습니다" }, { status: 404 });
      }
    } else {
      pass = candidates[0];
    }
  } else {
    // 8자 고유 패스 코드 (QR)
    const norm = normalizePassCode(raw);
    pass = db.passes.find((p) => normalizePassCode(p.code) === norm);
    if (!pass) return NextResponse.json({ error: "유효하지 않은 코드" }, { status: 404 });
    if (pass.ownerId !== s.userId) return NextResponse.json({ error: "다른 매장의 체험권" }, { status: 403 });
  }

  const reviewer = db.reviewers.find((r) => r.id === pass!.reviewerId);
  const campaign = db.campaigns.find((c) => c.id === pass!.campaignId);
  return NextResponse.json({
    pass,
    reviewer: reviewer ? { nickname: reviewer.nickname, grade: reviewer.grade } : null,
    campaign: campaign ? { title: campaign.title, supportAmount: campaign.supportAmount, useCode: campaign.useCode } : null,
  });
}
