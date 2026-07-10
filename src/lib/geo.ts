// 실좌표 거리·지역 기준점 유틸 (2026-07-08 확정 정책).
// '걸어서 갈 수 있어요'의 지역 변경과 지도 '이 지역 재검색'이 공유한다:
// 사용자가 지역을 바꾸면 그 지역의 "기준 지점"에서 반경 3km(NEARBY_RADIUS_M) 데이터를 보여준다.
// 매장 area/address 문자열 매칭은 스토리보드 모드(라벨 마스킹)에서 무력화되므로,
// 기준점은 정적 좌표 사전(시도 17 + 서울 시군구)으로 해석한다.

import { findSido } from "./regions";

export interface LatLng {
  lat: number;
  lng: number;
}

// 하버사인 거리 (미터)
export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

// 좌표 집합의 중심 (평균) — 재검색 초기 중심 폴백 등에 사용
export function centroidOf(points: LatLng[]): LatLng | null {
  if (points.length === 0) return null;
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return { lat, lng };
}

// 지역 기준 좌표 사전 — 시도 17 + 서울 시군구(구청 인근 대표점).
// 프로토타입 범위: 시드 매장이 전부 서울권이라 서울 구 단위만 상세 등재.
// 그 외 시군구는 소속 시도 대표점으로 폴백(regionCenter 참조).
const REGION_CENTERS: Record<string, LatLng> = {
  // 시도
  서울: { lat: 37.5665, lng: 126.978 },
  부산: { lat: 35.1796, lng: 129.0756 },
  대구: { lat: 35.8714, lng: 128.6014 },
  인천: { lat: 37.4563, lng: 126.7052 },
  광주: { lat: 35.1595, lng: 126.8526 },
  대전: { lat: 36.3504, lng: 127.3845 },
  울산: { lat: 35.5384, lng: 129.3114 },
  세종: { lat: 36.4801, lng: 127.289 },
  경기: { lat: 37.2891, lng: 127.0536 },
  강원: { lat: 37.8853, lng: 127.7298 },
  충북: { lat: 36.6357, lng: 127.4913 },
  충남: { lat: 36.6588, lng: 126.6728 },
  전북: { lat: 35.8202, lng: 127.1088 },
  전남: { lat: 34.8161, lng: 126.4629 },
  경북: { lat: 36.5759, lng: 128.5056 },
  경남: { lat: 35.2383, lng: 128.6924 },
  제주: { lat: 33.4890, lng: 126.4983 },
  // 서울 시군구
  종로구: { lat: 37.5735, lng: 126.979 },
  중구: { lat: 37.5641, lng: 126.9979 },
  용산구: { lat: 37.5324, lng: 126.9905 },
  성동구: { lat: 37.5633, lng: 127.0371 },
  광진구: { lat: 37.5385, lng: 127.0823 },
  동대문구: { lat: 37.5744, lng: 127.0396 },
  중랑구: { lat: 37.6066, lng: 127.0927 },
  성북구: { lat: 37.5894, lng: 127.0167 },
  강북구: { lat: 37.6396, lng: 127.0257 },
  도봉구: { lat: 37.6688, lng: 127.0471 },
  노원구: { lat: 37.6542, lng: 127.0568 },
  은평구: { lat: 37.6027, lng: 126.9291 },
  서대문구: { lat: 37.5791, lng: 126.9368 },
  마포구: { lat: 37.5663, lng: 126.9014 },
  양천구: { lat: 37.5170, lng: 126.8665 },
  강서구: { lat: 37.5509, lng: 126.8497 },
  구로구: { lat: 37.4954, lng: 126.8874 },
  금천구: { lat: 37.4569, lng: 126.8955 },
  영등포구: { lat: 37.5264, lng: 126.8962 },
  동작구: { lat: 37.5124, lng: 126.9393 },
  관악구: { lat: 37.4784, lng: 126.9516 },
  서초구: { lat: 37.4836, lng: 127.0327 },
  강남구: { lat: 37.5172, lng: 127.0473 },
  송파구: { lat: 37.5145, lng: 127.1059 },
  강동구: { lat: 37.5301, lng: 127.1238 },
};

// 지역 라벨 → 기준 좌표. ① 정확/포함 일치 ② 소속 시도 폴백 ③ null.
export function regionCenter(label: string): LatLng | null {
  if (!label) return null;
  if (REGION_CENTERS[label]) return REGION_CENTERS[label];
  const hit = Object.keys(REGION_CENTERS).find((k) => label.includes(k) || k.includes(label));
  if (hit) return REGION_CENTERS[hit];
  const sido = findSido(label);
  if (sido && REGION_CENTERS[sido]) return REGION_CENTERS[sido];
  return null;
}
