import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";

export const runtime = "nodejs";

// 사업자 정보 제출 (2026-08-18 — 가입 항목 축소로 신설) — 가입 직후 인증 대기 화면에서
// 상호·사업자등록번호를 제출한다. 수기 인증 절차(확정 정책 9)는 그대로: 제출 후
// 운영팀이 /admin/owners에서 확인 → verified. pending 상태에서만 제출/수정 가능.
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const db = await getDBAsync();
  const me = db.owners.find((o) => o.id === s.userId);
  if (!me) return NextResponse.json({ error: "계정을 찾을 수 없습니다" }, { status: 404 });
  if (me.bizStatus !== "pending") {
    return NextResponse.json({ error: "이미 인증이 완료된 계정이에요" }, { status: 400 });
  }

  const { storeName, bizNumber } = await req.json().catch(() => ({}));
  const name = String(storeName || "").trim();
  const biz = String(bizNumber || "").replace(/\D/g, "");
  if (!name) return NextResponse.json({ error: "상호(매장명)를 입력해주세요" }, { status: 400 });
  if (biz.length !== 10) return NextResponse.json({ error: "사업자등록번호 10자리를 입력해주세요" }, { status: 400 });

  me.storeName = name;
  me.bizNumber = biz;
  await saveDBAsync();
  return NextResponse.json({ ok: true });
}
