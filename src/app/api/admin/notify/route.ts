import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import { sendWebPushTo } from "@/lib/push";

export const runtime = "nodejs";

// 어드민 알림 발송 (2026-08-13) — 체험자/사장님을 선택해 알림함(푸시)으로 공지를 보낸다.
// 수신 = 인앱 알림함(db.notifications — 각 역할 화면의 벨/알림함이 그대로 소비).
// userIds 미지정 = 해당 역할 전체 발송. 링크는 내부 경로만 허용(외부 URL 차단).
const TITLE_MAX = 40;
const BODY_MAX = 200;

export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "운영팀 로그인 필요" }, { status: 401 });

  const { audience, userIds, title, body, link } = await req.json().catch(() => ({}));
  if (audience !== "reviewer" && audience !== "owner") {
    return NextResponse.json({ error: "대상을 선택해주세요 (체험자/사장님)" }, { status: 400 });
  }
  const t = String(title ?? "").trim();
  const b = String(body ?? "").trim();
  if (!t) return NextResponse.json({ error: "제목을 입력해주세요" }, { status: 400 });
  if (t.length > TITLE_MAX) return NextResponse.json({ error: `제목은 ${TITLE_MAX}자 이내로 입력해주세요` }, { status: 400 });
  if (!b) return NextResponse.json({ error: "내용을 입력해주세요" }, { status: 400 });
  if (b.length > BODY_MAX) return NextResponse.json({ error: `내용은 ${BODY_MAX}자 이내로 입력해주세요` }, { status: 400 });
  const l = String(link ?? "").trim();
  if (l && !l.startsWith("/")) {
    return NextResponse.json({ error: "링크는 내부 경로(/로 시작)만 사용할 수 있어요" }, { status: 400 });
  }

  const db = await getDBAsync();
  const pool = audience === "reviewer" ? db.reviewers.map((r) => r.id) : db.owners.map((o) => o.id);
  const poolSet = new Set(pool);
  let targets: string[];
  if (Array.isArray(userIds) && userIds.length > 0) {
    targets = [...new Set(userIds.map(String))].filter((id) => poolSet.has(id));
    if (targets.length === 0) return NextResponse.json({ error: "선택한 수신자를 찾을 수 없어요" }, { status: 400 });
  } else {
    targets = pool;
  }
  if (targets.length === 0) return NextResponse.json({ error: "발송할 대상이 없어요" }, { status: 400 });

  const now = Date.now();
  for (const userId of targets) {
    db.notifications.push({
      id: rid("nt"),
      userId,
      role: audience,
      title: t,
      body: b,
      createdAt: now,
      read: false,
      ...(l ? { link: l } : {}),
    });
  }
  // 실제 웹푸시 동시 발송 (2026-08-13 — 정본 src/lib/push.ts). VAPID 미설정이면 0건 스킵,
  // 만료 구독(404/410)은 자동 정리. 푸시 실패해도 인앱 알림함 발송은 이미 확정.
  const push = await sendWebPushTo(
    db,
    audience,
    targets,
    { title: t, body: b, link: l || (audience === "reviewer" ? "/r/notifications" : "/o/notifications") },
  ).catch(() => ({ sent: 0, cleaned: 0 }));

  await saveDBAsync();
  return NextResponse.json({ ok: true, sent: targets.length, pushSent: push.sent });
}
