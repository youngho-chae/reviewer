// 매장 ID로부터 결정론적으로 썸네일 사진을 매핑.
// 5장의 풀이라 중복은 의도된 동작 (사용자 명시).
const PHOTOS = [
  "/store-photos/photo-1.jpg",
  "/store-photos/photo-2.jpg",
  "/store-photos/photo-3.jpg",
  "/store-photos/photo-4.jpg",
  "/store-photos/photo-5.webp",
];

// 단순 hash — 같은 storeId는 항상 같은 사진을 받음 (캐시 일관성)
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function photoForStore(storeId: string): string {
  return PHOTOS[hash(storeId) % PHOTOS.length];
}
