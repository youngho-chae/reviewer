// Upstash Redis REST API 어댑터 — Vercel KV addon 활성화 시 자동 사용.
// 환경변수: KV_REST_API_URL + KV_REST_API_TOKEN (Vercel이 자동 주입)
//
// 단순 GET/SET만 사용 — DB 전체를 단일 키에 JSON으로 저장.
// MVP 규모(수십 명, 수백 패스)에선 충분히 작동하며,
// 추후 사용자가 늘면 키별 정규화로 마이그레이션 권장.

const KEY = "catchpass:db:v1";

function endpoint() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

export function kvAvailable(): boolean {
  return endpoint() !== null;
}

export async function kvLoad<T>(): Promise<T | null> {
  const e = endpoint();
  if (!e) return null;
  try {
    const r = await fetch(`${e.url}/get/${encodeURIComponent(KEY)}`, {
      headers: { Authorization: `Bearer ${e.token}` },
      cache: "no-store",
    });
    if (!r.ok) return null;
    const data = (await r.json()) as { result: string | null };
    if (!data.result) return null;
    let parsed: unknown = JSON.parse(data.result);
    // 구버전 kvSave가 이중 직렬화로 저장한 값 호환 — 문자열이 나오면 한 번 더 파싱.
    // (이중 직렬화 + 단일 파싱 불일치로 KV 연결 시 DB가 문자열로 로드되어 전 요청이
    //  500 나던 버그의 잔존 데이터 처리 — 2026-07-17 수정)
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as T;
  } catch {
    return null;
  }
}

export async function kvSave<T>(value: T): Promise<boolean> {
  const e = endpoint();
  if (!e) return false;
  try {
    const r = await fetch(`${e.url}/set/${encodeURIComponent(KEY)}`, {
      method: "POST",
      // Upstash REST는 요청 본문 원문을 값으로 저장한다 — 단일 직렬화 (이중 직렬화 금지)
      headers: { Authorization: `Bearer ${e.token}` },
      body: JSON.stringify(value),
      cache: "no-store",
    });
    return r.ok;
  } catch {
    return false;
  }
}
