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
    return JSON.parse(data.result) as T;
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
      headers: { Authorization: `Bearer ${e.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(JSON.stringify(value)),
      cache: "no-store",
    });
    return r.ok;
  } catch {
    return false;
  }
}
