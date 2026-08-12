import { NextRequest, NextResponse } from "next/server";
import { getDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { passRefNo } from "@/lib/owner-review-status";
import { normalizePassCode, isUseCode, normalizeUseCode } from "@/lib/ids";
import { supportForGrade } from "@/lib/grade";
import { findSupportBoost, boostedLimit } from "@/lib/referral";
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

  const campaign = db.campaigns.find((c) => c.id === pass!.campaignId);
  // 이 체험권의 실제 지원금 한도 (2026-08-11 — 스캔 화면 표기 버그 수정: 구 화면은
  // campaign.supportAmount(기준 지원금 = S 100%)를 그대로 보여줘 C 40% 체험자도
  // 최대 범위가 표기됐다). use API와 동일 산정: 등급 배율 + 초대 부스트(한도 = 기준 지원금).
  // 영수증 리뷰는 정액 한도가 아니라 결제액의 10%라 null (상한만 기준 지원금).
  let entitledSupport: number | null = null;
  if (!pass!.receiptReview) {
    const baseLimit = supportForGrade(campaign?.supportAmount || 0, pass!.reviewerGrade);
    const boost = findSupportBoost(db, pass!.reviewerId);
    entitledSupport = boost ? boostedLimit(campaign?.supportAmount || 0, baseLimit, boost.value) : baseLimit;
  }
  return NextResponse.json({
    pass,
    // [2026-07-31 §4-5] 체험자 식별정보(익명 ID 포함)를 사장님에게 전송하지 않는다 —
    // 개별 건 구분은 체험권 번호(거래 단위)로 한다
    passNo: passRefNo(pass!.id),
    entitledSupport,
    campaign: campaign ? { title: campaign.title, supportAmount: campaign.supportAmount, useCode: campaign.useCode } : null,
  });
}
