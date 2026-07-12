import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { readSession } from "@/lib/auth";
import { isSnsKind, oauthConfigured, buildAuthorizeUrl } from "@/lib/sns-oauth";

export const runtime = "nodejs";

// SNS 채널 본인 검증 시작 (2026-07-10).
//  - OAuth 키 설정 시: state(CSRF) 발급 → 프로바이더 인가 URL로 302.
//  - 키 미설정 시: 데모 검증 화면(/r/channels/verify)으로 302 — 플로우 시연용.
// pending 쿠키에 사용자가 입력한 url/influence를 보관해 콜백에서 사용한다.
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const s = await readSession();
  const origin = new URL(req.url).origin;
  if (!s || s.role !== "reviewer") {
    return NextResponse.redirect(`${origin}/r/login`);
  }
  const { provider } = await params;
  if (!isSnsKind(provider)) {
    return NextResponse.json({ error: "지원하지 않는 채널입니다" }, { status: 400 });
  }
  const sp = new URL(req.url).searchParams;
  const url = (sp.get("url") || "").slice(0, 300);
  const influence = String(Math.max(0, Number(sp.get("influence")) || 0));

  if (!oauthConfigured(provider)) {
    // 데모 검증 모드 — 실 프로바이더 로그인은 env 키 설정 시 자동 활성 (.env.example 참조)
    const q = new URLSearchParams({ provider, url, influence });
    return NextResponse.redirect(`${origin}/r/channels/verify?${q}`);
  }

  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildAuthorizeUrl(provider, origin, state));
  const cookieOpts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 600 };
  res.cookies.set("cp_oauth_state", state, cookieOpts);
  res.cookies.set("cp_sns_pending", JSON.stringify({ kind: provider, url, influence: Number(influence) }), cookieOpts);
  return res;
}
