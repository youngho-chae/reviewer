import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { normalizePhone, readPhoneProof, clearPhoneProof } from "@/lib/phone-verify";
import { validatePassword } from "@/lib/password";

export const runtime = "nodejs";

// 회원 정보 수정 (2026-08-18 — /r/me/edit) — 필드별 독립 저장, 한 요청에 한 필드.
//  - nickname: 중복 검증(본인 제외 · 공백 정리 · 대소문자 무시) — 가입과 동일 규칙
//  - phone   : 새 번호 재인증 필수 — OTP 검증 증빙 쿠키(readPhoneProof)와 제출 번호 대조,
//              번호당 1계정 유지(중복 409). 성공 시 phoneVerifiedAt 갱신·증빙 소각
//  - password: 정책(영문·숫자·특수문자·6자↑ — src/lib/password.ts) 검증 후 재해시.
//              간편로그인 계정은 비밀번호 로그인 미사용이라 변경 불가
export async function PATCH(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "reviewer") return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const { nickname, phone, password } = await req.json().catch(() => ({}));
  const db = await getDBAsync();
  const me = db.reviewers.find((r) => r.id === s.userId);
  if (!me) return NextResponse.json({ error: "계정을 찾을 수 없습니다" }, { status: 404 });

  if (nickname !== undefined) {
    const nick = String(nickname || "").trim();
    if (!nick) return NextResponse.json({ error: "닉네임을 입력해주세요" }, { status: 400 });
    const nickLower = nick.toLowerCase();
    if (db.reviewers.some((r) => r.id !== me.id && (r.nickname || "").trim().toLowerCase() === nickLower)) {
      return NextResponse.json({ error: "이미 사용 중인 닉네임입니다" }, { status: 409 });
    }
    me.nickname = nick;
    await saveDBAsync();
    return NextResponse.json({ ok: true });
  }

  if (phone !== undefined) {
    const next = normalizePhone(phone);
    if (!next) return NextResponse.json({ error: "휴대폰 번호를 확인해주세요" }, { status: 400 });
    const proofPhone = await readPhoneProof();
    if (proofPhone !== next) {
      return NextResponse.json({ error: "새 번호의 휴대폰 인증을 완료해주세요" }, { status: 403 });
    }
    if (db.reviewers.some((r) => r.id !== me.id && r.phone === next)) {
      return NextResponse.json({ error: "이미 가입된 휴대폰 번호예요" }, { status: 409 });
    }
    me.phone = next;
    me.phoneVerifiedAt = Date.now();
    await saveDBAsync();
    await clearPhoneProof();
    return NextResponse.json({ ok: true });
  }

  if (password !== undefined) {
    if (me.social) {
      return NextResponse.json({ error: "간편로그인 계정은 비밀번호를 사용하지 않아요" }, { status: 400 });
    }
    const pwErr = validatePassword(String(password || ""));
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });
    me.passwordHash = bcrypt.hashSync(String(password), 8);
    await saveDBAsync();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "변경할 항목이 없어요" }, { status: 400 });
}
