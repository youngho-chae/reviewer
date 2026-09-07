import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { logAdminAction } from "@/lib/admin-audit";

export const runtime = "nodejs";

// 노쇼 카운트 정정 (2026-09-07 감사 개편) — 매장 귀책 만료(사장님 탈퇴·폐업·미스캔)가
// 귀책 구분 없이 체험자 노쇼 +1로 확정되고 교정 수단이 없던 공백의 봉합.
// 등급 자체는 수동 조정하지 않는다 (산식 정본 원칙 — 노쇼 정정분은 다음 월간 재평가의
// 패널티 집계에 자연 반영). 감사 로그 필수.
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "운영팀 로그인 필요" }, { status: 401 });
  const { reviewerId, noShowDelta, reason } = await req.json();
  const cleanReason = String(reason || "").trim().slice(0, 300);
  if (!cleanReason) return NextResponse.json({ error: "정정 사유를 입력해주세요" }, { status: 400 });
  const delta = Number(noShowDelta);
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 10) {
    return NextResponse.json({ error: "noShowDelta는 ±1~10 정수여야 합니다" }, { status: 400 });
  }

  const db = await getDBAsync();
  const rv = db.reviewers.find((r) => r.id === String(reviewerId || ""));
  if (!rv) return NextResponse.json({ error: "체험자를 찾을 수 없습니다" }, { status: 404 });
  const before = rv.noShowCount;
  rv.noShowCount = Math.max(0, rv.noShowCount + delta);
  logAdminAction(db, s, "reviewer_noshow_adjust", "reviewer", rv.id, `${before} → ${rv.noShowCount} · ${cleanReason}`);
  await saveDBAsync();
  return NextResponse.json({ ok: true, noShowCount: rv.noShowCount });
}
