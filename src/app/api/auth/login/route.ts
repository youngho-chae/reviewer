import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDBAsync } from "@/lib/db";
import { createSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { role, email, password } = await req.json();
  const db = await getDBAsync();
  const lower = String(email || "").trim().toLowerCase();
  if (role === "reviewer") {
    const r = db.reviewers.find((x) => x.email === lower);
    if (!r || !bcrypt.compareSync(password, r.passwordHash)) {
      return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다" }, { status: 401 });
    }
    await createSession({ userId: r.id, role: "reviewer" });
    return NextResponse.json({ ok: true });
  } else {
    const o = db.owners.find((x) => x.email === lower);
    if (!o || !bcrypt.compareSync(password, o.passwordHash)) {
      return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다" }, { status: 401 });
    }
    await createSession({ userId: o.id, role: "owner" });
    return NextResponse.json({ ok: true });
  }
}
