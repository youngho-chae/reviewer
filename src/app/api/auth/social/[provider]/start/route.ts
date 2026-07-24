import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { isSocialProvider, socialConfigured, buildSocialAuthorizeUrl } from "@/lib/social-login";

export const runtime = "nodejs";

const STATE_COOKIE = "cp_social_state_v1";
const NEXT_COOKIE = "cp_login_next_v1";

// 로그인 후 복귀 경로 검증 — 내부 체험자 경로만 허용 (open redirect 방지)
function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  return raw.startsWith("/r/") && !raw.startsWith("//") ? raw : null;
}

// 간편로그인 시작 (2026-07-23) — 키 설정 시 프로바이더 인가 페이지로, 미설정 시 데모 로그인으로 폴백.
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  if (!isSocialProvider(provider)) {
    return NextResponse.json({ error: "지원하지 않는 로그인 방식입니다" }, { status: 400 });
  }
  const origin = req.nextUrl.origin;
  // 게스트 브라우징 (2026-07-24) — 로그인 후 보던 화면 복귀. 콜백은 서버 redirect라
  // 쿼리를 이어줄 수 없어 쿠키(10분)로 왕복한다 (데모 폴백 경로도 동일 쿠키 공유).
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const nextCookie = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  };
  if (!socialConfigured(provider)) {
    // 데모 폴백 — 실키가 없는 환경에서 로그인 플로우를 그대로 시연 (실키 설정 시 데모 콜백 403)
    const res = NextResponse.redirect(`${origin}/r/login/social-demo?provider=${provider}`);
    if (next) res.cookies.set(NEXT_COOKIE, next, nextCookie);
    return res;
  }
  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildSocialAuthorizeUrl(provider, origin, state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
  if (next) res.cookies.set(NEXT_COOKIE, next, nextCookie);
  return res;
}
