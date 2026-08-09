import { DBShape, Store } from "./types";
import { rid } from "./ids";
import { scrapePlace } from "./naver-scraper";
import { regionFromAddress } from "./regions";
import { regionCenter } from "./geo";

// 자가 실행 데이터 패치 (2026-08-07 신설) — 시드(전체 재구성)와 달리 기존 데이터를
// 건드리지 않고 특정 레코드만 추가/보정하는 1회성 마이그레이션. 배포 후 첫 요청에서
// 자동 적용되며(db.ts getDBAsync), 성공한 패치 id는 db.appliedPatches에 기록돼
// 다시 실행되지 않는다. 부분 실패(예: 플레이스 조회 차단)는 다음 요청에서 재시도.
//
// [불변] 패치는 추가/보정만 한다 — 삭제·전체 교체 금지 (realtest 비파괴 원칙과 동일).

// ── PATCH 2026-08-07: amplify15813 사장님 매장 7곳 등록 ─────────────────────
// realtest DB 초기화 사고(2026-08-07)로 소실된 관리 매장 복구 — 사용자 전달 URL 목록.
// 매장 등록 UI가 캠페인 생성에 종속돼 단독 등록 경로가 없어 패치로 직접 등록한다.
// 멱등: 같은 naverPlaceId가 이미 있으면 건너뜀. 전부 등록될 때까지 미적용(재시도) 유지.
const AMPLIFY_OWNER_EMAIL = "amplify15813@gmail.com";
const AMPLIFY_PLACE_IDS = [
  "1621388960",
  "11660082",
  "32126858",
  "1572274823",
  "1364596564",
  "1556533940",
  "1897984391",
];

async function patchAmplifyStores(db: DBShape): Promise<{ changed: boolean; done: boolean }> {
  const owner = db.owners.find((o) => o.email === AMPLIFY_OWNER_EMAIL);
  // 계정이 아직 없으면(재가입 전) 이번 로드는 건너뛰고 다음에 재시도
  if (!owner) return { changed: false, done: false };

  let changed = false;
  let allPresent = true;
  for (const placeId of AMPLIFY_PLACE_IDS) {
    if (db.stores.some((st) => st.ownerId === owner.id && st.naverPlaceId === placeId)) continue;

    // 플레이스 정보 조회 — /api/owner/stores(URL 매장 불러오기)와 동일 파이프라인
    const scraped = await scrapePlace(placeId).catch(() => null);
    if (!scraped?.name) {
      // 조회 실패(차단·일시 장애) — 이 매장은 이번에 만들지 않고 다음 로드에서 재시도
      allPresent = false;
      continue;
    }
    const fullAddress = scraped.roadAddress || scraped.address;
    const region = regionFromAddress(scraped.address || fullAddress);
    const fallbackCenter = region ? regionCenter(region) : null;
    const store: Store = {
      id: rid("st"),
      ownerId: owner.id,
      name: scraped.name.slice(0, 40),
      category: scraped.category || "기타",
      area: region || "미지정",
      coverEmoji: "🏪",
      rating: scraped.rating ?? 0,
      reviewCount: scraped.reviewCount ?? 0,
      hours: scraped.hours || "영업시간 미등록",
      ...(scraped.lat !== undefined || fallbackCenter
        ? { lat: scraped.lat ?? fallbackCenter!.lat, lng: scraped.lng ?? fallbackCenter!.lng }
        : {}),
      ...(fullAddress ? { address: fullAddress.slice(0, 80) } : {}),
      naverPlaceId: placeId,
      ...(scraped.imageUrl ? { thumbnailUrl: scraped.imageUrl } : {}),
    };
    db.stores.push(store);
    changed = true;
  }
  const done =
    allPresent &&
    AMPLIFY_PLACE_IDS.every((placeId) => db.stores.some((st) => st.ownerId === owner.id && st.naverPlaceId === placeId));
  return { changed, done };
}

// ── 패치 레지스트리 ───────────────────────────────────────────
const PATCHES: Array<{ id: string; run: (db: DBShape) => Promise<{ changed: boolean; done: boolean }> }> = [
  { id: "2026-08-07-amplify-stores", run: patchAmplifyStores },
];

// 미적용 패치 실행 — 변경이 있었으면 true (호출부가 persist/kvSave)
export async function applyDataPatches(db: DBShape): Promise<boolean> {
  const applied = new Set(db.appliedPatches ?? []);
  let changed = false;
  for (const p of PATCHES) {
    if (applied.has(p.id)) continue;
    try {
      const r = await p.run(db);
      if (r.changed) changed = true;
      if (r.done) {
        db.appliedPatches = [...(db.appliedPatches ?? []), p.id];
        changed = true;
      }
    } catch {
      // 실패 패치는 미적용 유지 — 다음 로드에서 재시도
    }
  }
  return changed;
}
