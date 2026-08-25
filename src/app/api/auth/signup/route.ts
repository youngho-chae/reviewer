import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { rid } from "@/lib/ids";
import { createSession } from "@/lib/auth";
import { channelGradesFromSns, bestGrade } from "@/lib/grade";
import { normalizePhone, readPhoneProof, clearPhoneProof } from "@/lib/phone-verify";
import { readSocialSignupProof, clearSocialSignupProof } from "@/lib/social-login";
import { Owner, Reviewer, SnsAccount, SnsKind, Store } from "@/lib/types";

export const runtime = "nodejs";

interface ReviewerSignup {
  role: "reviewer";
  email?: string;
  password?: string;
  nickname: string;
  // 휴대폰 번호 (2026-07-23 — 체험자 PK, 인증 증빙 쿠키와 대조 필수)
  phone?: string;
  // 간편로그인 가입 (2026-07-23) — true면 소셜 신원 증빙 쿠키(cp_social_signup)로 가입 (비밀번호 없음)
  social?: boolean;
  sns?: { kind: SnsKind; url: string; influence: number }[];
  agreeTerms?: boolean; // 이용약관 + 개인정보 수집·이용 동의 (필수)
}
interface OwnerSignup {
  role: "owner";
  email: string;
  password: string;
  storeName: string;
  category: string;
  area: string;
  bizNumber?: string; // 사업자등록번호 10자리 (확정 정책 9 — 필수, 수기 인증 대상)
  agreeTerms?: boolean; // 이용약관 + 개인정보 수집·이용 동의 (필수)
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ReviewerSignup | OwnerSignup;
  const db = await getDBAsync();

  let email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  // 이용약관·개인정보 수집 동의 — 법적 필수 (개인정보보호법)
  if (!body.agreeTerms) {
    return NextResponse.json({ error: "이용약관과 개인정보 수집·이용에 동의해주세요" }, { status: 400 });
  }

  if (body.role === "reviewer") {
    // ── 휴대폰 인증 (2026-07-23 — 체험자 PK) ──
    // 인증번호 검증 성공 시 발급된 증빙 쿠키와 제출 번호가 일치해야 가입할 수 있다 (위조 403).
    const phone = normalizePhone(body.phone);
    if (!phone) return NextResponse.json({ error: "휴대폰 번호를 확인해주세요" }, { status: 400 });
    const proofPhone = await readPhoneProof();
    if (proofPhone !== phone) {
      return NextResponse.json({ error: "휴대폰 인증을 완료해주세요" }, { status: 403 });
    }
    if (db.reviewers.some((r) => r.phone === phone)) {
      return NextResponse.json({ error: "이미 가입된 휴대폰 번호예요 — 로그인해주세요" }, { status: 409 });
    }

    // ── 간편로그인 가입 vs 이메일 가입 ──
    let socialLink: Reviewer["social"];
    let passwordHash: string;
    if (body.social) {
      const proof = await readSocialSignupProof();
      if (!proof) return NextResponse.json({ error: "소셜 로그인 정보가 만료됐어요 — 다시 시도해주세요" }, { status: 403 });
      if (db.reviewers.some((r) => r.social?.[proof.provider] === proof.sid)) {
        return NextResponse.json({ error: "이미 가입된 소셜 계정이에요 — 간편로그인으로 로그인해주세요" }, { status: 409 });
      }
      socialLink = { [proof.provider]: proof.sid };
      // 소셜 계정은 비밀번호 로그인 미사용 — 추측 불가 무작위 해시
      passwordHash = bcrypt.hashSync(crypto.randomBytes(24).toString("hex"), 8);
      // 이메일은 프로바이더 제공값(또는 입력값) — 둘 다 없으면 내부 유니크 값으로 대체
      email = email || proof.email.toLowerCase() || `${proof.provider}_${proof.sid.slice(-10)}@social.catchpass.local`;
    } else {
      if (!email || !password) return NextResponse.json({ error: "이메일/비밀번호를 입력해주세요" }, { status: 400 });
      if (password.length < 6) return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다" }, { status: 400 });
      passwordHash = bcrypt.hashSync(password, 8);
    }
    if (db.reviewers.some((r) => r.email === email)) {
      return NextResponse.json({ error: "이미 가입된 이메일입니다" }, { status: 409 });
    }
    // 닉네임 중복 검증 (2026-08-18) — 앞뒤 공백 정리 후 대소문자 무시 비교.
    // 닉네임은 리뷰·초대 등에서 계정을 대표하는 표시명이라 풀 전체에서 유일해야 한다.
    const nickname = String(body.nickname || "").trim() || email.split("@")[0];
    const nickLower = nickname.toLowerCase();
    if (db.reviewers.some((r) => (r.nickname || "").trim().toLowerCase() === nickLower)) {
      return NextResponse.json({ error: "이미 사용 중인 닉네임입니다" }, { status: 409 });
    }

    const sns: SnsAccount[] = (body.sns || []).filter((s) => s.url).map((s) => ({
      kind: s.kind,
      url: s.url,
      influence: Number(s.influence) || 0,
    }));
    const channelGrades = channelGradesFromSns(sns);
    const grade = bestGrade(Object.values(channelGrades));
    const reviewer: Reviewer = {
      id: rid("rv"),
      email,
      passwordHash,
      phone,
      phoneVerifiedAt: Date.now(),
      ...(socialLink ? { social: socialLink } : {}),
      nickname,
      sns,
      grade,
      channelGrades,
      createdAt: Date.now(),
      termsAgreedAt: Date.now(),
      completedReviews: 0,
      qualityScore: 0,
      noShowCount: 0,
    };
    db.reviewers.push(reviewer);
    await saveDBAsync();
    await clearPhoneProof();
    if (body.social) await clearSocialSignupProof();
    await createSession({ userId: reviewer.id, role: "reviewer" });
    return NextResponse.json({ ok: true, grade });
  } else {
    if (!email || !password) return NextResponse.json({ error: "이메일/비밀번호를 입력해주세요" }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다" }, { status: 400 });
    if (db.owners.some((o) => o.email === email)) {
      return NextResponse.json({ error: "이미 가입된 이메일입니다" }, { status: 409 });
    }
    // 사업자 인증 (확정 정책 9) — 가입 시 사업자등록번호 필수(형식 검증),
    // pending으로 시작해 운영팀 수기 확인(영업일 2~3일) 후 verified.
    const bizNumber = String(body.bizNumber || "").replace(/\D/g, "");
    if (bizNumber.length !== 10) {
      return NextResponse.json({ error: "사업자등록번호 10자리를 입력해주세요" }, { status: 400 });
    }
    const owner: Owner = {
      id: rid("ow"),
      email,
      passwordHash: bcrypt.hashSync(password, 8),
      storeName: body.storeName,
      category: body.category,
      area: body.area,
      plan: "Free",
      createdAt: Date.now(),
      termsAgreedAt: Date.now(),
      bizNumber,
      bizStatus: "pending",
    };
    db.owners.push(owner);
    const store: Store = {
      id: rid("st"),
      ownerId: owner.id,
      name: body.storeName,
      category: body.category,
      area: body.area,
      coverEmoji: "🏪",
      rating: 0,
      reviewCount: 0,
      hours: "11:00 - 21:00",
    };
    db.stores.push(store);
    await saveDBAsync();
    await createSession({ userId: owner.id, role: "owner" });
    return NextResponse.json({ ok: true });
  }
}
