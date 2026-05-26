import { NextRequest, NextResponse } from "next/server";
import { getDB, saveDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const { passId, decision } = await req.json(); // decision: "approve" | "reject"
  const db = getDB();
  const pass = db.passes.find((p) => p.id === passId);
  if (!pass || pass.ownerId !== s.userId) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  if (pass.status !== "review_submitted") return NextResponse.json({ error: "검수 대기 상태가 아닙니다" }, { status: 400 });

  if (decision === "approve") {
    pass.status = "completed";
    pass.reviewStatus = "approved";
    const reviewer = db.reviewers.find((r) => r.id === pass.reviewerId);
    if (reviewer) {
      reviewer.completedReviews += 1;
      // 간이 품질 점수 — 본문 길이 기반
      const len = (pass.reviewBody || "").length;
      const score = Math.min(100, 60 + Math.floor(len / 20));
      reviewer.qualityScore = Math.round((reviewer.qualityScore * (reviewer.completedReviews - 1) + score) / reviewer.completedReviews);
    }
    db.notifications.push({
      id: rid("nt"),
      userId: pass.reviewerId,
      role: "reviewer",
      title: "리뷰 검수 통과",
      body: "리뷰가 검수를 통과했습니다. 등급 점수가 반영되었어요.",
      createdAt: Date.now(),
      read: false,
      link: "/r/passes",
    });
  } else {
    pass.status = "rejected";
    pass.reviewStatus = "rejected";
    db.notifications.push({
      id: rid("nt"),
      userId: pass.reviewerId,
      role: "reviewer",
      title: "리뷰 반려",
      body: "리뷰가 반려되었습니다. 운영팀 검수가 진행됩니다 (최대 72시간).",
      createdAt: Date.now(),
      read: false,
      link: "/r/passes",
    });
  }
  saveDB();
  return NextResponse.json({ ok: true });
}
