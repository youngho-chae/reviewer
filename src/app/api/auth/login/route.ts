import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { createSession } from "@/lib/auth";

export const runtime = "nodejs";

// 어드민 로그인 잠금 (2026-09-07 보안 감사) — 연속 5회 실패 시 3분 잠금.
// 체험자 사용 코드(5회/3분)와 동일 문법 — 백오피스가 무방비였던 역전 해소.
const ADMIN_LOGIN_MAX_FAILS = 5;
const ADMIN_LOGIN_LOCK_MS = 3 * 60 * 1000;

export async function POST(req: NextRequest) {
  const { role, email, password } = await req.json();
  const db = await getDBAsync();
  const lower = String(email || "").trim().toLowerCase();
  if (role === "admin") {
    const a = (db.admins ?? []).find((x) => x.email === lower);
    const now = Date.now();
    if (a?.loginLockUntil && now < a.loginLockUntil) {
      const left = Math.ceil((a.loginLockUntil - now) / 60000);
      return NextResponse.json({ error: `로그인이 잠겼습니다 — 약 ${left}분 후 다시 시도해주세요` }, { status: 429 });
    }
    if (!a || !bcrypt.compareSync(password, a.passwordHash)) {
      if (a) {
        a.loginFailCount = (a.loginFailCount ?? 0) + 1;
        if (a.loginFailCount >= ADMIN_LOGIN_MAX_FAILS) {
          a.loginLockUntil = now + ADMIN_LOGIN_LOCK_MS;
          a.loginFailCount = 0;
        }
        await saveDBAsync();
      }
      return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다" }, { status: 401 });
    }
    if (a.loginFailCount || a.loginLockUntil) {
      a.loginFailCount = 0;
      a.loginLockUntil = undefined;
      await saveDBAsync();
    }
    await createSession({ userId: a.id, role: "admin" });
    return NextResponse.json({ ok: true });
  } else if (role === "reviewer") {
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
