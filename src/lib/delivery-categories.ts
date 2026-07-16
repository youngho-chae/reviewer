// ─────────────────────────────────────────────────────────────
// 배송형 상품 카테고리 (2026-07-12 정정 — 레뷰 벤치마크 후속)
//
// 기존 카테고리 체계(카페·식당·뷰티 등)는 플레이스(매장 방문) 기준이라 배송형과
// 맥락이 맞지 않는다 — 배송형은 매장이 아닌 특정 스토어(브랜드)의 "상품"을 다루므로
// 커머스 상품군 기준의 별도 분류를 사용한다. 정의 위치는 이 파일이 단일 정본:
// 탐색 배송 칩·필터 시트·캠페인 생성 셀렉트·생성 API 검증이 모두 여기를 공유한다.
// ─────────────────────────────────────────────────────────────

export interface DeliveryCatGroup {
  key: string;
  label: string;
  ic: string;
  match: (c: string) => boolean;
}

export const DELIVERY_CATEGORIES = [
  "식품",
  "뷰티",
  "리빙",
  "패션잡화",
  "디지털",
  "키즈·펫",
  "건강",
] as const;

export type DeliveryCategory = (typeof DELIVERY_CATEGORIES)[number];

export function isDeliveryCategory(c: string): c is DeliveryCategory {
  return (DELIVERY_CATEGORIES as readonly string[]).includes(c);
}

// ── 참여 방식 (2026-07-12) — 방문형 안에서 "예약 없이 바로 방문"과 "방문 전 예약 필수"를
// 구분하는 필터. 배송형은 별도 세그먼트가 그 자체로 방식 필터.
// (ExploreView와 FilterSheet가 함께 쓰는 값이라 순환 import를 피해 여기에 둔다)
export type VisitMode = "all" | "walkin" | "reserve";
export const VISIT_MODE_LABEL: Record<VisitMode, string> = {
  all: "전체",
  walkin: "바로 방문",
  reserve: "예약 필수",
};

// 탐색 칩·필터 시트용 그룹 — 상품 카테고리는 1:1 매칭 (플레이스 카테고리와 달리 하위 묶음 없음)
export const DELIVERY_CAT_GROUPS: DeliveryCatGroup[] = [
  { key: "식품", label: "식품", ic: "🍱", match: (c) => c === "식품" },
  { key: "뷰티", label: "뷰티", ic: "💄", match: (c) => c === "뷰티" },
  { key: "리빙", label: "리빙", ic: "🏠", match: (c) => c === "리빙" },
  { key: "패션잡화", label: "패션잡화", ic: "👜", match: (c) => c === "패션잡화" },
  { key: "디지털", label: "디지털", ic: "🎧", match: (c) => c === "디지털" },
  { key: "키즈·펫", label: "키즈·펫", ic: "🧸", match: (c) => c === "키즈·펫" },
  { key: "건강", label: "건강", ic: "💊", match: (c) => c === "건강" },
];
