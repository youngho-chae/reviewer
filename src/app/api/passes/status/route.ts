import { NextRequest, NextResponse } from "next/server";
import { getDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 체험권 상태 폴링 (2026-08-11 — QR 사용 처리 실시간 동기화)
// 체험자 QR 화면이 3초 간격으로 조회해, 사장님 스캐너가 사용 처리(use API)를 마치면
// 체험자 화면을 완료 안내(/r/passes/[id]/complete)로 자동 전환한다.
// 본인 패스 한정·상태만 반환하는 경량 엔드포인트 (서버리스 — 웹소켓 대신 폴링).
export async function GET(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "reviewer") return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const db = await getDBAsync();
  const pass = db.passes.find((p) => p.id === id);
  if (!pass || pass.reviewerId !== s.userId) return NextResponse.json({ error: "체험권 없음" }, { status: 404 });
  return NextResponse.json({ status: pass.status });
}
