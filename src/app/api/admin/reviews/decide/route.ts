import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";

export const runtime = "nodejs";

// 운영팀(admin)이 제출된 후기를 통과/반려 처리.
// review_submitted → completed | rejected. 체험자·사장님 양측에 알림 발행.
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "admin") {
    return NextResponse.json({ error: "운영팀 로그인 필요" }, { status: 401 });
  }
  const { passId, decision, reason } = await req.json();
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ error: "decision은 approve 또는 reject" }, { status: 400 });
  }

  const db = await getDBAsync();
  const pass = db.passes.find((p) => p.id === String(passId || ""));
  if (!pass) return NextResponse.json({ error: "체험권을 찾을 수 없습니다" }, { status: 404 });
  if (pass.status !== "review_submitted") {
    return NextResponse.json({ error: "검수 대기 상태의 후기만 처리할 수 있습니다" }, { status: 400 });
  }

  const store = db.stores.find((x) => x.id === pass.storeId);
  const storeName = store?.name ?? "매장";
  const now = Date.now();

  if (decision === "approve") {
    pass.status = "completed";
    pass.reviewStatus = "approved";
    // 승인 시각 — 월간 등급 재평가의 완료·상생 집계 귀속 기준
    pass.completedAt = now;
    // 검수 통과 시 체험자 누적 완료 리뷰 +1 (등급 산정 반영)
    const reviewer = db.reviewers.find((r) => r.id === pass.reviewerId);
    if (reviewer) reviewer.completedReviews += 1;
    db.notifications.push({
      id: rid("nt"),
      userId: pass.reviewerId,
      role: "reviewer",
      title: "후기 검수 통과 ✅",
      body: `${storeName} 후기가 검수를 통과했습니다. 등급 점수에 반영됩니다.`,
      createdAt: now,
      read: false,
      link: `/r/passes/${pass.id}`,
    });
    db.notifications.push({
      id: rid("nt"),
      userId: pass.ownerId,
      role: "owner",
      title: "후기 검수 통과",
      body: `${storeName} 캠페인 후기가 검수를 통과했습니다.`,
      createdAt: now,
      read: false,
      link: "/o/reviews",
    });
  } else {
    pass.status = "rejected";
    pass.reviewStatus = "rejected";
    // 반려 사유를 pass에 구조화 저장 — 체험자 화면에 그대로 노출되어 재작성 근거가 된다
    pass.rejectReason = String(reason || "").slice(0, 500) || "작성 조건 미충족";
    pass.rejectedAt = now;
    const canResubmit = (pass.resubmitCount ?? 0) < 1;
    db.notifications.push({
      id: rid("nt"),
      userId: pass.reviewerId,
      role: "reviewer",
      title: "후기 반려 안내",
      body: `${storeName} 후기가 반려되었습니다. 사유: ${pass.rejectReason}${canResubmit ? " · 수정 후 1회 재제출할 수 있습니다." : ""}`,
      createdAt: now,
      read: false,
      link: `/r/passes/${pass.id}`,
    });
    db.notifications.push({
      id: rid("nt"),
      userId: pass.ownerId,
      role: "owner",
      title: "후기 반려 처리",
      body: `${storeName} 캠페인 후기가 운영팀에 의해 반려되었습니다.`,
      createdAt: now,
      read: false,
      link: "/o/reviews",
    });
  }

  await saveDBAsync();
  return NextResponse.json({ ok: true, status: pass.status });
}
