import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDB, saveDB } from "@/lib/db";
import { rid } from "@/lib/ids";
import { createSession } from "@/lib/auth";
import { gradeFromSns } from "@/lib/grade";
import { Owner, Reviewer, SnsAccount, SnsKind, Store } from "@/lib/types";

export const runtime = "nodejs";

interface ReviewerSignup {
  role: "reviewer";
  email: string;
  password: string;
  nickname: string;
  sns?: { kind: SnsKind; url: string; influence: number }[];
}
interface OwnerSignup {
  role: "owner";
  email: string;
  password: string;
  storeName: string;
  category: string;
  area: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ReviewerSignup | OwnerSignup;
  const db = getDB();

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) return NextResponse.json({ error: "이메일/비밀번호를 입력해주세요" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다" }, { status: 400 });

  if (body.role === "reviewer") {
    if (db.reviewers.some((r) => r.email === email)) {
      return NextResponse.json({ error: "이미 가입된 이메일입니다" }, { status: 409 });
    }
    const sns: SnsAccount[] = (body.sns || []).filter((s) => s.url).map((s) => ({
      kind: s.kind,
      url: s.url,
      influence: Number(s.influence) || 0,
    }));
    const grade = gradeFromSns(sns);
    const reviewer: Reviewer = {
      id: rid("rv"),
      email,
      passwordHash: bcrypt.hashSync(password, 8),
      nickname: body.nickname || email.split("@")[0],
      sns,
      grade,
      createdAt: Date.now(),
      completedReviews: 0,
      qualityScore: 0,
      noShowCount: 0,
    };
    db.reviewers.push(reviewer);
    saveDB();
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
      plan: "Standard",
      createdAt: Date.now(),
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
    saveDB();
    await createSession({ userId: owner.id, role: "owner" });
    return NextResponse.json({ ok: true });
  }
}
