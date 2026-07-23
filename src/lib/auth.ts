import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// 세션 서명 키 — 운영 배포에서는 AUTH_SECRET 환경변수(32자 이상 무작위 문자열)가 필수.
// 운영에서 미설정 시 공개된 개발용 키로 세션을 서명하면 위조가 가능하므로, 실제 서명·검증 시점에
// 예외를 던져 부팅이 아닌 요청을 fail-closed로 차단한다(빌드 시 모듈 임포트만으로는 던지지 않음).
// 개발/테스트 환경에서만 개발용 폴백 키를 허용한다.
let _secret: Uint8Array | null = null;
function getSecret(): Uint8Array {
  if (_secret) return _secret;
  const s = process.env.AUTH_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[SECURITY] AUTH_SECRET 미설정 — 운영 배포에는 AUTH_SECRET(32자 이상 무작위)이 반드시 필요합니다.",
      );
    }
    _secret = new TextEncoder().encode("catchpass-dev-secret-do-not-use-in-prod");
    return _secret;
  }
  _secret = new TextEncoder().encode(s);
  return _secret;
}

// 세션 외 단기 증빙 토큰(휴대폰 인증·소셜 가입 등)도 같은 키·규율로 서명한다
export function authSecret(): Uint8Array {
  return getSecret();
}

export type Role = "reviewer" | "owner" | "admin";
export interface SessionClaims {
  userId: string;
  role: Role;
}

const COOKIE = "catchpass_session";

export async function createSession(claims: SessionClaims) {
  const token = await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function readSession(): Promise<SessionClaims | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return { userId: String(payload.userId), role: payload.role as Role };
  } catch {
    return null;
  }
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
