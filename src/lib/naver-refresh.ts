import { DBShape } from "./types";
import { scrapePlace } from "./naver-scraper";

function pickRandomMenus(menus: { name: string }[], n: number): string[] {
  if (!menus || menus.length === 0) return [];
  const arr = menus.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(n, arr.length)).map((m) => m.name);
}

function areaFromAddress(address?: string): string | undefined {
  if (!address) return undefined;
  const dong = address.match(/(\S+동)\b/);
  if (dong) return dong[1];
  const gu = address.match(/(\S+구)/);
  return gu ? gu[1] : undefined;
}

// 10개 Naver Place 매장 모두에 대해 best-effort 데이터 갱신.
// 성공한 매장 수 반환. 실패해도 throw 안 함.
export async function refreshAllStores(db: DBShape): Promise<number> {
  const targets = db.stores.filter((s) => s.naverPlaceId);
  let updated = 0;

  // 병렬 fetch (10개 동시) — Vercel 함수 max 60초로 안전 마진
  const results = await Promise.allSettled(
    targets.map(async (store) => {
      const scraped = await scrapePlace(store.naverPlaceId!);
      if (!scraped || !scraped.name) return null;
      return { store, scraped };
    })
  );

  for (const r of results) {
    if (r.status !== "fulfilled" || !r.value) continue;
    const { store, scraped } = r.value;

    store.name = scraped.name!;
    if (scraped.category) {
      store.category = scraped.category.split(/[,>·]/)[0].trim();
    }
    if (scraped.address || scraped.roadAddress) {
      store.address = scraped.roadAddress || scraped.address;
    }
    const area = areaFromAddress(store.address);
    if (area) store.area = area;
    if (typeof scraped.lat === "number") store.lat = scraped.lat;
    if (typeof scraped.lng === "number") store.lng = scraped.lng;
    if (typeof scraped.rating === "number") store.rating = scraped.rating;
    if (typeof scraped.reviewCount === "number") store.reviewCount = scraped.reviewCount;

    // 캠페인 필수 메뉴를 실제 메뉴에서 랜덤 2개
    const campaign = db.campaigns.find((c) => c.storeId === store.id);
    if (campaign && scraped.menus && scraped.menus.length > 0) {
      campaign.requiredMenus = pickRandomMenus(scraped.menus, 2);
      campaign.title = `${store.name} 체험단`;
      campaign.description = `${store.name}에서 시그니처 메뉴(${campaign.requiredMenus.join(", ")})를 체험하고 정성스러운 후기를 남겨주세요.`;
    }
    updated++;
  }
  return updated;
}
