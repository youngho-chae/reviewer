// 간편로그인 (2026-07-23) — 네이버·카카오 OAuth 로그인.
//
// 채널 "본인 검증" OAuth(sns-oauth.ts — 등급용 채널 귀속)와 별개로, **계정 로그인** 수단이다:
//   - 콜백에서 프로바이더 고유 ID를 얻어 Reviewer.social.{naver|kakao}와 대조 → 있으면 로그인,
//     없으면 서명 쿠키(cp_social_signup)에 신원을 담아 가입 플로우(휴대폰 인증 필수)로 보낸다.
//   - [개인정보 최소 수집] 액세스 토큰은 저장하지 않는다 — 신원 조회 직후 폐기(sns-oauth와 동일 규율).
//   - 키(env) 미설정 시 **데모 로그인** 폴백(/r/login/social-demo — 실키 설정 시 데모 콜백 403).
//
// env: 네이버 = NAVER_LOGIN_CLIENT_ID/SECRET (채널 검증과 동일 앱 재사용 가능 — 콜백 URI 추가 등록 필요)
//      카카오 = KAKAO_REST_API_KEY (+ KAKAO_CLIENT_SECRET — 카카오 콘솔에서 활성화한 경우만)

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { authSecret } from "./auth";

export type SocialProvider = "naver" | "kakao";

export const SOCIAL_LABEL: Record<SocialProvider, string> = { naver: "네이버", kakao: "카카오" };

export function isSocialProvider(v: string): v is SocialProvider {
  return v === "naver" || v === "kakao";
}

function creds(p: SocialProvider): { id: string; secret: string } {
  if (p === "naver") {
    return { id: process.env.NAVER_LOGIN_CLIENT_ID || "", secret: process.env.NAVER_LOGIN_CLIENT_SECRET || "" };
  }
  return { id: process.env.KAKAO_REST_API_KEY || "", secret: process.env.KAKAO_CLIENT_SECRET || "" };
}

// 키 설정 여부 — false면 데모 로그인 폴백 (카카오 secret은 콘솔 옵션이라 REST 키만 필수)
export function socialConfigured(p: SocialProvider): boolean {
  const { id, secret } = creds(p);
  return p === "naver" ? !!id && !!secret : !!id;
}

export function socialRedirectUri(p: SocialProvider, origin: string): string {
  return `${origin}/api/auth/social/${p}/callback`;
}

export function buildSocialAuthorizeUrl(p: SocialProvider, origin: string, state: string): string {
  const { id } = creds(p);
  const cb = socialRedirectUri(p, origin);
  if (p === "naver") {
    const q = new URLSearchParams({ response_type: "code", client_id: id, redirect_uri: cb, state });
    return `https://nid.naver.com/oauth2.0/authorize?${q}`;
  }
  const q = new URLSearchParams({ response_type: "code", client_id: id, redirect_uri: cb, state });
  return `https://kauth.kakao.com/oauth/authorize?${q}`;
}

export async function exchangeSocialToken(p: SocialProvider, code: string, origin: string, state: string): Promise<string> {
  const { id, secret } = creds(p);
  const cb = socialRedirectUri(p, origin);
  if (p === "naver") {
    const q = new URLSearchParams({ grant_type: "authorization_code", client_id: id, client_secret: secret, code, state });
    const res = await fetch(`https://nid.naver.com/oauth2.0/token?${q}`);
    const j = await res.json();
    if (!j.access_token) throw new Error(`naver token: ${j.error_description || j.error || res.status}`);
    return j.access_token as string;
  }
  const body = new URLSearchParams({ grant_type: "authorization_code", client_id: id, redirect_uri: cb, code });
  if (secret) body.set("client_secret", secret);
  const res = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
  });
  const j = await res.json();
  if (!j.access_token) throw new Error(`kakao token: ${j.error_description || j.error || res.status}`);
  return j.access_token as string;
}

export interface SocialIdentity {
  id: string; // 프로바이더 고유 ID
  nickname?: string;
  email?: string;
}

export async function fetchSocialIdentity(p: SocialProvider, token: string): Promise<SocialIdentity> {
  if (p === "naver") {
    const res = await fetch("https://openapi.naver.com/v1/nid/me", { headers: { Authorization: `Bearer ${token}` } });
    const j = await res.json();
    const r = j.response;
    if (!r?.id) throw new Error(`naver profile: ${j.message || res.status}`);
    return { id: String(r.id), nickname: r.nickname || r.name || undefined, email: r.email || undefined };
  }
  const res = await fetch("https://kapi.kakao.com/v2/user/me", { headers: { Authorization: `Bearer ${token}` } });
  const j = await res.json();
  if (!j?.id) throw new Error(`kakao profile: ${j.msg || res.status}`);
  return {
    id: String(j.id),
    nickname: j.kakao_account?.profile?.nickname || j.properties?.nickname || undefined,
    email: j.kakao_account?.email || undefined,
  };
}

// ── 소셜 가입 증빙 쿠키 — 콜백(미가입 신원) → 가입 API 사이 왕복 (15분, 서명) ──

const SIGNUP_COOKIE = "cp_social_signup_v1";

export async function setSocialSignupProof(p: SocialProvider, identity: SocialIdentity) {
  const token = await new SignJWT({ provider: p, sid: identity.id, nickname: identity.nickname ?? "", email: identity.email ?? "" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(authSecret());
  const jar = await cookies();
  jar.set(SIGNUP_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 15 * 60,
  });
}

export async function readSocialSignupProof(): Promise<{ provider: SocialProvider; sid: string; nickname: string; email: string } | null> {
  const jar = await cookies();
  const token = jar.get(SIGNUP_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret());
    const provider = String(payload.provider);
    if (!isSocialProvider(provider)) return null;
    return { provider, sid: String(payload.sid), nickname: String(payload.nickname ?? ""), email: String(payload.email ?? "") };
  } catch {
    return null;
  }
}

export async function clearSocialSignupProof() {
  const jar = await cookies();
  jar.delete(SIGNUP_COOKIE);
}
