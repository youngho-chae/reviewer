import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { kvAvailable, kvCurrentKey, kvLoadRaw, kvSaveRaw } from "@/lib/kv";
import type { DBShape } from "@/lib/types";

export const runtime = "nodejs";

// KV 복원 (2026-08-07 — realtest DB 초기화 사고 대응, 운영팀 전용).
// body:
//   { fromKey: string }  — 다른 catchpass:db:* 키의 값을 현재 배포 키로 복사
//   { db: DBShape }      — export 백업 JSON(의 db 필드)을 현재 배포 키에 직접 기록
// 안전장치: 복원 전 현재 키 값을 catchpass:db:rescue:<ts> 키로 백업(잘못 복원해도 회귀 가능),
// 복원 값은 최소 형태 검증(admins 존재). 복원 후 seedVersion은 현재 배포 기준으로 승격해
// ensureSeeded 재시드를 차단한다 (비파괴 원칙과 이중 방어).
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "운영팀 로그인 필요" }, { status: 401 });
  if (!kvAvailable()) return NextResponse.json({ error: "KV 미설정 환경입니다" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const fromKey: string | undefined = body?.fromKey;
  const inlineDb: DBShape | undefined = body?.db;

  let restored: DBShape | null = null;
  let source = "";
  if (fromKey) {
    if (!fromKey.startsWith("catchpass:db:")) {
      return NextResponse.json({ error: "catchpass:db:* 키만 복원 소스로 쓸 수 있습니다" }, { status: 400 });
    }
    restored = await kvLoadRaw<DBShape>(fromKey);
    source = fromKey;
    if (!restored) return NextResponse.json({ error: `소스 키에 데이터가 없습니다: ${fromKey}` }, { status: 404 });
  } else if (inlineDb && typeof inlineDb === "object") {
    restored = inlineDb;
    source = "(업로드 백업 JSON)";
  } else {
    return NextResponse.json({ error: "fromKey 또는 db 중 하나를 보내주세요" }, { status: 400 });
  }

  if (!Array.isArray(restored.admins) || !Array.isArray(restored.reviewers) || !Array.isArray(restored.passes)) {
    return NextResponse.json({ error: "복원 값이 DB 형태가 아닙니다 (admins/reviewers/passes 배열 필요)" }, { status: 400 });
  }

  const currentKey = kvCurrentKey();
  // 1) 현재 값 rescue 백업 — 복원 실수 시 되돌릴 수 있게
  const current = await kvLoadRaw<DBShape>(currentKey);
  const rescueKey = `catchpass:db:rescue:${Date.now()}`;
  if (current) await kvSaveRaw(rescueKey, current);

  // 2) 복원 — seedVersion을 현재 배포 이상으로 승격해 재시드 차단
  restored.seeded = true;
  restored.seedVersion = Math.max(restored.seedVersion ?? 0, current?.seedVersion ?? 0);
  const ok = await kvSaveRaw(currentKey, restored);
  if (!ok) return NextResponse.json({ error: "KV 저장 실패" }, { status: 500 });

  return NextResponse.json({
    ok: true,
    restoredFrom: source,
    into: currentKey,
    rescueBackup: current ? rescueKey : null,
    summary: {
      reviewers: restored.reviewers.length,
      owners: restored.owners?.length ?? 0,
      stores: restored.stores?.length ?? 0,
      campaigns: restored.campaigns?.length ?? 0,
      passes: restored.passes.length,
    },
  });
}
