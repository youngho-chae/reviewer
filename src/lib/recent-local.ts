// 최근 목록(최근 선택 지역·최근 검색어) localStorage 헬퍼 (2026-07-08 UI 개편).
// 기기 로컬 전용 — 서버로 전송하지 않는다 (데이터정책서 참조). SSR 가드 필수.

export const RECENT_REGIONS_KEY = "cp_recent_regions_v1"; // 최대 5
export const RECENT_SEARCHES_KEY = "cp_recent_searches_v1"; // 최대 10

export function getRecent(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function pushRecent(key: string, value: string, max: number): string[] {
  const v = value.trim();
  if (!v) return getRecent(key);
  const next = [v, ...getRecent(key).filter((x) => x !== v)].slice(0, max);
  save(key, next);
  return next;
}

export function removeRecent(key: string, value: string): string[] {
  const next = getRecent(key).filter((x) => x !== value);
  save(key, next);
  return next;
}

export function clearRecent(key: string): string[] {
  save(key, []);
  return [];
}

function save(key: string, arr: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(arr));
  } catch {}
}
