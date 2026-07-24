import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import { closeCampaign } from "@/lib/campaign-close";

export const runtime = "nodejs";

// 캠페인 조기 종료 — 운영자 콘솔 (2026-07-24).
// 정책·부수효과는 src/lib/campaign-close.ts 단일 코어 참조 (사장님 관리 화면과 공유).
// 운영자 종료 시 사장님에게도 안내 알림을 발송한다.
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "admin") {
    return NextResponse.json({ error: "운영팀 로그인 필요" }, { status: 401 });
  }
  const { campaignId } = await req.json();
  const db = await getDBAsync();
  const c = db.campaigns.find((x) => x.id === String(campaignId || ""));
  if (!c) return NextResponse.json({ error: "캠페인을 찾을 수 없습니다" }, { status: 404 });
  if (c.endAt <= Date.now()) {
    return NextResponse.json({ error: "이미 종료된 캠페인입니다" }, { status: 400 });
  }

  const result = closeCampaign(db, c, "admin");
  const store = db.stores.find((st) => st.id === c.storeId);
  if (store) {
    db.notifications.push({
      id: rid("nt"),
      userId: store.ownerId,
      role: "owner",
      title: "캠페인 종료 처리",
      body: `운영팀이 '${c.title}' 캠페인을 종료했습니다. 이미 발급·확정된 체험 건은 유효 기한까지 진행되며, 미확정 예약 요청은 자동 취소되었습니다.`,
      createdAt: Date.now(),
      read: false,
      link: `/o/campaign/${c.id}`,
    });
    await saveDBAsync();
  } else {
    await saveDBAsync();
  }
  return NextResponse.json({ ok: true, ...result });
}
