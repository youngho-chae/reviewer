import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import { isPushConfigured, upsertPushSub, VAPID_PUBLIC_KEY } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 웹푸시 구독 관리 (2026-08-13) — 체험자/사장님 세션 전용.
//  GET    : 설정 여부 + VAPID 공개키 (클라이언트 pushManager.subscribe용)
//  POST   : 브라우저 PushSubscription 저장 (endpoint 기준 upsert)
//  DELETE : 구독 해제 (endpoint 지정)
export async function GET() {
  return NextResponse.json({ configured: isPushConfigured(), publicKey: VAPID_PUBLIC_KEY || null });
}

export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || (s.role !== "reviewer" && s.role !== "owner")) {
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  }
  if (!isPushConfigured()) return NextResponse.json({ error: "푸시가 아직 설정되지 않았어요" }, { status: 503 });
  const { subscription } = await req.json().catch(() => ({}));
  const endpoint = String(subscription?.endpoint ?? "");
  const p256dh = String(subscription?.keys?.p256dh ?? "");
  const auth = String(subscription?.keys?.auth ?? "");
  if (!endpoint.startsWith("https://") || !p256dh || !auth) {
    return NextResponse.json({ error: "유효하지 않은 구독 정보" }, { status: 400 });
  }
  const db = await getDBAsync();
  upsertPushSub(db, { userId: s.userId, role: s.role, endpoint, keys: { p256dh, auth } }, () => rid("ps"));
  await saveDBAsync();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const s = await readSession();
  if (!s || (s.role !== "reviewer" && s.role !== "owner")) {
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  }
  const { endpoint } = await req.json().catch(() => ({}));
  const db = await getDBAsync();
  const before = (db.pushSubs ?? []).length;
  // 본인 구독만 제거 (endpoint + 계정 일치)
  db.pushSubs = (db.pushSubs ?? []).filter((x) => !(x.endpoint === String(endpoint ?? "") && x.userId === s.userId));
  if ((db.pushSubs ?? []).length !== before) await saveDBAsync();
  return NextResponse.json({ ok: true });
}
