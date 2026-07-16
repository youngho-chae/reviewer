// KFTC 오픈뱅킹 스텁 서버 — 통합 테스트 전용 (실 서비스와 무관).
// 실 테스트베드(testapi.openbanking.or.kr)와 동일한 요청/응답 형태로
// ① 2-legged 토큰 발급(/oauth/2.0/token) ② 계좌실명조회(/v2.0/inquiry/real_name)를 흉내내
// KFTC_API_BASE 오버라이드로 실 코드 경로(토큰 캐시→실명조회→예금주 대조)를 e2e 검증한다.
//
// 사용: node scripts/kftc-stub.mjs   (포트 4500)
//   .env.local → KFTC_CLIENT_ID=stub-client-id / KFTC_CLIENT_SECRET=stub-secret
//                KFTC_API_BASE=http://127.0.0.1:4500
// 스텁 계좌 데이터: 어떤 은행이든 계좌번호 "1101230000678" + 생년월일 "880101" → 예금주 "박북촌"
import http from "node:http";

const PORT = 4500;
const VALID = { account: "1101230000678", birthday: "880101", holder: "박북촌" };
const TOKEN = "stub-org-access-token";

function json(res, code, body) {
  res.writeHead(code, { "content-type": "application/json; charset=UTF-8" });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

    if (req.method === "POST" && url.pathname === "/oauth/2.0/token") {
      const p = new URLSearchParams(raw);
      if (p.get("grant_type") !== "client_credentials" || p.get("scope") !== "oob") {
        return json(res, 400, { error: "invalid_request", error_description: "grant_type/scope" });
      }
      if (!p.get("client_id") || !p.get("client_secret")) {
        return json(res, 401, { error: "invalid_client", error_description: "client_id/secret required" });
      }
      return json(res, 200, { access_token: TOKEN, token_type: "Bearer", expires_in: 7776000, scope: "oob", client_use_code: "F123456789" });
    }

    if (req.method === "POST" && url.pathname === "/v2.0/inquiry/real_name") {
      if (req.headers.authorization !== `Bearer ${TOKEN}`) {
        return json(res, 401, { rsp_code: "O0002", rsp_message: "유효하지 않은 토큰" });
      }
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return json(res, 400, { rsp_code: "A0002", rsp_message: "요청 본문 오류" });
      }
      // bank_tran_id 형식 검증 — 이용기관코드(10) + U + 9자리
      if (!/^[A-Z0-9]{10}U[0-9A-Z]{9}$/.test(String(body.bank_tran_id || ""))) {
        return json(res, 400, { rsp_code: "A0003", rsp_message: "bank_tran_id 형식 오류" });
      }
      if (body.account_num === VALID.account && body.account_holder_info === VALID.birthday) {
        return json(res, 200, {
          api_tran_id: "stub-api-tran",
          rsp_code: "A0000",
          rsp_message: "",
          bank_tran_id: body.bank_tran_id,
          bank_code_std: body.bank_code_std,
          account_num: body.account_num,
          account_holder_name: VALID.holder,
        });
      }
      return json(res, 200, { rsp_code: "A0021", rsp_message: "계좌 실명 확인 불가(계좌번호 또는 실명번호 불일치)" });
    }

    json(res, 404, { error: "not_found" });
  });
});

server.listen(PORT, () => console.log(`[kftc-stub] listening on http://127.0.0.1:${PORT}`));
