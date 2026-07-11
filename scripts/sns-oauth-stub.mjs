// SNS OAuth 스텁 프로바이더 (통합 테스트/QA 전용 — 운영 무관).
//
// 실 프로바이더(네이버 로그인 / Meta Graph / TikTok Login Kit v2)와 **동일한 요청·응답 형태**로
// 인가 → code → 토큰 → 프로필을 흉내 내어, 앱의 실 OAuth 코드 경로(state CSRF·토큰 교환·
// 프로필 파싱·연동 커밋)를 실행 검증한다. 앱 쪽은 비프로덕션에서만 동작하는
// `SNS_OAUTH_TEST_BASE` 오버라이드로 이 서버를 바라본다 (src/lib/sns-oauth.ts endpoints()).
//
// 사용법:
//   node scripts/sns-oauth-stub.mjs            # 기본 4400 포트
//   SNS_OAUTH_TEST_BASE=http://localhost:4400 \
//   NAVER_LOGIN_CLIENT_ID=test ... npx next dev
//
// 인가 화면은 [승인] 버튼 하나짜리 HTML — Playwright가 실사용자처럼 클릭한다.

import http from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 4400);

const IDENTITIES = {
  naver_blog: { id: "naver-real-001", nickname: "실연동네이버" },
  instagram: {
    me: { id: "fb-real-001", name: "실연동페북" },
    accounts: { data: [{ instagram_business_account: { username: "ig_real_tester", followers_count: 34567 } }] },
  },
  tiktok: {
    data: { user: { open_id: "tt-real-001", display_name: "실연동틱톡", username: "tt_real_tester", follower_count: 120000 } },
  },
};

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "content-type": `${type}; charset=utf-8` });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const [, provider, action] = url.pathname.split("/");
    const q = url.searchParams;

    // ── 인가 화면 — redirect_uri·state를 그대로 되돌려주는 실 인가 다이얼로그 모사 ──
    if (action === "authorize") {
      const redirect = q.get("redirect_uri") || "";
      const state = q.get("state") || "";
      const clientOk = q.get("client_id") || q.get("client_key");
      if (!clientOk || !redirect) return send(res, 400, { error: "invalid_request" });
      const cb = `${redirect}?code=stub-code-${provider}&state=${encodeURIComponent(state)}`;
      return send(
        res,
        200,
        `<!doctype html><meta charset="utf-8"><title>${provider} 로그인 (스텁)</title>
         <body style="font-family:sans-serif;padding:40px;text-align:center">
           <h1>${provider} 로그인 화면 (스텁 프로바이더)</h1>
           <p>실서비스에서는 프로바이더의 실제 로그인 화면입니다.</p>
           <p><a id="approve" href="${cb}" style="display:inline-block;padding:12px 24px;background:#03c75a;color:#fff;border-radius:8px;text-decoration:none">동의하고 계속하기</a></p>
         </body>`,
        "text/html",
      );
    }

    // ── 토큰 교환 — code 검증 후 access_token 발급 (naver/meta=GET query, tiktok=POST form) ──
    if (action === "token") {
      const handle = (params) => {
        const code = params.get("code");
        if (code !== `stub-code-${provider}`) return send(res, 400, { error: "invalid_grant", error_description: "bad code" });
        return send(res, 200, { access_token: `stub-token-${provider}`, token_type: "bearer", expires_in: 3600 });
      };
      if (req.method === "POST") {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => handle(new URLSearchParams(body)));
        return;
      }
      return handle(q);
    }

    // ── 프로필 — Bearer 또는 access_token 쿼리 검증 후 실 응답 형태 반환 ──
    const bearer = (req.headers.authorization || "").replace("Bearer ", "");
    const token = bearer || q.get("access_token") || "";
    if (token !== `stub-token-${provider}`) return send(res, 401, { error: "invalid_token" });

    if (action === "profile") {
      if (provider === "naver_blog") return send(res, 200, { resultcode: "00", message: "success", response: IDENTITIES.naver_blog });
      if (provider === "instagram") return send(res, 200, IDENTITIES.instagram.me);
      if (provider === "tiktok") return send(res, 200, IDENTITIES.tiktok);
    }
    if (action === "accounts" && provider === "instagram") {
      return send(res, 200, IDENTITIES.instagram.accounts);
    }
    return send(res, 404, { error: "not_found" });
  })
  .listen(PORT, () => console.log(`[sns-oauth-stub] listening on http://localhost:${PORT}`));
