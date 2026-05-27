import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";

export const runtime = "nodejs";

// 체험자가 리뷰 등록
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "reviewer") return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const { passId, reviewUrl, reviewBody, reviewChannel } = await req.json();
  const db = await getDBAsync();
  const pass = db.passes.find((p) => p.id === passId);
  if (!pass || pass.reviewerId !== s.userId) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  const campaign = db.campaigns.find((c) => c.id === pass.campaignId);
  const isPress = campaign?.kind === "press";
  // 방문형: QR 사용(used) 후에만 / 기자단: active 상태에서 바로 작성 가능
  if (isPress) {
    if (pass.status !== "active") return NextResponse.json({ error: "이미 제출되었거나 만료된 패스" }, { status: 400 });
    if (campaign?.pressMinChars && String(reviewBody || "").length < campaign.pressMinChars) {
      return NextResponse.json({ error: `최소 ${campaign.pressMinChars.toLocaleString()}자 이상 작성해주세요` }, { status: 400 });
    }
  } else {
    if (pass.status !== "used") return NextResponse.json({ error: "사용 후에만 리뷰 등록 가능" }, { status: 400 });
  }
  if (!reviewUrl || !reviewBody || String(reviewBody).length < 50) {
    return NextResponse.json({ error: "URL과 본문(50자 이상)을 입력해주세요" }, { status: 400 });
  }
  pass.reviewUrl = reviewUrl;
  pass.reviewBody = reviewBody;
  pass.reviewChannel = reviewChannel;
  pass.reviewSubmittedAt = Date.now();
  pass.reviewStatus = "pending";
  pass.status = "review_submitted";
  db.notifications.push({
    id: rid("nt"),
    userId: pass.ownerId,
    role: "owner",
    title: "리뷰 등록",
    body: "체험자가 리뷰를 등록했습니다. 검수해주세요.",
    createdAt: Date.now(),
    read: false,
    link: "/o/reviews",
  });
  await saveDBAsync();
  return NextResponse.json({ ok: true });
}
