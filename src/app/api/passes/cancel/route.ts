import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import { restoreQuotaSlot } from "@/lib/pass-lifecycle";

export const runtime = "nodejs";

// 체험자가 사용 전(active) 체험권을 직접 취소.
// 취소 즉시 모집 슬롯이 복구되어 다른 체험자가 참여할 수 있다.
// 취소는 노쇼로 집계하지 않는다 — 방치(만료)보다 취소를 유도하기 위한 정책.
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "reviewer") return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const { passId } = await req.json();
  const db = await getDBAsync();
  const pass = db.passes.find((p) => p.id === String(passId || ""));
  if (!pass) return NextResponse.json({ error: "체험권을 찾을 수 없습니다" }, { status: 404 });
  if (pass.reviewerId !== s.userId) return NextResponse.json({ error: "본인의 체험권이 아닙니다" }, { status: 403 });
  if (pass.status !== "active") {
    return NextResponse.json({ error: "사용 전 상태의 체험권만 취소할 수 있습니다" }, { status: 400 });
  }

  pass.status = "cancelled";
  pass.cancelledAt = Date.now();
  restoreQuotaSlot(db, pass);

  const me = db.reviewers.find((r) => r.id === s.userId);
  db.notifications.push({
    id: rid("nt"),
    userId: pass.ownerId,
    role: "owner",
    title: "체험권 참여 취소",
    body: `${me?.nickname ?? "체험자"}님이 참여를 취소했습니다. 모집 슬롯이 복구되었습니다.`,
    createdAt: Date.now(),
    read: false,
    link: "/o/home",
  });

  await saveDBAsync();
  return NextResponse.json({ ok: true });
}
