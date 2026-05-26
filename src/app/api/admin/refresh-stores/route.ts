import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { scrapePlace } from "@/lib/naver-scraper";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// 사용자가 deploy 후 1회 호출 → 10개 매장 실데이터 갱신.
// 토큰: process.env.ADMIN_REFRESH_TOKEN (없으면 dev 모드만 허용)

const PLACE_IDS = [
  "1621388960",
  "31906212",
  "959481202",
  "32126858",
  "1922926992",
  "11858321",
  "2012466103",
  "1067489343",
  "1185421575",
  "1261430410",
];

function pickMenusRandom(menus: { name: string }[], n: number): string[] {
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
  // "서울 용산구 한남대로 27길" → "한남동" 추출은 어려우므로 '구' 단위
  const m = address.match(/서울\s*(\S+구)/);
  if (m) return m[1];
  return undefined;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const required = process.env.ADMIN_REFRESH_TOKEN || "";
  if (required && token !== required) {
    return NextResponse.json({ error: "토큰이 일치하지 않습니다" }, { status: 401 });
  }

  const db = await getDBAsync();
  const results: any[] = [];

  for (const placeId of PLACE_IDS) {
    const store = db.stores.find((s) => s.naverPlaceId === placeId);
    if (!store) {
      results.push({ placeId, status: "store-not-found" });
      continue;
    }

    const scraped = await scrapePlace(placeId);
    if (!scraped || !scraped.name) {
      results.push({ placeId, status: "scrape-failed" });
      continue;
    }

    // 매장 정보 업데이트
    store.name = scraped.name;
    if (scraped.category) store.category = scraped.category.split(/[,>]/)[0].trim();
    if (scraped.address || scraped.roadAddress) store.address = scraped.roadAddress || scraped.address;
    const area = areaFromAddress(store.address);
    if (area) store.area = area;
    if (typeof scraped.lat === "number") store.lat = scraped.lat;
    if (typeof scraped.lng === "number") store.lng = scraped.lng;
    if (typeof scraped.rating === "number") store.rating = scraped.rating;
    if (typeof scraped.reviewCount === "number") store.reviewCount = scraped.reviewCount;

    // 캠페인의 필수 메뉴를 실제 매장 메뉴에서 랜덤 2개로 갱신
    const campaign = db.campaigns.find((c) => c.storeId === store.id);
    if (campaign && scraped.menus && scraped.menus.length > 0) {
      campaign.requiredMenus = pickMenusRandom(scraped.menus, 2);
      campaign.description = `${store.name}에서 시그니처 메뉴(${campaign.requiredMenus.join(", ")})를 체험하고 정성스러운 후기를 남겨주세요.`;
      campaign.title = `${store.name} 체험단`;
    }

    results.push({
      placeId,
      status: "ok",
      source: scraped.source,
      name: scraped.name,
      address: store.address,
      lat: store.lat,
      lng: store.lng,
      menus: campaign?.requiredMenus,
    });
  }

  await saveDBAsync();
  const ok = results.filter((r) => r.status === "ok").length;
  return NextResponse.json({ ok, failed: results.length - ok, results });
}
