import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { verifyBizNumber, ntsConfigured } from "@/lib/biz-verify";

export const runtime = "nodejs";

// 사업자등록 진위확인 → 즉시 승인 (2026-08-18 — 구 수기 제출(biz-info) 대체).
// 공공데이터포털 국세청 상태조회 API(정본 src/lib/biz-verify.ts)로 번호 존재를 검증하고,
// 유효하면 **관리자 승인 없이 즉시 verified** — 상호(bizName)는 응답 제공 시 자동 기입,
// 미제공(실 국세청 API — 상호 미포함) 시 클라이언트가 입력한 storeName을 저장.
// operatorType = 사장님(직접 운영)|마케터(대행 관리) — 표기용 계정 성격.
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const db = await getDBAsync();
  const me = db.owners.find((o) => o.id === s.userId);
  if (!me) return NextResponse.json({ error: "계정을 찾을 수 없습니다" }, { status: 404 });
  if (me.bizStatus !== "pending") {
    return NextResponse.json({ error: "이미 인증이 완료된 계정이에요" }, { status: 400 });
  }

  const { bizNumber, operatorType, storeName } = await req.json().catch(() => ({}));
  const biz = String(bizNumber || "").replace(/\D/g, "");
  if (biz.length !== 10) return NextResponse.json({ error: "사업자등록번호 10자리를 입력해주세요" }, { status: 400 });
  const opType = operatorType === "marketer" ? "marketer" : "owner";

  let result;
  try {
    result = await verifyBizNumber(biz);
  } catch (e) {
    return NextResponse.json(
      { error: `진위확인에 실패했어요 — 잠시 후 다시 시도해주세요 (${(e as Error).message})` },
      { status: 502 },
    );
  }
  if (!result.valid) {
    return NextResponse.json({ error: result.statusLabel, demo: result.demo }, { status: 422 });
  }

  // 상호 — API 제공(자동 기입) 우선, 미제공이면 클라이언트 입력 폴백
  const name = String(result.bizName || storeName || "").trim();
  if (!name) {
    // 실키 모드 + 상호 미제공: 클라이언트가 사업장명 입력을 활성화해 재제출한다
    return NextResponse.json({ ok: true, verified: false, needName: true, statusLabel: result.statusLabel });
  }

  me.bizNumber = biz;
  me.storeName = name;
  me.operatorType = opType;
  me.bizStatus = "verified";
  me.bizVerifiedAt = Date.now();
  await saveDBAsync();
  return NextResponse.json({
    ok: true,
    verified: true,
    bizName: name,
    statusLabel: result.statusLabel,
    demo: !ntsConfigured() || undefined,
  });
}
