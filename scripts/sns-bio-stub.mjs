// SNS 소개글 크롤링 + 블로그 등급평가 API 스텁 (로컬 검증용 — 2026-07-25 연결 개편).
// 샌드박스에서 naver/instagram/tiktok/blog-analyzer가 차단되므로 응답을 재현한다.
// 사용: node scripts/sns-bio-stub.mjs &
//   NAVER_BLOG_CRAWL_BASE=http://127.0.0.1:4700 \
//   INSTAGRAM_CRAWL_BASE=http://127.0.0.1:4700/ig \
//   TIKTOK_CRAWL_BASE=http://127.0.0.1:4700/tt \
//   BLOG_ANALYZER_BASE=http://127.0.0.1:4700 npx next dev
//
// 제어: POST /__bio {"id":"...","text":"..."} — 해당 계정의 소개글 설정
//       POST /__analysis {"id":"...","grade":"A","total_visitors":55000} — 분석 응답 설정
// 조회: GET /{blogId} · /ig/{user}/ · /tt/@{user} → 소개글 포함 HTML
//       GET /api/analyze?url={id} → {"grade":..., "total_visitors":...}
import http from "node:http";

const PORT = Number(process.env.SNS_BIO_STUB_PORT || 4700);
const bios = new Map(); // id -> 소개글 텍스트
const analyses = new Map(); // id -> {grade, total_visitors}

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
        analyses.set(String(j.id), { grade: j.grade, total_visitors: j.total_visitors });
        return json(200, { ok: true });
      }
      if (u.pathname === "/api/analyze") {
        const id = u.searchParams.get("url") || "";
        const a = analyses.get(id);
        if (!a) return json(404, { error: "unknown blog" });
        return json(200, a);
      }
      // 프로필 페이지 — /{id} (네이버) · /ig/{user}/ (인스타) · /tt/@{user} (틱톡)
      const m = u.pathname.match(/^\/(?:ig\/|tt\/@)?([A-Za-z0-9._-]+)\/?$/);
      if (m) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        return res.end(page(m[1]));
      }
      json(404, { error: "not_found" });
    });
  })
  .listen(PORT, () => console.log(`[sns-bio-stub] listening on :${PORT}`));
