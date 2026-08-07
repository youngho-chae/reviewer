import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import { selfCheckConditions, receiptSelfCheckConditions } from "@/lib/channels";
import { REVIEW_DEADLINE_MS, reviewDeadline } from "@/lib/pass-lifecycle";
import { SnsKind } from "@/lib/types";

export const runtime = "nodejs";

// 체험자가 리뷰 등록.
//  - 방문형: 이용(used) 후 7일 이내 제출. 반려(rejected) 시 기한 내 1회 재제출 가능.
//  - 광고 표기(경제적 대가 고지) 확인은 서버가 필수 검증하고 pass에 보존한다.
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "reviewer") return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const { passId, reviewUrl, reviewChannel, selfCheck, adNotice, keepAgreed } = await req.json();
  const db = await getDBAsync();
  const pass = db.passes.find((p) => p.id === passId);
  if (!pass || pass.reviewerId !== s.userId) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  // 반려 후 재제출 여부 판정 (1회 한정)
  const isResubmit = pass.status === "rejected";
  if (isResubmit && (pass.resubmitCount ?? 0) >= 1) {
    return NextResponse.json({ error: "재제출은 1회만 가능합니다. 고객센터로 문의해주세요." }, { status: 400 });
  }

  if (pass.status !== "used" && !isResubmit) {
    return NextResponse.json({ error: "사용 후에만 리뷰 등록 가능" }, { status: 400 });
  }
  // 제출 기한 — 최초: reviewDeadline 정본(예약형 = 확정 방문일 말 + 7일, 그 외 이용 후 7일 —
  // 2026-08-05 D7: 스윕 기한 초과 판정과 동일 기준으로 통일) / 재제출: 반려 시점 후 7일
  // (검수 지연이 체험자에게 불리하지 않도록)
  const deadline = isResubmit
    ? (pass.rejectedAt ?? Date.now()) + REVIEW_DEADLINE_MS
    : (reviewDeadline(pass) ?? (pass.usedAt ?? 0) + REVIEW_DEADLINE_MS);
  if (Date.now() > deadline) {
    return NextResponse.json(
      { error: isResubmit ? "재제출 기한(반려 후 7일)이 지났습니다" : "리뷰 제출 기한(이용 후 7일)이 지났습니다" },
      { status: 400 },
    );
  }
  // 영수증 리뷰 참여 (2026-08-07 개정) — SNS와 동일하게 리뷰 URL 제출 (My 플레이스에서 확인,
  // 구 캡처 업로드 폐기). 채널만 없다 — URL·자가점검·광고 표기·90일 동의는 공통 필수.
  const isReceipt = !!pass.receiptReview;
  if (!reviewUrl) {
    return NextResponse.json(
      { error: isReceipt ? "리뷰 URL을 입력해주세요 — 네이버 > My 플레이스에서 확인할 수 있어요" : "URL을 입력해주세요" },
      { status: 400 },
    );
  }
  // 경제적 대가(광고) 표기 확인 — 클라이언트 체크만으로는 우회 가능하므로 서버가 강제.
  // 영수증 리뷰는 광고 문구 표기 대상이 아니다 (2026-08-07 — 확인 항목 자체가 없음)
  if (!isReceipt && !adNotice) {
    return NextResponse.json({ error: "경제적 대가 표기(광고 문구) 포함 여부를 확인해주세요" }, { status: 400 });
  }
  // 참여 시 확정된 채널을 신뢰 (없으면 제출값 사용) — 영수증 리뷰는 채널 없음
  const channel: SnsKind | undefined = isReceipt ? undefined : ((pass.reviewChannel ?? reviewChannel) as SnsKind | undefined);
  if (!isReceipt && !channel) {
    return NextResponse.json({ error: "작성 채널을 선택해주세요" }, { status: 400 });
  }
  // 자가점검 = 제출 시점에 완료된 사실만 (게시 유지 keep 항목은 별도 동의로 분리)
  const conditions = isReceipt ? receiptSelfCheckConditions() : selfCheckConditions(channel as SnsKind);
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
  if (channel) pass.reviewChannel = channel;
  if (!isReceipt) pass.adNoticeConfirmed = true;

  if (isResubmit) pass.resubmitCount = (pass.resubmitCount ?? 0) + 1;
  pass.reviewUrl = reviewUrl;
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
