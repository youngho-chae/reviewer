import { NextResponse } from "next/server";
import { kvAvailable, kvLoad } from "@/lib/kv";
import { getDBAsync } from "@/lib/db";
import type { DBShape } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 배포 환경 진단 (2026-07-17 — 데모 로그인 불가 이슈 대응).
// 시크릿은 노출하지 않는다 — 설정 여부(boolean)·지연·건수만 보고.
// 사용: GET /api/health → { ok, authSecretSet, kv: {...}, db: {...} }
export async function GET() {
  const authSecretSet = !!process.env.AUTH_SECRET;
  // 인스타 캡처 OCR 설정 여부 (2026-07-29 — env 반영 진단용, 값은 비노출)
  const ocr = {
    invokeUrlSet: !!process.env.NCP_OCR_INVOKE_URL,
    secretSet: !!process.env.NCP_OCR_SECRET,
  };

  // KV 왕복 점검 — 연결·포맷·지연
  const kv: Record<string, unknown> = { configured: kvAvailable() };
  if (kvAvailable()) {
    const t0 = Date.now();
    try {
      const loaded = await kvLoad<DBShape>();
      kv.roundtripMs = Date.now() - t0;
      kv.hasData = !!loaded;
      kv.dataIsObject = !!loaded && typeof loaded === "object";
      kv.seedVersion = loaded?.seedVersion ?? null;
    } catch (e) {
      kv.error = e instanceof Error ? e.message : "kv error";
    }
  }

  // DB 로드 경로 전체 점검 (KV → 시드 부트스트랩 포함)
  const db: Record<string, unknown> = {};
  let ok = true;
  try {
    const t0 = Date.now();
    const d = await getDBAsync();
    db.loadMs = Date.now() - t0;
    db.seedVersion = d.seedVersion ?? null;
    db.reviewers = d.reviewers.length;
    db.owners = d.owners.length;
    db.campaigns = d.campaigns.length;
    db.passes = d.passes.length;
  } catch (e) {
    ok = false;
    db.error = e instanceof Error ? e.message : "db error";
  }

  return NextResponse.json({
    ok: ok && (authSecretSet || process.env.NODE_ENV !== "production"),
    env: process.env.NODE_ENV,
    authSecretSet, // production에서 false면 로그인(세션 서명)이 fail-closed로 500
    ocr, // 인스타 캡처 OCR env 설정 여부 (2026-07-29)
    kv,
    db,
  });
}
