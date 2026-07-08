// ─────────────────────────────────────────────────────────────
// 거리 mock — 프로토타입 전용 결정론적 거리 (storeId 해시 기반).
// 실서비스에서는 사용자 현재 위치 기준 실거리 계산으로 대체한다.
//
// '걸어서 갈 수 있어요' 반경 기준 = 3km (2026-07-07 회의 확정)
// ─────────────────────────────────────────────────────────────

export const NEARBY_RADIUS_M = 3000;

function hash(storeId: string): number {
  let h = 0;
  for (let i = 0; i < storeId.length; i++) h = (h * 31 + storeId.charCodeAt(i)) >>> 0;
  return h;
}

/** 사용자 현재 위치 기준 거리(m) mock — 200m ~ 2,900m */
export function mockDistanceM(storeId: string): number {
  return 200 + (hash(storeId) % 2700);
}

/** 도보 시간(분) — 도보 80m/분 환산 */
export function walkMinutes(storeId: string): number {
  return Math.max(1, Math.round(mockDistanceM(storeId) / 80));
}

/**
 * 거리 표기 (2026-07-08) — 현 위치 기준 매장까지의 거리.
 * 1km 미만 "850m" · 10km 미만 "1.2km" · 그 이상 "12km"
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)}km` : `${Math.round(km)}km`;
}
