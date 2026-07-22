// KFTC 오픈뱅킹 키 스모크 테스트 — 발급받은 Client ID/Secret이 실제로 동작하는지
// 앱 실행 없이 30초 안에 확인한다 (.env.local의 키를 자동 로드).
//
// 사용:
//   node scripts/kftc-smoke.mjs                          # 토큰 발급만 확인 (기본: 테스트베드)
//   node scripts/kftc-smoke.mjs 097 1101230000678 880101 # + 계좌실명조회 (은행코드 계좌번호 생년월일)
//   KFTC_API_BASE=https://openapi.openbanking.or.kr node scripts/kftc-smoke.mjs ...  # 운영망 실계좌 확인
//
// ※ 테스트베드 실명조회는 KFTC가 제공/등록한 테스트 계좌 데이터로만 A0000(성공)이 나온다
//   (시뮬레이터 — 실계좌 조회 불가). 임의 계좌는 "실명 확인 불가" 류 응답이 정상.
//   실계좌 검증은 운영망 + 이용기관 승인 운영키 조합에서만 가능하다.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// .env.local 로드 (외부 패키지 없이)
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const BASE = process.env.KFTC_API_BASE || "https://testapi.openbanking.or.kr";
const ID = process.env.KFTC_CLIENT_ID;
const SECRET = process.env.KFTC_CLIENT_SECRET;
const ORG = process.env.KFTC_ORG_CODE || "M202601033";

if (!ID || !SECRET) {
  console.error("✗ KFTC_CLIENT_ID / KFTC_CLIENT_SECRET이 없습니다 — .env.local을 확인하세요.");
  process.exit(1);
}
console.log(`베이스: ${BASE}`);
console.log(`Client ID: ${ID.slice(0, 8)}… (마스킹)`);

// 1) 2-legged 토큰 발급
const tokenRes = await fetch(`${BASE}/oauth/2.0/token`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: ID, client_secret: SECRET, scope: "oob", grant_type: "client_credentials" }),
});
const token = await tokenRes.json().catch(() => ({}));
if (!tokenRes.ok || !token.access_token) {
  console.error(`✗ 토큰 발급 실패 (${tokenRes.status}):`, token.error_description || token.rsp_message || token);
  console.error("  → Client ID/Secret 값, 앱 상태(승인 여부)를 콘솔에서 확인하세요.");
  process.exit(1);
}
console.log(`✓ 토큰 발급 성공 — scope=${token.scope ?? "oob"}, expires_in=${token.expires_in}s${token.client_use_code ? `, 이용기관코드=${token.client_use_code}` : ""}`);
if (token.client_use_code && token.client_use_code !== ORG) {
  console.log(`  ⚠ .env.local의 KFTC_ORG_CODE(${ORG})와 응답 이용기관코드(${token.client_use_code})가 다릅니다 — KFTC_ORG_CODE=${token.client_use_code} 로 설정하세요.`);
}

// 2) (선택) 계좌실명조회
const [bankCode, accountNum, birthday] = process.argv.slice(2);
if (!bankCode) {
  console.log("· 계좌실명조회까지 확인하려면: node scripts/kftc-smoke.mjs <은행코드3> <계좌번호> <생년월일6>");
  process.exit(0);
}
const rand = crypto.randomBytes(6).toString("base64url").replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 9).padEnd(9, "0");
const d = new Date();
const p2 = (n) => String(n).padStart(2, "0");
const rnRes = await fetch(`${BASE}/v2.0/inquiry/real_name`, {
  method: "POST",
  headers: { "content-type": "application/json; charset=UTF-8", Authorization: `Bearer ${token.access_token}` },
  body: JSON.stringify({
    bank_tran_id: `${token.client_use_code || ORG}U${rand}`,
    bank_code_std: bankCode,
    account_num: accountNum,
    account_holder_info_type: " ",
    account_holder_info: birthday,
    tran_dtime: `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`,
  }),
});
const rn = await rnRes.json().catch(() => ({}));
console.log(`실명조회 응답 (${rnRes.status}): rsp_code=${rn.rsp_code} ${rn.rsp_message ?? ""}`);
if (rn.rsp_code === "A0000") {
  console.log(`✓ 예금주: ${rn.account_holder_name}`);
} else {
  console.log("  → A0000이 아니어도 응답이 왔다면 연동 자체는 정상입니다 (테스트베드 등록 계좌로 재시도).");
}
