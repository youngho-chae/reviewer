// Naver Place 모바일 페이지 스크레이퍼 — 매장명·카테고리(업종)·주소·좌표·첫 썸네일 수집.
// 샌드박스에서는 네이버가 차단되지만 Vercel icn1(서울) 리전에선 정상 작동.
//
// 플레이스 페이지는 시기·유형에 따라 데이터 임베딩 방식이 다르다 (2026-07-24 실 QA 반영):
//   1) window.__APOLLO_STATE__  — 현행 m.place/pcmap 공통 (키: "*Base:{id}")
//   2) __NEXT_DATA__            — 구형 모바일 페이지
//   3) <script type="application/ld+json"> — schema.org (name·address·geo·image, 매우 안정적)
//   4) og: 메타                  — 매장명·썸네일만 신뢰 (og:description은 "방문자리뷰 N"
//      같은 리뷰 요약이라 업종·주소로 쓰면 안 된다 — 실 QA에서 카테고리 오염 확인)
// 위 소스를 전부 파싱해 필드 단위로 병합한다. 헤드리스 브라우저 없이 fetch만 사용 —
// 데이터가 SSR HTML에 포함되어 JS 실행이 불필요하고 서버리스 부담이 없다.
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
  imageUrl?: string; // 플레이스 첫 썸네일
  source: "apollo" | "next-data" | "ld-json" | "og-meta" | "pcmap" | "merged";
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

// marker 뒤의 JSON 오브젝트를 중괄호 균형으로 잘라 파싱 — `};</script>` 형태 가정을 없앤다
// (미니파이·후속 구문 변화에 강함)
function extractJsonAfter(html: string, marker: RegExp): any | null {
  const m = html.match(marker);
  if (!m || m.index === undefined) return null;
  const start = html.indexOf("{", m.index + m[0].length - 1);
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < html.length && i < start + 3_000_000; i++) {
    const ch = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function extractNextData(html: string): any | null {
  return extractJsonAfter(html, /<script id="__NEXT_DATA__" type="application\/json">/);
}

function extractApolloState(html: string): any | null {
  return extractJsonAfter(html, /window\.__APOLLO_STATE__\s*=\s*/);
}

// schema.org ld+json — 여러 블록이 있을 수 있어 전부 파싱
function extractLdJson(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1]);
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {}
  }
  return out;
}

function ogMeta(html: string, property: string): string | undefined {
  const re = new RegExp(`<meta[^>]+property=["']og:${property}["'][^>]+content=["']([^"']+)["']`, "i");
  const alt = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${property}["']`, "i");
  const m = html.match(re) || html.match(alt);
  return m ? m[1].replace(/&amp;/g, "&") : undefined;
}

// 썸네일 URL 정리 — 프로토콜 없는 //ldb-phinf... 형태 보정, http→https
function normalizeImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const u = String(url).trim();
  if (!u) return undefined;
  if (u.startsWith("//")) return `https:${u}`;
  if (u.startsWith("http://")) return `https://${u.slice(7)}`;
  return u.startsWith("https://") ? u : undefined;
}

// 업종 후보 검증 — "방문자리뷰 3"·"블로그리뷰 12" 같은 리뷰 요약/숫자 문자열을 걸러낸다
// (2026-07-24 실 QA — og:description을 업종으로 오인해 카드에 노출된 사례)
function sanitizeCategory(v: unknown): string | undefined {
  if (v == null) return undefined;
  const c = (Array.isArray(v) ? v.join(" ") : String(v)).trim();
  if (!c) return undefined;
  if (c.length > 25) return undefined;
  if (/\d/.test(c)) return undefined;
  if (/(리뷰|별점|평점|영업|저장|길찾기|네이버|방문자)/.test(c)) return undefined;
  return c;
}

// 한국 주소 검증 — 시도(공식/축약)로 시작하는 문자열만 주소로 신뢰
function sanitizeAddress(v: unknown): string | undefined {
  if (v == null) return undefined;
  const a = String(v).trim();
  if (!a) return undefined;
  if (
    !/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)(특별시|광역시|특별자치시|특별자치도|도)?\s/.test(
      a,
    )
  ) {
    return undefined;
  }
  return a;
}

