// 매장 ID + 카테고리 기반 결정론적 썸네일 매핑.
// - 음식/카페/주점 등은 실제 음식 사진 5장 풀에서 순환 (중복 허용 — 사용자 명시)
// - 미용/네일/병의원/애견/운동/요가 등은 카테고리 전용 SVG 커버 사용

const FOOD_PHOTOS = [
  "/store-photos/photo-1.jpg",
  "/store-photos/photo-2.jpg",
  "/store-photos/photo-3.jpg",
  "/store-photos/photo-4.jpg",
  "/store-photos/photo-5.webp",
];

const FOOD_CATEGORIES = new Set([
  "한식", "양식", "일식", "중식", "분식", "카페", "주점", "디저트", "베이커리", "퓨전",
]);

// 카테고리 → 전용 커버 SVG. 못 찾으면 음식 사진 풀로 폴백.
const CATEGORY_COVERS: Record<string, string> = {
  "미용실": "/store-photos/cat-beauty.svg",
  "헤어샵": "/store-photos/cat-beauty.svg",
  "네일샵": "/store-photos/cat-nail.svg",
  "네일아트": "/store-photos/cat-nail.svg",
  "병의원": "/store-photos/cat-clinic.svg",
  "치과": "/store-photos/cat-clinic.svg",
  "피부과": "/store-photos/cat-clinic.svg",
  "한의원": "/store-photos/cat-clinic.svg",
  "애견미용": "/store-photos/cat-pet.svg",
  "동물병원": "/store-photos/cat-pet.svg",
  "펫샵": "/store-photos/cat-pet.svg",
  "요가": "/store-photos/cat-wellness.svg",
  "필라테스": "/store-photos/cat-wellness.svg",
  "마사지": "/store-photos/cat-wellness.svg",
  "스파": "/store-photos/cat-wellness.svg",
  "피트니스": "/store-photos/cat-fitness.svg",
  "PT": "/store-photos/cat-fitness.svg",
  "헬스장": "/store-photos/cat-fitness.svg",
  "복싱": "/store-photos/cat-fitness.svg",
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function photoForStore(storeId: string, category?: string): string {
  if (category && CATEGORY_COVERS[category]) return CATEGORY_COVERS[category];
  if (category && !FOOD_CATEGORIES.has(category)) {
    // 정의되지 않은 비음식 카테고리는 일단 음식 풀 폴백 (디자인 변화 최소화)
  }
  return FOOD_PHOTOS[hash(storeId) % FOOD_PHOTOS.length];
}
