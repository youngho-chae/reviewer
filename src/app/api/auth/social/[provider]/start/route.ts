import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { isSocialProvider, socialConfigured, buildSocialAuthorizeUrl } from "@/lib/social-login";

export const runtime = "nodejs";

const STATE_COOKIE = "cp_social_state_v1";

// 간편로그인 시작 (2026-07-23) — 키 설정 시 프로바이더 인가 페이지로, 미설정 시 데모 로그인으로 폴백.
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  if (!isSocialProvider(provider)) {
    return NextResponse.json({ error: "지원하지 않는 로그인 방식입니다" }, { status: 400 });
  }
  const origin = req.nextUrl.origin;
  if (!socialConfigured(provider)) {
    // 데모 폴백 — 실키가 없는 환경에서 로그인 플로우를 그대로 시연 (실키 설정 시 데모 콜백 403)
    return NextResponse.redirect(`${origin}/r/login/social-demo?provider=${provider}`);
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
  return res;
}
