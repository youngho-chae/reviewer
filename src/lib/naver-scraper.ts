// Naver Place 모바일 페이지 스크레이퍼.
// 샌드박스에서는 차단되지만 Vercel icn1(서울) 리전에선 정상 작동.
// m.place.naver.com 페이지는 Next.js로 만들어져 있어 __NEXT_DATA__ JSON에
// 매장 메타가 들어있음. 그걸 파싱.

export interface ScrapedPlace {
  id: string;
  name?: string;
  category?: string;
  address?: string;
  roadAddress?: string;
  lat?: number;
  lng?: number;
  rating?: number;
  reviewCount?: number;
  hours?: string;
  phone?: string;
  menus?: { name: string; price?: string }[];
  imageUrl?: string;
  source: "next-data" | "pcmap" | "fallback";
}

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

function pick<T = any>(obj: any, paths: string[][]): T | undefined {
  for (const path of paths) {
    let cur: any = obj;
    for (const k of path) {
      if (cur == null) break;
      cur = cur[k];
    }
    if (cur !== undefined && cur !== null) return cur as T;
  }
  return undefined;
}

function walkFind<T = any>(node: any, predicate: (k: string, v: any) => boolean, max = 5000): T | undefined {
  let count = 0;
  const stack: any[] = [node];
  while (stack.length && count < max) {
    const cur = stack.pop();
    count++;
    if (!cur || typeof cur !== "object") continue;
    for (const [k, v] of Object.entries(cur)) {
      if (predicate(k, v)) return v as T;
      if (v && typeof v === "object") stack.push(v);
    }
  }
  return undefined;
}

function extractNextData(html: string): any | null {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function extractApolloState(html: string): any | null {
  // pcmap.place.naver.com는 __APOLLO_STATE__ 형태로 들어있음
  const m = html.match(/window\.__APOLLO_STATE__\s*=\s*({[\s\S]*?});<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
      cache: "no-store",
      redirect: "follow",
    });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

async function scrapeMobile(id: string): Promise<ScrapedPlace | null> {
  const html = await fetchHtml(`https://m.place.naver.com/place/${id}/home`);
  if (!html) return null;
  const data = extractNextData(html);
  if (!data) return null;

  // pageProps.placeBase or pageProps.placeInfo 등 키는 페이지 종류(restaurant/cafe/...)마다 다름
  const summary = walkFind<any>(data, (k, v) => {
    return (
      k === "base" &&
      v &&
      typeof v === "object" &&
      (v as any).name &&
      (v as any).category !== undefined
    );
  });
  const menus = walkFind<any[]>(data, (k, v) => k === "menus" && Array.isArray(v) && v.length > 0 && v[0]?.name);
  const visitorReviewsTotal = walkFind<number>(data, (k, v) => k === "visitorReviewsTotal" && typeof v === "number");
  const score = walkFind<number>(data, (k, v) => k === "visitorReviewsScore" && typeof v === "number");

  if (!summary) return null;

  const lat = Number(summary.y ?? summary.lat ?? summary.mapy);
  const lng = Number(summary.x ?? summary.lng ?? summary.mapx);

  return {
    id,
    name: summary.name,
    category: Array.isArray(summary.category) ? summary.category.join(" ") : summary.category,
    address: summary.address || summary.commonAddress,
    roadAddress: summary.roadAddress,
    lat: !isNaN(lat) ? lat : undefined,
    lng: !isNaN(lng) ? lng : undefined,
    rating: typeof score === "number" ? score : undefined,
    reviewCount: typeof visitorReviewsTotal === "number" ? visitorReviewsTotal : undefined,
    hours: summary.businessStatus?.status,
    phone: summary.phone || summary.virtualPhone,
    menus: Array.isArray(menus) ? menus.slice(0, 8).map((m: any) => ({ name: m.name, price: m.price })) : undefined,
    imageUrl: summary.thumUrl || summary.imageUrl,
    source: "next-data",
  };
}

async function scrapePcmap(id: string): Promise<ScrapedPlace | null> {
  // pcmap는 카테고리에 따라 path가 다르므로 restaurant부터 시도
  const candidates = ["restaurant", "cafe", "place"];
  for (const c of candidates) {
    const html = await fetchHtml(`https://pcmap.place.naver.com/${c}/${id}/home`);
    if (!html) continue;
    const apollo = extractApolloState(html);
    if (!apollo) continue;
    // Apollo cache key like "RestaurantBase:1234567890"
    const baseKey = Object.keys(apollo).find((k) => /Base:.*?(\d+)/.test(k) && k.endsWith(`:${id}`));
    const base = baseKey ? apollo[baseKey] : walkFind<any>(apollo, (k, v) => v && typeof v === "object" && (v as any).id === id && (v as any).name);
    if (!base) continue;
    const lat = Number(base.y ?? base.lat);
    const lng = Number(base.x ?? base.lng);
    return {
      id,
      name: base.name,
      category: Array.isArray(base.category) ? base.category.join(" ") : base.category,
      address: base.address,
      roadAddress: base.roadAddress,
      lat: !isNaN(lat) ? lat : undefined,
      lng: !isNaN(lng) ? lng : undefined,
      source: "pcmap",
    };
  }
  return null;
}

export async function scrapePlace(id: string): Promise<ScrapedPlace | null> {
  const mobile = await scrapeMobile(id);
  if (mobile && mobile.name) return mobile;
  return scrapePcmap(id);
}
