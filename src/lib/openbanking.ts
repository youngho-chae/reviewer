// ─────────────────────────────────────────────────────────────
// 금융결제원(KFTC) 오픈뱅킹 — 계좌실명조회 연동 (2026-07-12 출금 고도화)
// 문서: https://developers.kftc.or.kr/dev/openapi/open-banking/account
//
// 출금 신청 전 "본인 계좌 인증": 이용기관 2-legged 토큰(client_credentials, scope=oob)으로
// 계좌실명조회(POST /v2.0/inquiry/real_name)를 호출해 입력한 예금주와 실제 예금주를 대조한다.
//  - 실계좌번호 사용(핀테크이용번호 아님) · account_holder_info = 생년월일 6자리
//  - bank_tran_id = 이용기관코드(10자리) + "U" + 거래고유번호(9자리 영숫자)
//  - 액세스 토큰은 메모리 캐시만 — 저장하지 않는다 (SNS OAuth와 동일 원칙)
//
// env (.env.local — 발급받은 키를 여기에):
//   KFTC_CLIENT_ID / KFTC_CLIENT_SECRET  : 오픈뱅킹 앱의 Client ID·Secret (필수)
//   KFTC_ORG_CODE                        : 이용기관코드 10자리 (미설정 시 테스트베드 예시값)
//   KFTC_API_BASE                        : 명시 오버라이드 (스텁/테스트베드/운영). 미설정 시
//                                          배포(Vercel/production)=운영망 · 로컬=테스트베드 기본.
// 키 미설정 시에는 데모 인증 모드(입력 예금주를 그대로 승인·verifiedVia "demo")로 동작한다.
//
// ★ 실계좌 인증의 환경 조건 (2026-07-16 — KFTC 구조적 제약, 코드로 우회 불가):
//   테스트베드(testapi)는 은행 원장에 연결되지 않은 "시뮬레이터" — 실제 계좌·임의 계좌는
//   조회 자체가 불가능하고, 개발자사이트 [마이페이지→테스트 관리→테스트 데이터 관리]에
//   등록된 테스트 계좌 조합만 응답이 존재한다. 실제 계좌가 실제로 조회·검증되는 것은
//   운영망(openapi.openbanking.or.kr)을 운영 승인 키로 호출할 때뿐 — 배포 환경은 기본으로
//   운영망을 호출하며(2026-07-16, Vercel 실키 등록에 따른 지시 반영), 테스트 힌트·배너는
//   운영망에서 자동 비활성. 배포에서 테스트베드가 필요하면 KFTC_API_BASE로 명시한다.
// ─────────────────────────────────────────────────────────────

import crypto from "node:crypto";

const TESTBED_BASE = "https://testapi.openbanking.or.kr";
const PRODUCTION_BASE = "https://openapi.openbanking.or.kr";

export function openbankingConfigured(): boolean {
  return !!(process.env.KFTC_CLIENT_ID && process.env.KFTC_CLIENT_SECRET);
}

// 테스트베드/스텁 여부 — 운영망(openapi.openbanking.or.kr)이 아니면 true.
// 예금주 힌트 등 테스트 보조 정보는 테스트베드에서만 노출한다 (운영에서는 미노출).
export function isTestbedBase(): boolean {
  return !apiBase().startsWith(PRODUCTION_BASE);
}

function apiBase(): string {
  // 우선순위: KFTC_API_BASE 명시(스텁/테스트베드/운영 어디든) → 환경 기본값.
  // 배포(Vercel/production) 기본 = 운영망 — Vercel에 등록된 실키로 실계좌 실명조회를 호출한다
  // (2026-07-16 지시 반영. 배포에서 테스트베드를 쓰려면 KFTC_API_BASE로 명시).
  // 로컬 개발 기본 = 테스트베드 — 실수로 운영망을 호출하지 않도록.
  if (process.env.KFTC_API_BASE) return process.env.KFTC_API_BASE;
  if (process.env.VERCEL || process.env.NODE_ENV === "production") return PRODUCTION_BASE;
  return TESTBED_BASE;
}

function orgCodeFallback(): string {
  // 이용기관코드 10자리 — 우선순위: 토큰 응답의 client_use_code(자동) → env → 발급 코드 기본값.
  // bank_tran_id 앞자리가 실제 이용기관코드와 다르면 "요청전문 포맷 에러"가 응답되므로,
  // 토큰 발급 시 KFTC가 알려주는 client_use_code를 캐시해 자동 사용한다 (설정 불필요).
  // 기본값 = 발급받은 이용기관코드(2026-07-16 반영 — 전문에 노출되는 공개 값, 시크릿 아님).
  return process.env.KFTC_ORG_CODE || "M202601033";
}

// 은행명 → 표준 은행코드 — src/lib/bank-codes.ts (클라이언트 안전 모듈)에서 관리
export { BANK_CODES, bankCodeOf } from "./bank-codes";

// ── 이용기관 토큰 (2-legged) — 메모리 캐시 (client_use_code = 이용기관코드 포함) ──
let cachedToken: { token: string; expiresAt: number; orgCode: string } | null = null;

