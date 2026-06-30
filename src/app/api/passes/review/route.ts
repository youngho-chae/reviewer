import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import { CHANNEL_REVIEW_CONDITIONS } from "@/lib/channels";
import { SnsKind } from "@/lib/types";

export const runtime = "nodejs";

// 체험자가 리뷰 등록
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "reviewer") return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const { passId, reviewUrl, reviewChannel, selfCheck, pressSelfCheck } = await req.json();
  const db = await getDBAsync();
  const pass = db.passes.find((p) => p.id === passId);
  if (!pass || pass.reviewerId !== s.userId) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  const campaign = db.campaigns.find((c) => c.id === pass.campaignId);
  const isPress = campaign?.kind === "press";

  if (isPress) {
    if (pass.status !== "active") return NextResponse.json({ error: "이미 제출되었거나 만료된 패스" }, { status: 400 });
    // 기자단도 방문형과 동일하게 본인 채널에 작성한 URL만 제출.
    // 본문은 본인 채널에 게시되므로 시스템에서 검증하지 않고 자가 점검만 받음.
    if (!reviewUrl) return NextResponse.json({ error: "URL을 입력해주세요" }, { status: 400 });
    if (!reviewChannel) return NextResponse.json({ error: "작성 채널을 선택해주세요" }, { status: 400 });
    const needsKeywordCheck = (campaign?.pressKeywords?.length || 0) > 0;
    if (!pressSelfCheck || !pressSelfCheck.ad || !pressSelfCheck.kit || (needsKeywordCheck && !pressSelfCheck.keywords)) {
      return NextResponse.json({ error: "자가 점검 항목을 모두 체크해주세요" }, { status: 400 });
    }
  } else {
    if (pass.status !== "used") return NextResponse.json({ error: "사용 후에만 리뷰 등록 가능" }, { status: 400 });
    // 방문형은 URL + 채널 + 채널별 자가점검 항목 모두 체크 필수
    if (!reviewUrl) {
      return NextResponse.json({ error: "URL을 입력해주세요" }, { status: 400 });
    }
    // 참여 시 확정된 채널을 신뢰 (없으면 제출값 사용)
    const channel: SnsKind | undefined = (pass.reviewChannel ?? reviewChannel) as SnsKind | undefined;
    if (!channel) {
      return NextResponse.json({ error: "작성 채널을 선택해주세요" }, { status: 400 });
    }
    const conditions = CHANNEL_REVIEW_CONDITIONS[channel] ?? [];
    const sc = (selfCheck ?? {}) as Record<string, boolean>;
    if (!conditions.every((c) => sc[c.key])) {
      return NextResponse.json({ error: "자가점검 항목을 모두 체크해주세요" }, { status: 400 });
    }
    pass.reviewSelfCheck = Object.fromEntries(conditions.map((c) => [c.key, !!sc[c.key]]));
    pass.reviewChannel = channel;
  }

  pass.reviewUrl = reviewUrl;
  if (isPress) pass.reviewChannel = reviewChannel;
  pass.reviewSubmittedAt = Date.now();
  pass.reviewStatus = "pending";
  pass.status = "review_submitted";
  db.notifications.push({
    id: rid("nt"),
    userId: pass.ownerId,
    role: "owner",
    title: "신규 후기 등록",
    body: "체험자가 후기를 등록했습니다. 운영팀이 검수 중이며, 사장님은 조회만 가능합니다.",
    createdAt: Date.now(),
    read: false,
    link: "/o/reviews",
  });
  await saveDBAsync();
  return NextResponse.json({ ok: true });
}
