import { NextResponse } from "next/server";
import { getDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const db = await getDBAsync();
  const owner = db.owners.find((o) => o.id === s.userId);
  const stores = db.stores.filter((st) => st.ownerId === s.userId);
  return NextResponse.json({ owner: { id: owner?.id, storeName: owner?.storeName, plan: owner?.plan }, stores });
}
