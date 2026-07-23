import { NextRequest, NextResponse } from "next/server";
import { getDBAsync } from "@/lib/db";
import { createSession } from "@/lib/auth";
import {
  isSocialProvider,
  socialConfigured,
  exchangeSocialToken,
  fetchSocialIdentity,
  setSocialSignupProof,
  type SocialIdentity,
} from "@/lib/social-login";

export const runtime = "nodejs";

const STATE_COOKIE = "cp_social_state_v1";

// 간편로그인 콜백 (2026-07-23) — 프로바이더 고유 ID로 기존 계정이면 로그인,
// 미가입이면 신원을 서명 쿠키에 담아 가입 플로우(휴대폰 인증 필수)로 보낸다.
// 액세스 토큰은 신원 조회 직후 폐기 — 저장하지 않는다.
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const origin = req.nextUrl.origin;
  if (!isSocialProvider(provider)) {
    return NextResponse.redirect(`${origin}/r/login?error=${encodeURIComponent("지원하지 않는 로그인 방식이에요")}`);
  }
  const q = req.nextUrl.searchParams;

  let identity: SocialIdentity;
  if (q.get("demo") === "1") {
    // 데모 로그인 — 실키 설정 환경에서는 차단 (데모 검증 403 관례)
    if (socialConfigured(provider)) {
      return NextResponse.json({ error: "데모 로그인은 실 키가 설정된 환경에서 사용할 수 없습니다" }, { status: 403 });
    }
    const id = String(q.get("id") || "").slice(0, 64);
    if (!id) return NextResponse.redirect(`${origin}/r/login?error=${encodeURIComponent("데모 로그인 정보가 없어요")}`);
    identity = { id: `demo-${id}`, nickname: String(q.get("name") || "").slice(0, 30) || undefined };
  } else {
    const code = q.get("code");
    const state = q.get("state") || "";
    const saved = req.cookies.get(STATE_COOKIE)?.value;
    if (!code || !saved || saved !== state) {
      return NextResponse.redirect(`${origin}/r/login?error=${encodeURIComponent("로그인이 취소되었거나 만료됐어요")}`);
    }
    try {
      const token = await exchangeSocialToken(provider, code, origin, state);
      identity = await fetchSocialIdentity(provider, token); // 토큰은 이후 사용·저장하지 않음
    } catch {
      return NextResponse.redirect(`${origin}/r/login?error=${encodeURIComponent("소셜 로그인에 실패했어요 — 다시 시도해주세요")}`);
    }
  }

  const db = await getDBAsync();
  const existing = db.reviewers.find((r) => r.social?.[provider] === identity.id);
  if (existing) {
    await createSession({ userId: existing.id, role: "reviewer" });
    const res = NextResponse.redirect(`${origin}/r/home`);
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  // 미가입 — 신원 증빙(15분) 후 가입 플로우로. 닉네임·이메일은 프리필용 쿼리로도 전달(민감정보 아님)
  await setSocialSignupProof(provider, identity);
  const p = new URLSearchParams({ social: provider });
  if (identity.nickname) p.set("nick", identity.nickname);
  if (identity.email) p.set("email", identity.email);
  const res = NextResponse.redirect(`${origin}/r/signup?${p}`);
  res.cookies.delete(STATE_COOKIE);
  return res;
}