function toNum(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

type Partial_ = Omit<ScrapedPlace, "id" | "source">;

// 필드 단위 병합 — 앞선 소스(더 신뢰) 값을 우선
function merge(base: Partial_, extra: Partial_): Partial_ {
  const out: Partial_ = { ...base };
  for (const k of Object.keys(extra) as (keyof Partial_)[]) {
    if (out[k] === undefined && extra[k] !== undefined) (out[k] as unknown) = extra[k];
  }
  return out;
}

// Apollo 캐시에서 "*Base:{id}" 엔트리 추출 (m.place·pcmap 공통 구조)
function fromApollo(apollo: any, id: string): Partial_ | null {
  const baseKey = Object.keys(apollo).find((k) => k.includes("Base:") && k.endsWith(`:${id}`));
  const base = baseKey
    ? apollo[baseKey]
    : walkFind<any>(apollo, (k, v) => v && typeof v === "object" && (v as any).id === id && (v as any).name);
  if (!base || !base.name) return null;
  const coord = base.coordinate || {};
  return {
    name: base.name,
    category: sanitizeCategory(base.category),
    address: sanitizeAddress(base.address || base.fullAddress),
    roadAddress: sanitizeAddress(base.roadAddress || base.fullRoadAddress),
    lat: toNum(base.y ?? base.lat ?? coord.y ?? coord.lat),
    lng: toNum(base.x ?? base.lng ?? coord.x ?? coord.lng),
    rating: toNum(base.visitorReviewsScore),
    reviewCount: toNum(base.visitorReviewsTotal),
    phone: base.phone || base.virtualPhone,
    imageUrl: normalizeImageUrl(base.imageUrl || base.thumUrl),
  };
}

function fromNextData(data: any): Partial_ | null {
  const summary = walkFind<any>(
    data,
    (k, v) => k === "base" && v && typeof v === "object" && (v as any).name && (v as any).category !== undefined,
  );
  if (!summary) return null;
  const menus = walkFind<any[]>(data, (k, v) => k === "menus" && Array.isArray(v) && v.length > 0 && v[0]?.name);
  const visitorReviewsTotal = walkFind<number>(data, (k, v) => k === "visitorReviewsTotal" && typeof v === "number");
  const score = walkFind<number>(data, (k, v) => k === "visitorReviewsScore" && typeof v === "number");
  const images = walkFind<any[]>(
    data,
    (k, v) => (k === "images" || k === "photos") && Array.isArray(v) && v.length > 0 && !!(v[0]?.url || v[0]?.origin),
  );
  return {
    name: summary.name,
    category: sanitizeCategory(summary.category),
    address: sanitizeAddress(summary.address || summary.commonAddress),
    roadAddress: sanitizeAddress(summary.roadAddress),
    lat: toNum(summary.y ?? summary.lat ?? summary.mapy),
    lng: toNum(summary.x ?? summary.lng ?? summary.mapx),
    rating: typeof score === "number" ? score : undefined,
    reviewCount: typeof visitorReviewsTotal === "number" ? visitorReviewsTotal : undefined,
    hours: summary.businessStatus?.status,
    phone: summary.phone || summary.virtualPhone,
    menus: Array.isArray(menus) ? menus.slice(0, 8).map((m: any) => ({ name: m.name, price: m.price })) : undefined,
    imageUrl: normalizeImageUrl(summary.thumUrl || summary.imageUrl) || normalizeImageUrl(images?.[0]?.url || images?.[0]?.origin),
  };
}

// schema.org — name·address(streetAddress)·geo·image가 안정적으로 들어온다
function fromLdJson(blocks: any[]): Partial_ | null {
  const node = blocks.find((b) => b && typeof b === "object" && b.name && (b.address || b.geo || b.image));
  if (!node) return null;
  const street =
    typeof node.address === "string" ? node.address : node.address?.streetAddress || node.address?.name;
  const image = Array.isArray(node.image) ? node.image[0] : node.image;
  return {
    name: String(node.name),
    address: sanitizeAddress(street),
    lat: toNum(node.geo?.latitude),
    lng: toNum(node.geo?.longitude),
    phone: node.telephone,
    imageUrl: normalizeImageUrl(typeof image === "string" ? image : image?.url || image?.contentUrl),
  };
}

// og: 메타 — 매장명·썸네일만 신뢰. og:description은 리뷰 요약이라 업종·주소로 쓰지 않는다.
function fromOg(html: string): Partial_ | null {
  const ogTitle = ogMeta(html, "title");
  const image = normalizeImageUrl(ogMeta(html, "image"));
  if (!ogTitle && !image) return null;
  const name = ogTitle ? ogTitle.replace(/\s*[:|·]\s*네이버.*$/, "").trim() : undefined;
  return { name: name || undefined, imageUrl: image };
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

function parseHtml(html: string, id: string): Partial_ | null {
  let acc: Partial_ = {};
  const apollo = extractApolloState(html);
  if (apollo) {
    const a = fromApollo(apollo, id);
    if (a) acc = merge(acc, a);
  }
  const nd = extractNextData(html);
  if (nd) {
    const n = fromNextData(nd);
    if (n) acc = merge(acc, n);
  }
  const ld = fromLdJson(extractLdJson(html));
  if (ld) acc = merge(acc, ld);
  const og = fromOg(html);
  if (og) acc = merge(acc, og);
  return acc.name ? acc : null;
}

const complete = (p: Partial_ | null) => !!p && !!p.name && !!p.category && !!(p.address || p.roadAddress) && !!p.imageUrl;

export async function scrapePlace(id: string): Promise<ScrapedPlace | null> {
  // 1) 모바일 홈 — 대부분 여기서 끝난다
  const mobileHtml = await fetchHtml(`${PLACE_BASE}/place/${id}/home`);
  let acc: Partial_ | null = mobileHtml ? parseHtml(mobileHtml, id) : null;
  if (complete(acc)) return { id, ...acc!, source: "merged" };

  // 2) 부족한 필드는 pcmap에서 보충 (업종별 path 순회)
  for (const c of ["restaurant", "cafe", "place"]) {
    const html = await fetchHtml(`${PCMAP_BASE}/${c}/${id}/home`);
    if (!html) continue;
    const p = parseHtml(html, id);
    if (!p) continue;
    acc = acc ? merge(acc, p) : p;
    if (complete(acc)) break;
  }
  return acc && acc.name ? { id, ...acc, source: "merged" } : null;
}
