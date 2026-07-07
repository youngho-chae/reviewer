import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { rid } from "@/lib/ids";
import { createSession } from "@/lib/auth";
import { channelGradesFromSns, bestGrade } from "@/lib/grade";
import { Owner, Reviewer, SnsAccount, SnsKind, Store } from "@/lib/types";

export const runtime = "nodejs";

interface ReviewerSignup {
  role: "reviewer";
  email: string;
  password: string;
  nickname: string;
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
  agreeTerms?: boolean; // 이용약관 + 개인정보 수집·이용 동의 (필수)
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ReviewerSignup | OwnerSignup;
  const db = await getDBAsync();

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) return NextResponse.json({ error: "이메일/비밀번호를 입력해주세요" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다" }, { status: 400 });
  // 이용약관·개인정보 수집 동의 — 법적 필수 (개인정보보호법)
  if (!body.agreeTerms) {
    return NextResponse.json({ error: "이용약관과 개인정보 수집·이용에 동의해주세요" }, { status: 400 });
  }

  if (body.role === "reviewer") {
    if (db.reviewers.some((r) => r.email === email)) {
      return NextResponse.json({ error: "이미 가입된 이메일입니다" }, { status: 409 });
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
      passwordHash: bcrypt.hashSync(password, 8),
      nickname: body.nickname || email.split("@")[0],
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
    await createSession({ userId: reviewer.id, role: "reviewer" });
    return NextResponse.json({ ok: true, grade });
  } else {
    if (db.owners.some((o) => o.email === email)) {
      return NextResponse.json({ error: "이미 가입된 이메일입니다" }, { status: 409 });
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
