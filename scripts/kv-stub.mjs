// Upstash Redis REST 스텁 — KV 코드 경로 통합 테스트 전용 (실 서비스와 무관).
// Upstash와 동일하게 ① POST /set/{key}: 요청 본문 원문을 값으로 저장
//                  ② GET  /get/{key}: {"result": <저장된 문자열 | null>}
// 사용: node scripts/kv-stub.mjs   (포트 4600)
//   KV_REST_API_URL=http://127.0.0.1:4600 KV_REST_API_TOKEN=stub-token npx next dev
import http from "node:http";

const PORT = 4600;
const store = new Map();

const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const json = (code, body) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (!String(req.headers.authorization || "").startsWith("Bearer ")) {
      return json(401, { error: "Unauthorized" });
    }
    const m = req.url.match(/^\/(get|set)\/([^/?]+)/);
    if (!m) return json(404, { error: "not_found" });
    const key = decodeURIComponent(m[2]);
    if (m[1] === "get") {
      return json(200, { result: store.has(key) ? store.get(key) : null });
    }
    // set — Upstash처럼 본문 원문을 그대로 저장
    store.set(key, raw);
    return json(200, { result: "OK" });
  });
});

server.listen(PORT, () => console.log(`[kv-stub] listening on http://127.0.0.1:${PORT}`));
