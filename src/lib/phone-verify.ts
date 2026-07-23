// 휴대폰 번호 인증 (2026-07-23) — 체험자 가입 필수 절차.
//
// 휴대폰 번호는 체험자 계정의 PK다: 가입 시 인증번호(6자리) 발송 → 일치해야 가입 진행,
// 번호당 계정 1개(중복 가입 차단). 알림톡 발송 기반(운영정책서 §15.7)도 이 번호를 쓴다.
//
// [저장 최소화] 인증번호·인증 상태를 서버 DB에 저장하지 않는다 — 서명(JWT, AUTH_SECRET) 쿠키로만
// 왕복한다: OTP 쿠키(5분) → 검증 성공 시 증빙 쿠키(15분) → 가입 API가 증빙을 재검증(위조 403).
// KFTC 계좌 인증 증빙(openbanking)·SNS OAuth state 쿠키와 동일 규율.
//
// [실발송 이원화] SMS 프로바이더 키(SOLAPI_API_KEY/SECRET) 미설정이면 **데모 모드** —
// 발송 응답에 인증번호를 포함해 화면에 "데모 모드" 배너로 노출한다(지도·오픈뱅킹·SNS 검증과 동일 관례).
// 실키 설정 시 솔라피 단문 발송(SOLAPI_SENDER = 등록 발신번호 필수).

import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { authSecret } from "./auth";

const OTP_COOKIE = "cp_phone_otp_v1";
const PROOF_COOKIE = "cp_phone_proof_v1";
export const OTP_TTL_MIN = 5; // 인증번호 유효 5분
export const PROOF_TTL_MIN = 15; // 인증 완료 후 가입 완료까지 15분

// "01012345678" 형태로 정규화 — 휴대폰(01X) 10~11자리만 허용. 불일치 시 null.
export function normalizePhone(v: unknown): string | null {
  const digits = String(v ?? "").replace(/\D/g, "");
  return /^01[016789]\d{7,8}$/.test(digits) ? digits : null;
}

// "010-1234-5678" 표기 (화면·운영 콘솔용)
export function fmtPhone(phone: string): string {
  if (phone.length === 11) return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
  if (phone.length === 10) return `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`;
  return phone;
}

export function smsConfigured(): boolean {
  return !!process.env.SOLAPI_API_KEY && !!process.env.SOLAPI_API_SECRET && !!process.env.SOLAPI_SENDER;
}

// 인증번호 발급 — 6자리 무작위. OTP 쿠키(서명·5분)로 보관하고 코드를 반환한다.
// 데모 모드에서는 호출측이 이 코드를 응답에 포함해 화면에 노출한다.
export async function issueOtp(phone: string): Promise<string> {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const token = await new SignJWT({ phone, code })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${OTP_TTL_MIN}m`)
    .sign(authSecret());
  const jar = await cookies();
  jar.set(OTP_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OTP_TTL_MIN * 60,
  });
  return code;
}

// 인증번호 검증 — 성공 시 증빙 쿠키(15분) 발급, OTP 쿠키 폐기. 실패 사유 문자열 반환(성공 = null).
export async function verifyOtp(phone: string, code: string): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(OTP_COOKIE)?.value;
  if (!token) return "인증번호가 만료됐어요 — 다시 받아주세요";
  try {
    const { payload } = await jwtVerify(token, authSecret());
    if (String(payload.phone) !== phone) return "인증번호를 받은 번호와 달라요 — 다시 받아주세요";
    if (String(payload.code) !== String(code).trim()) return "인증번호가 일치하지 않아요";
  } catch {
    return "인증번호가 만료됐어요 — 다시 받아주세요";
  }
  jar.delete(OTP_COOKIE);
  const proof = await new SignJWT({ phone })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PROOF_TTL_MIN}m`)
    .sign(authSecret());
  jar.set(PROOF_COOKIE, proof, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PROOF_TTL_MIN * 60,
  });
  return null;
}

// 가입 API가 재검증하는 인증 증빙 — 유효하면 인증된 휴대폰 번호를 반환
export async function readPhoneProof(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(PROOF_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret());
    return String(payload.phone);
  } catch {
    return null;
  }
}

export async function clearPhoneProof() {
  const jar = await cookies();
  jar.delete(PROOF_COOKIE);
}

// 솔라피 단문 발송 (실키 설정 시) — HMAC-SHA256 서명 인증.
// 실패해도 가입 흐름을 막지 않도록 호출측에서 오류 메시지로 처리한다.
export async function sendSmsViaSolapi(to: string, text: string): Promise<void> {
  const apiKey = process.env.SOLAPI_API_KEY!;
  const apiSecret = process.env.SOLAPI_API_SECRET!;
  const sender = process.env.SOLAPI_SENDER!;
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString("hex");
  const signature = crypto.createHmac("sha256", apiSecret).update(date + salt).digest("hex");
  const res = await fetch("https://api.solapi.com/messages/v4/send", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
    },
    body: JSON.stringify({ message: { to, from: sender, text } }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(`SMS 발송 실패 (${res.status}) ${j?.errorMessage ?? ""}`);
  }
}
