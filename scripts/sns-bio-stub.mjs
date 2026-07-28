// SNS 소개글 크롤링 + 블로그 등급평가 API 스텁 (로컬 검증용 — 2026-07-25 연결 개편).
// 샌드박스에서 naver/instagram/tiktok/blog-analyzer가 차단되므로 응답을 재현한다.
// 사용: node scripts/sns-bio-stub.mjs &
//   NAVER_BLOG_CRAWL_BASE=http://127.0.0.1:4700 \
//   INSTAGRAM_CRAWL_BASE=http://127.0.0.1:4700/ig \
//   INSTAGRAM_APP_API_BASE=http://127.0.0.1:4700/igapp \
//   TIKTOK_CRAWL_BASE=http://127.0.0.1:4700/tt \
//   BLOG_ANALYZER_BASE=http://127.0.0.1:4700 npx next dev
//
// 제어: POST /__bio {"id":"...","text":"..."} — 해당 계정의 소개글 설정
//       POST /__analysis {"id":"...","grade":"A","total_visitors":55000} — 블로그 분석 응답 설정
//       POST /__index {"id":"...","followers":12000,"score":80} — 인스타/틱톡 지수 응답 설정
// 조회: GET /{blogId} · /tt/@{user} → 소개글 포함 HTML
//       GET /ig/{user}/ → 로그인 벽 HTML (실서비스 재현 — 비로그인 서버 크롤엔 소개글 미포함)
//       GET /ig/api/v1/users/web_profile_info/?username={user} → {"data":{"user":{"biography":...}}}
//           (x-ig-app-id 헤더 필수 — 실API 동작 재현)
//       GET  /api/analyze?url={id} → {"grade":..., "total_visitors":...} (네이버 블로그)
//       POST /api/analyze·/api/tiktok {"username":...} → {"followers":..., "score":...} (인스타/틱톡)
import http from "node:http";

const PORT = Number(process.env.SNS_BIO_STUB_PORT || 4700);
let igAppBlocked = false; // 앱 API 호스트 차단 시뮬레이션 (POST /__igappblock)
const bios = new Map(); // id -> 소개글 텍스트
const analyses = new Map(); // id -> {grade, total_visitors} (네이버 블로그)
const indexes = new Map(); // username -> {followers, score} (인스타/틱톡)

function page(id) {
  const bio = bios.get(id) ?? "";
  return `<!DOCTYPE html><html><head><meta property="og:description" content="${bio}"/></head><body><div class="bio">${bio}</div></body></html>`;
}

http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const u = new URL(req.url, `http://x`);
      const json = (code, body) => {
        res.writeHead(code, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
      };
      if (req.method === "POST" && u.pathname === "/__bio") {
        const j = JSON.parse(raw || "{}");
        bios.set(String(j.id), String(j.text ?? ""));
        return json(200, { ok: true });
      }
      if (req.method === "POST" && u.pathname === "/__analysis") {
        const j = JSON.parse(raw || "{}");
        // payload가 있으면 그대로 응답 — 실 API의 다양한 스키마(중첩·장식·쉼표 문자열) 재현용
        analyses.set(String(j.id), j.payload ?? { grade: j.grade, total_visitors: j.total_visitors });
        return json(200, { ok: true });
      }
      if (req.method === "POST" && u.pathname === "/__index") {
        const j = JSON.parse(raw || "{}");
        // biography는 선택 — 응답 원문 폴백 스캔(crawlBioHasCode ③층) 검증용
        indexes.set(String(j.id), {
          followers: j.followers,
          score: j.score,
          ...(j.biography ? { biography: j.biography } : {}),
        });
        return json(200, { ok: true });
      }
      // 인스타/틱톡 지수 API — POST 전용, body { username }
      if (req.method === "POST" && (u.pathname === "/api/analyze" || u.pathname === "/api/tiktok")) {
        const j = JSON.parse(raw || "{}");
        const idx = indexes.get(String(j.username || ""));
        if (!idx) return json(404, { error: "unknown account" });
        return json(200, idx);
      }
      if (u.pathname === "/api/analyze") {
        const id = u.searchParams.get("url") || "";
        const a = analyses.get(id);
        if (!a) return json(404, { error: "unknown blog" });
        return json(200, a);
      }
      // 앱 API 호스트(i.instagram.com 재현) 차단 토글 — 층 폴백 검증용
      if (req.method === "POST" && u.pathname === "/__igappblock") {
        igAppBlocked = Boolean(JSON.parse(raw || "{}").blocked);
        return json(200, { ok: true, igAppBlocked });
      }
      // 인스타 프로필 JSON API — /ig(웹 호스트)·/igapp(앱 API 호스트) 공용 (x-ig-app-id 필수)
      const wpi = u.pathname.match(/^\/(ig|igapp)\/api\/v1\/users\/web_profile_info\/$/);
      if (wpi) {
        if (wpi[1] === "igapp" && igAppBlocked) return json(403, { error: "blocked" });
        if (!req.headers["x-ig-app-id"]) return json(400, { error: "missing x-ig-app-id" });
        const user = u.searchParams.get("username") || "";
        if (!bios.has(user)) return json(404, { error: "user not found" });
        return json(200, { data: { user: { username: user, biography: bios.get(user) } } });
      }
      // 인스타 프로필 HTML — 로그인 벽 재현 (소개글 미포함 — 실 QA 2026-07-27 확인)
      const ig = u.pathname.match(/^\/ig\/([A-Za-z0-9._]+)\/?$/);
      if (ig) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        return res.end(
          `<!DOCTYPE html><html><head><title>Instagram</title></head><body><div>Log in to see photos and videos.</div></body></html>`,
        );
      }
      // 프로필 페이지 — /{id} (네이버) · /tt/@{user} (틱톡): 소개글 포함 SSR
      const m = u.pathname.match(/^\/(?:tt\/@)?([A-Za-z0-9._-]+)\/?$/);
      if (m) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        return res.end(page(m[1]));
      }
      json(404, { error: "not_found" });
    });
  })
  .listen(PORT, () => console.log(`[sns-bio-stub] listening on :${PORT}`));
