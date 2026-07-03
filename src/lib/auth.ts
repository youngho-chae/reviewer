import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// 세션 서명 키 — 운영 배포에서는 AUTH_SECRET 환경변수(32자 이상 무작위 문자열)가 필수.
// 폴백 키는 공개된 값이므로 이대로 배포하면 세션 위조가 가능하다 (VER.1 출시 체크리스트 항목).
if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
  console.error(
    "[SECURITY] AUTH_SECRET 미설정 — 공개된 개발용 키로 세션이 서명됩니다. 운영 배포 전 반드시 설정하세요.",
  );
}
const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "catchpass-dev-secret-please-override-in-prod"
);

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
    .sign(SECRET);

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
    const { payload } = await jwtVerify(token, SECRET);
    return { userId: String(payload.userId), role: payload.role as Role };
  } catch {
    return null;
  }
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
