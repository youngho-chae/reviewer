import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import { scrapePlace } from "@/lib/naver-scraper";
import { regionFromAddress } from "@/lib/regions";
import { regionCenter } from "@/lib/geo";
import type { Store } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

// 플레이스 URL/ID로 매장 등록 (확정 정책 5-1).
// 유료 멤버십은 등록 매장 선택이 기본이지만, 프리 등급처럼 등록 플레이스가 없는
// 사장님도 URL 입력·조회로 캠페인을 만들 수 있어야 한다 (프리 배제 금지).
// 스크래핑이 차단된 환경에서는 매장명 수동 입력 폴백으로 최소 정보 생성.

// m.place.naver.com/place/{id}, map.naver.com …/place/{id}, naver.me 단축 제외 — 숫자 ID 직접 입력도 허용
function parsePlaceId(input: string): string | null {
  const raw = input.trim();
  if (/^\d{5,}$/.test(raw)) return raw;
  const m = raw.match(/(?:place|restaurant|cafe|hairshop|hospital|beauty)\/(\d{5,})/);
  return m ? m[1] : null;
}

export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "owner") {
    return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const placeUrl = String(body.placeUrl || "").trim();
  const manualName = String(body.name || "").trim().slice(0, 40);

  const placeId = parsePlaceId(placeUrl);
  if (!placeId) {
    return NextResponse.json(
      { error: "플레이스 URL에서 매장 ID를 찾지 못했어요. m.place.naver.com/place/숫자 형태의 링크나 숫자 ID를 입력해주세요." },
      { status: 400 },
    );
  }

  const db = await getDBAsync();
  const dup = db.stores.find((st) => st.ownerId === s.userId && st.naverPlaceId === placeId);
  if (dup) {
    return NextResponse.json({ ok: true, store: dup, duplicated: true });
  }

  // 플레이스 정보 조회 — 실패(차단·비공개) 시 매장명 수동 입력 폴백
  const scraped = await scrapePlace(placeId).catch(() => null);
  const name = scraped?.name || manualName;
  if (!name) {
    return NextResponse.json(
      { error: "플레이스 정보를 불러오지 못했어요. 매장명을 함께 입력해주세요." },
      { status: 422 },
    );
  }

  // 지역 매핑 (2026-07-24) — 플레이스 주소("서울특별시 강남구 …")를 REGIONS 기준
  // "서울 강남구" 라벨로 정규화해 지도 재검색·지역 필터·카드 지역 표기에 그대로 쓴다.
  // 좌표가 안 내려오면 시군구 행정 기준점(regionCenter)으로 폴백해 지도에서 빠지지 않게 한다.
  const fullAddress = scraped?.roadAddress || scraped?.address;
  const region = regionFromAddress(scraped?.address || fullAddress);
  const fallbackCenter = region ? regionCenter(region) : null;
  const store: Store = {
    id: rid("st"),
    ownerId: s.userId,
    name,
    category: scraped?.category || "기타",
    area: region || "미지정",
    coverEmoji: "🏪",
    rating: scraped?.rating ?? 0,
    reviewCount: scraped?.reviewCount ?? 0,
    hours: scraped?.hours || "영업시간 미등록",
    lat: scraped?.lat ?? fallbackCenter?.lat,
    lng: scraped?.lng ?? fallbackCenter?.lng,
    address: fullAddress,
    naverPlaceId: placeId,
    // 플레이스 첫 썸네일 — 캠페인 대표 사진 프리필·카드 폴백에 사용
    ...(scraped?.imageUrl ? { thumbnailUrl: scraped.imageUrl } : {}),
  };
  db.stores.push(store);
  await saveDBAsync();
  return NextResponse.json({ ok: true, store, scraped: !!scraped });
}