async function getOrgToken(): Promise<{ token: string; orgCode: string }> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return { token: cachedToken.token, orgCode: cachedToken.orgCode };
  }
  const res = await fetch(`${apiBase()}/oauth/2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.KFTC_CLIENT_ID ?? "",
      client_secret: process.env.KFTC_CLIENT_SECRET ?? "",
      scope: "oob",
      grant_type: "client_credentials",
    }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    // 어느 망을 호출했는지 명시 — 운영망 인증 실패의 최다 원인은 "테스트베드용 키" (운영키는 이용기관 승인 후 별도 발급)
    const net = isTestbedBase() ? "테스트베드" : "운영망";
    const reason = data.error_description || data.rsp_message || "Client ID/Secret을 확인해주세요";
    const hint = isTestbedBase() ? "" : " — 운영 승인 키인지 확인해주세요 (테스트베드용 키는 운영망에서 사용할 수 없어요)";
    throw new Error(`오픈뱅킹 토큰 발급 실패 (${net}, ${res.status}): ${reason}${hint}`);
  }
  // 이용기관코드 자동 채택 — 토큰 응답의 client_use_code가 정답 (env는 수동 오버라이드용).
  // "bank_tran_id 앞자리가 이용기관코드와 다릅니다" 오류의 원인 제거 (2026-07-16 정정).
  const orgCode = String(data.client_use_code || process.env.KFTC_ORG_CODE || orgCodeFallback());
  // expires_in 초 단위 (기관 토큰은 장기) — 여유 두고 캐시
  cachedToken = {
    token: data.access_token,
    expiresAt: now + Math.min(Number(data.expires_in || 3600), 86400) * 1000,
    orgCode,
  };
  return { token: cachedToken.token, orgCode };
}

// bank_tran_id — 이용기관코드(10) + "U" + 9자리 영숫자 (요청마다 유일)
function newBankTranId(orgCode: string): string {
  const rand = crypto.randomBytes(6).toString("base64url").replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 9).padEnd(9, "0");
  return `${orgCode}U${rand}`;
}

function tranDtime(): string {
  const d = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export interface RealNameResult {
  ok: boolean;
  holderName?: string; // 조회된 예금주 성명
  rspCode?: string;
  message?: string;
}

// 계좌실명조회 — 입력 예금주와 조회 예금주 대조는 호출자가 수행 (원문 성명 반환)
export async function inquireRealName(params: {
  bankCodeStd: string;
  accountNum: string;
  birthday: string; // 생년월일 6자리 (주민번호 앞자리)
}): Promise<RealNameResult> {
  const { token, orgCode } = await getOrgToken();
  const res = await fetch(`${apiBase()}/v2.0/inquiry/real_name`, {
    method: "POST",
    headers: { "content-type": "application/json; charset=UTF-8", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      bank_tran_id: newBankTranId(orgCode),
      bank_code_std: params.bankCodeStd,
      account_num: params.accountNum,
      account_holder_info_type: " ", // 개인 — 생년월일
      account_holder_info: params.birthday,
      tran_dtime: tranDtime(),
    }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, rspCode: data.rsp_code, message: data.rsp_message || `계좌 조회 실패 (${res.status})` };
  }
  // A0000 = 성공 (그 외는 사유 메시지 그대로 전달)
  if (data.rsp_code !== "A0000") {
    return { ok: false, rspCode: data.rsp_code, message: data.rsp_message || "계좌 정보를 확인할 수 없습니다" };
  }
  return { ok: true, holderName: String(data.account_holder_name ?? "").trim(), rspCode: data.rsp_code };
}

// ── 인증 증빙 (서명 토큰) ──
// verify-account 성공 시 서버가 서명한 증빙을 httpOnly 쿠키로 내려주고,
// 출금 신청 API가 동일 계좌 정보에 대한 유효한 증빙인지 검증한다 (위조 방지 — HMAC).
export const ACCT_VERIFY_COOKIE = "cp_acct_verify_v1";
export const ACCT_VERIFY_TTL_MS = 10 * 60 * 1000; // 인증 후 10분 내 출금 신청

export interface AccountVerifyProof {
  reviewerId: string;
  bank: string;
  account: string;
  holder: string;
  via: "openbanking" | "demo";
  at: number;
}

function hmacSecret(): string {
  return process.env.AUTH_SECRET || "catchpass-dev-secret-do-not-use-in-prod";
}

export function signAccountProof(proof: AccountVerifyProof): string {
  const payload = Buffer.from(JSON.stringify(proof)).toString("base64url");
  const sig = crypto.createHmac("sha256", hmacSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyAccountProof(token: string | undefined | null): AccountVerifyProof | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expect = crypto.createHmac("sha256", hmacSecret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const proof = JSON.parse(Buffer.from(payload, "base64url").toString()) as AccountVerifyProof;
    if (Date.now() - proof.at > ACCT_VERIFY_TTL_MS) return null;
    return proof;
  } catch {
    return null;
  }
}
