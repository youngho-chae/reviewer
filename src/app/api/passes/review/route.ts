import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import { selfCheckConditions } from "@/lib/channels";
import { REVIEW_DEADLINE_MS } from "@/lib/pass-lifecycle";
import { SnsKind } from "@/lib/types";

export const runtime = "nodejs";

// 체험자가 리뷰 등록.
//  - 방문형: 이용(used) 후 7일 이내 제출. 반려(rejected) 시 기한 내 1회 재제출 가능.
//  - 기자단: active 상태(캠페인 종료 전)에 제출. 반려 시 캠페인 종료 전 1회 재제출 가능.
//  - 광고 표기(경제적 대가 고지) 확인은 서버가 필수 검증하고 pass에 보존한다.
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "reviewer") return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const { passId, reviewUrl, reviewChannel, selfCheck, pressSelfCheck, adNotice, keepAgreed } = await req.json();
  const db = await getDBAsync();
  const pass = db.passes.find((p) => p.id === passId);
  if (!pass || pass.reviewerId !== s.userId) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  const campaign = db.campaigns.find((c) => c.id === pass.campaignId);
  const isPress = campaign?.kind === "press";

  // 반려 후 재제출 여부 판정 (1회 한정)
  const isResubmit = pass.status === "rejected";
  if (isResubmit && (pass.resubmitCount ?? 0) >= 1) {
    return NextResponse.json({ error: "재제출은 1회만 가능합니다. 고객센터로 문의해주세요." }, { status: 400 });
  }

  if (isPress) {
    if (pass.status !== "active" && !isResubmit) {
      return NextResponse.json({ error: "이미 제출되었거나 만료된 패스" }, { status: 400 });
    }
    // 기자단 제출/재제출 기한 = 캠페인 종료 시각
    if (campaign && Date.now() > campaign.endAt) {
      return NextResponse.json({ error: "캠페인이 종료되어 제출할 수 없습니다" }, { status: 400 });
    }
    // 기자단도 방문형과 동일하게 본인 채널에 작성한 URL만 제출.
    // 본문은 본인 채널에 게시되므로 시스템에서 검증하지 않고 자가 점검만 받음.
    if (!reviewUrl) return NextResponse.json({ error: "URL을 입력해주세요" }, { status: 400 });
    if (!/^https?:\/\/\S+\.\S+/.test(String(reviewUrl).trim())) {
      return NextResponse.json({ error: "리뷰 URL 형식이 올바르지 않습니다 (http:// 또는 https:// 로 시작)" }, { status: 400 });
    }
    if (!reviewChannel) return NextResponse.json({ error: "작성 채널을 선택해주세요" }, { status: 400 });
    const needsKeywordCheck = (campaign?.pressKeywords?.length || 0) > 0;
    if (!pressSelfCheck || !pressSelfCheck.ad || !pressSelfCheck.kit || (needsKeywordCheck && !pressSelfCheck.keywords)) {
      return NextResponse.json({ error: "자가 점검 항목을 모두 체크해주세요" }, { status: 400 });
    }
    pass.adNoticeConfirmed = true; // pressSelfCheck.ad 필수 통과
  } else {
    if (pass.status !== "used" && !isResubmit) {
      return NextResponse.json({ error: "사용 후에만 리뷰 등록 가능" }, { status: 400 });
    }
    // 제출 기한 — 최초: 이용(사용 처리) 후 7일 / 재제출: 반려 시점 후 7일 (검수 지연이 체험자에게 불리하지 않도록)
    const deadline = isResubmit
      ? (pass.rejectedAt ?? Date.now()) + REVIEW_DEADLINE_MS
      : (pass.usedAt ?? 0) + REVIEW_DEADLINE_MS;
    if (Date.now() > deadline) {
      return NextResponse.json(
        { error: isResubmit ? "재제출 기한(반려 후 7일)이 지났습니다" : "리뷰 제출 기한(이용 후 7일)이 지났습니다" },
        { status: 400 },
      );
    }
    // 방문형은 URL + 채널 + 채널별 자가점검 항목 모두 체크 필수
    if (!reviewUrl) {
      return NextResponse.json({ error: "URL을 입력해주세요" }, { status: 400 });
    }
    // 경제적 대가(광고) 표기 확인 — 클라이언트 체크만으로는 우회 가능하므로 서버가 강제
    if (!adNotice) {
      return NextResponse.json({ error: "경제적 대가 표기(광고 문구) 포함 여부를 확인해주세요" }, { status: 400 });
    }
    // 참여 시 확정된 채널을 신뢰 (없으면 제출값 사용)
    const channel: SnsKind | undefined = (pass.reviewChannel ?? reviewChannel) as SnsKind | undefined;
    if (!channel) {
      return NextResponse.json({ error: "작성 채널을 선택해주세요" }, { status: 400 });
    }
    // 자가점검 = 제출 시점에 완료된 사실만 (게시 유지 keep 항목은 별도 동의로 분리)
    const conditions = selfCheckConditions(channel);
    const sc = (selfCheck ?? {}) as Record<string, boolean>;
    if (!conditions.every((c) => sc[c.key])) {
      return NextResponse.json({ error: "자가점검 항목을 모두 체크해주세요" }, { status: 400 });
    }
    // 게시 유지(90일) 동의 — 클라이언트 체크만으로는 우회 가능하므로 서버가 강제·보존
    if (!keepAgreed) {
      return NextResponse.json({ error: "게시 유지(90일) 동의가 필요합니다" }, { status: 400 });
    }
    pass.reviewSelfCheck = Object.fromEntries(conditions.map((c) => [c.key, !!sc[c.key]]));
    pass.keepAgreed = true;
    pass.reviewChannel = channel;
    pass.adNoticeConfirmed = true;
  }

  if (isResubmit) pass.resubmitCount = (pass.resubmitCount ?? 0) + 1;
  pass.reviewUrl = reviewUrl;
  if (isPress) pass.reviewChannel = reviewChannel;
  pass.reviewSubmittedAt = Date.now();
  pass.reviewStatus = "pending";
  pass.status = "review_submitted";
  db.notifications.push({
    id: rid("nt"),
    userId: pass.ownerId,
    role: "owner",
    title: isResubmit ? "후기 재제출" : "신규 후기 등록",
    body: isResubmit
      ? "반려되었던 후기가 수정되어 재제출되었습니다. 운영팀이 다시 검수합니다."
      : "체험자가 후기를 등록했습니다. 운영팀이 검수 중이며, 사장님은 조회만 가능합니다.",
    createdAt: Date.now(),
    read: false,
    link: "/o/reviews",
  });
  await saveDBAsync();
  return NextResponse.json({ ok: true });
}
