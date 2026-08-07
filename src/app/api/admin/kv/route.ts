import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { kvAvailable, kvCurrentKey, kvScanKeys, kvLoadRaw } from "@/lib/kv";
import type { DBShape } from "@/lib/types";

export const runtime = "nodejs";

// KV 진단 콘솔 (2026-08-07 — realtest DB 초기화 사고 대응, 운영팀 전용).
// catchpass:db:* 키를 전수 스캔해 키별 요약(seedVersion·엔터티 카운트)을 반환한다.
// 복구 판단용 읽기 전용 — 복원은 POST /api/admin/kv/restore, 백업은 GET /api/admin/kv/export.
function summarize(key: string, db: Partial<DBShape> | null) {
  if (!db || typeof db !== "object") return { key, readable: false };
  return {
    key,
    readable: true,
    seedVersion: (db as DBShape).seedVersion ?? null,
    reviewers: db.reviewers?.length ?? 0,
    owners: db.owners?.length ?? 0,
    stores: db.stores?.length ?? 0,
    campaigns: db.campaigns?.length ?? 0,
    passes: db.passes?.length ?? 0,
    notifications: db.notifications?.length ?? 0,
    // 실데이터 존재 판별 보조 — 시드 계정 외 실제 가입 흔적
    reviewerEmails: (db.reviewers ?? []).slice(0, 20).map((r) => r.email),
    ownerEmails: (db.owners ?? []).slice(0, 20).map((o) => o.email),
  };
}

export async function GET() {
  const s = await readSession();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "운영팀 로그인 필요" }, { status: 401 });
  if (!kvAvailable()) return NextResponse.json({ error: "KV 미설정 환경입니다" }, { status: 400 });

  const keys = await kvScanKeys();
  const summaries = [];
  for (const key of keys) {
    const db = await kvLoadRaw<DBShape>(key);
    summaries.push(summarize(key, db));
  }
  return NextResponse.json({ currentKey: kvCurrentKey(), keys: summaries });
}
