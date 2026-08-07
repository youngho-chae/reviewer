// Upstash Redis REST API 어댑터 — Vercel KV addon 활성화 시 자동 사용.
// 환경변수: KV_REST_API_URL + KV_REST_API_TOKEN (Vercel이 자동 주입)
//
// 단순 GET/SET만 사용 — DB 전체를 단일 키에 JSON으로 저장.
// MVP 규모(수십 명, 수백 패스)에선 충분히 작동하며,
// 추후 사용자가 늘면 키별 정규화로 마이그레이션 권장.

// 배포(브랜치)별 네임스페이스 — 같은 Vercel 프로젝트의 여러 브랜치 배포가 하나의 KV를
// 공유해도 서로의 DB를 덮어쓰지 않도록 키를 분리한다 (2026-07-24 실사고: realtest 배포의
// 시드 없는 2000계열 재시드가 공유 키를 덮어써 default 배포의 데모 계정 로그인이 깨짐).
// 우선순위: CATCHPASS_DB_NS(수동 지정) > VERCEL_GIT_COMMIT_REF(배포 브랜치) > "local".
const NS = (process.env.CATCHPASS_DB_NS || process.env.VERCEL_GIT_COMMIT_REF || "local").replace(/[^a-zA-Z0-9_-]/g, "_");
const KEY = `catchpass:db:v1:${NS}`;
// 네임스페이스 도입 전 공용 키 — 최초 1회 같은 시드 계열이면 승계(마이그레이션)용으로만 읽는다
const LEGACY_KEY = "catchpass:db:v1";

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
  return kvLoadKey<T>(KEY);
}

// 레거시(비네임스페이스) 키 조회 — db.ts 부트스트랩의 1회 승계 전용
export async function kvLoadLegacy<T>(): Promise<T | null> {
  return kvLoadKey<T>(LEGACY_KEY);
}

async function kvLoadKey<T>(key: string): Promise<T | null> {
  const e = endpoint();
  if (!e) return null;
  try {
    const r = await fetch(`${e.url}/get/${encodeURIComponent(key)}`, {
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

// ── 복구·진단 프리미티브 (2026-08-07 — realtest DB 초기화 사고 대응) ──────────
// 어드민 KV 콘솔(/api/admin/kv) 전용: 키 스캔·임의 키 원문 로드·임의 키 저장.

export function kvCurrentKey(): string {
  return KEY;
}

// catchpass:db:* 키 전수 스캔 — Upstash REST SCAN (cursor 순회)
export async function kvScanKeys(prefix = "catchpass:db:"): Promise<string[]> {
  const e = endpoint();
  if (!e) return [];
  const keys: string[] = [];
  let cursor = "0";
  try {
    do {
      const r = await fetch(
        `${e.url}/scan/${encodeURIComponent(cursor)}?match=${encodeURIComponent(prefix + "*")}&count=100`,
        { headers: { Authorization: `Bearer ${e.token}` }, cache: "no-store" },
      );
      if (!r.ok) break;
      const data = (await r.json()) as { result: [string, string[]] };
      cursor = data.result?.[0] ?? "0";
      keys.push(...(data.result?.[1] ?? []));
    } while (cursor !== "0" && keys.length < 1000);
  } catch {}
  return keys;
}

// 임의 키 로드 (이중 직렬화 호환 — kvLoadKey와 동일 파서)
export async function kvLoadRaw<T>(key: string): Promise<T | null> {
  return kvLoadKey<T>(key);
}

// 임의 키 저장 — 복구 전 현재 상태 백업(rescue 키)·복원 쓰기에 사용
export async function kvSaveRaw<T>(key: string, value: T): Promise<boolean> {
  const e = endpoint();
  if (!e) return false;
  try {
    const r = await fetch(`${e.url}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${e.token}` },
      body: JSON.stringify(value),
      cache: "no-store",
    });
    return r.ok;
  } catch {
    return false;
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
