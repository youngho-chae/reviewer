import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import {
  isSnsKind,
  oauthConfigured,
  exchangeToken,
  fetchIdentity,
  deriveChannelUrl,
  applySnsConnect,
} from "@/lib/sns-oauth";
import { encodeSnsState } from "@/lib/sns-cookie";

export const runtime = "nodejs";

// OAuth 콜백 — state(CSRF) 검증 → code 교환 → 신원 조회 → 검증 연동 저장.
// 액세스 토큰은 저장하지 않는다(신원 조회 직후 폐기). 실패 시 기존 연동 상태 불변,
// /r/me/channels?error= 로 복귀만 한다.
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const origin = new URL(req.url).origin;
  const back = (q: string) => NextResponse.redirect(`${origin}/r/me/channels?${q}`);

  const s = await readSession();
  if (!s || s.role !== "reviewer") return NextResponse.redirect(`${origin}/r/login`);
  const { provider } = await params;
  if (!isSnsKind(provider) || !oauthConfigured(provider)) return back("error=provider");

  const sp = new URL(req.url).searchParams;
  const code = sp.get("code") || "";
  const state = sp.get("state") || "";
  const savedState = req.cookies.get("cp_oauth_state")?.value || "";
  if (!code || !state || !savedState || state !== savedState) {
    return back("error=state"); // CSRF/만료 — 재시도 유도
  }
  let pending: { url?: string; influence?: number } = {};
  try {
    pending = JSON.parse(req.cookies.get("cp_sns_pending")?.value || "{}");
  } catch {}

  try {
    const token = await exchangeToken(provider, code, origin, state);
    const identity = await fetchIdentity(provider, token);
    const db = await getDBAsync();
    const applied = applySnsConnect(db, s.userId, {
      kind: provider,
      url: deriveChannelUrl(provider, identity, pending.url || ""),
      influence: identity.followers ?? Math.max(0, Number(pending.influence) || 0),
      verified: true,
      verifiedAt: Date.now(),
      verifiedVia: "oauth",
      providerAccountId: identity.accountId,
      accountName: identity.accountName,
    });
    if (!applied.ok) return back("error=apply");
    await saveDBAsync();
    const res = back(`connected=${provider}`);
    res.cookies.delete("cp_oauth_state");
    res.cookies.delete("cp_sns_pending");
    // 인스턴스 불일치 스톱갭 — 본인 시점 즉시 반영 (sns-cookie.ts)
    const me = db.reviewers.find((r) => r.id === s.userId);
    if (me) {
      const c = encodeSnsState(me.id, me.sns);
      res.cookies.set(c.name, c.value, { httpOnly: true, sameSite: "lax", path: "/", maxAge: c.maxAge });
    }
    return res;
  } catch (e) {
    console.warn(`[sns-oauth] ${provider} callback failed`, e);
    return back("error=oauth");
  }
}
