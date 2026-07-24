// Naver Place 모바일 페이지 스크레이퍼 — 매장명·카테고리(업종)·주소·좌표·첫 썸네일 수집.
// 샌드박스에서는 네이버가 차단되지만 Vercel icn1(서울) 리전에선 정상 작동.
// m.place.naver.com 페이지는 Next.js로 만들어져 있어 __NEXT_DATA__ JSON에 매장 메타가
// 들어있고, 없으면 og: 메타 태그로 폴백한다. 헤드리스 브라우저 없이 fetch만 사용 —
// 서버리스에서 의존성·콜드스타트 부담이 없다 (JSON이 SSR HTML에 포함되어 JS 실행 불필요).
// 로컬 검증: scripts/place-stub.mjs + NAVER_PLACE_BASE/NAVER_PCMAP_BASE 오버라이드.

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
  imageUrl?: string; // 플레이스 첫 썸네일 (base.imageUrl → og:image 순)
  source: "next-data" | "pcmap" | "og-meta" | "fallback";
}

// 스텁 검증용 베이스 오버라이드 (KFTC_API_BASE 패턴) — 미설정 시 실 네이버 도메인
const PLACE_BASE = process.env.NAVER_PLACE_BASE || "https://m.place.naver.com";
const PCMAP_BASE = process.env.NAVER_PCMAP_BASE || "https://pcmap.place.naver.com";

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

function walkFind<T = any>(node: any, predicate: (k: string, v: any) => boolean, max = 8000): T | undefined {
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

// og: 메타 태그 — JSON 구조가 바뀌어도 살아남는 최후 폴백 (썸네일은 og:image가 가장 안정적)
function ogMeta(html: string, property: string): string | undefined {
  const re = new RegExp(`<meta[^>]+property=["']og:${property}["'][^>]+content=["']([^"']+)["']`, "i");
  const alt = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${property}["']`, "i");
  const m = html.match(re) || html.match(alt);
  return m ? m[1].replace(/&amp;/g, "&") : undefined;
}

// 썸네일 URL 정리 — 프로토콜 없는 //ldb-phinf... 형태 보정, http→https
function normalizeImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const u = url.trim();
  if (!u) return undefined;
  if (u.startsWith("//")) return `https:${u}`;
  if (u.startsWith("http://")) return `https://${u.slice(7)}`;
  return u.startsWith("https://") ? u : undefined;
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
  const html = await fetchHtml(`${PLACE_BASE}/place/${id}/home`);
  if (!html) return null;
  const ogImage = normalizeImageUrl(ogMeta(html, "image"));
  const data = extractNextData(html);

  if (data) {
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
    // 플레이스 등록 사진 목록 — 첫 장이 대표 썸네일 (없으면 og:image)
    const images = walkFind<any[]>(
      data,
      (k, v) => (k === "images" || k === "photos") && Array.isArray(v) && v.length > 0 && !!(v[0]?.url || v[0]?.origin),
    );
    const firstImage = normalizeImageUrl(images?.[0]?.url || images?.[0]?.origin);

    if (summary) {
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
        imageUrl: normalizeImageUrl(summary.thumUrl || summary.imageUrl) || firstImage || ogImage,
        source: "next-data",
      };
    }
  }

  // __NEXT_DATA__ 구조 변경 대비 — og: 메타만으로 최소 정보 구성
  // og:title = "매장명 : 네이버" / og:description = "업종 · 주소" 형태가 일반적
  const ogTitle = ogMeta(html, "title");
  if (ogTitle) {
    const name = ogTitle.replace(/\s*[:|·]\s*네이버.*$/, "").trim();
    const desc = ogMeta(html, "description") || "";
    const descParts = desc.split(/\s*[·|,]\s*/).map((p) => p.trim()).filter(Boolean);
    const addrPart = descParts.find((p) => /(특별시|광역시|특별자치|[가-힣]+[시도군구])\s/.test(p));
    return {
      id,
      name,
      category: descParts.find((p) => p !== addrPart && p.length <= 20),
      address: addrPart,
      imageUrl: ogImage,
      source: "og-meta",
    };
  }
  return null;
}

async function scrapePcmap(id: string): Promise<ScrapedPlace | null> {
  // pcmap는 카테고리에 따라 path가 다르므로 restaurant부터 시도
  const candidates = ["restaurant", "cafe", "place"];
  for (const c of candidates) {
    const html = await fetchHtml(`${PCMAP_BASE}/${c}/${id}/home`);
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
      imageUrl: normalizeImageUrl(ogMeta(html, "image")),
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
