import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";

export const runtime = "nodejs";

// 대표 매장 지정 (2026-07-31) — 마이페이지 [매장 정보]에서 설정.
// 새 캠페인 생성의 매장 리스트 기본 선택으로 쓰인다 (미지정 시 첫 매장 폴백).
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const db = await getDBAsync();
  const owner = db.owners.find((o) => o.id === s.userId);
  if (!owner) return NextResponse.json({ error: "사장님 정보를 찾을 수 없습니다" }, { status: 400 });
  const { storeId } = await req.json().catch(() => ({}));
  const store = db.stores.find((x) => x.id === storeId && x.ownerId === s.userId);
  if (!store) return NextResponse.json({ error: "잘못된 매장" }, { status: 400 });
  owner.primaryStoreId = store.id;
  await saveDBAsync();
  return NextResponse.json({ ok: true, primaryStoreId: store.id });
}
