import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Naver Reverse Geocoding 프록시.
// 좌표(lat,lng) → 한국 행정구역(시·구·동) 라벨로 변환.
// 서버에서 NCP 키로 호출하므로 클라이언트 키 노출 없음.

const KEY_ID = process.env.NAVER_MAP_CLIENT_ID || "xucmechng0";
const KEY_SECRET = process.env.NAVER_MAP_CLIENT_SECRET || "LHX9wYjHXQFcjCAq8yyxNNfvIiDa8orX9cR04cUb";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const lat = parseFloat(url.searchParams.get("lat") || "");
  const lng = parseFloat(url.searchParams.get("lng") || "");
  if (!isFinite(lat) || !isFinite(lng)) {
    return NextResponse.json({ error: "invalid_coords" }, { status: 400 });
  }

  // Naver Reverse Geocoding API — coords=lng,lat (X=lng, Y=lat 순서 주의)
  const params = new URLSearchParams({
    coords: `${lng},${lat}`,
    orders: "legalcode,admcode",
    output: "json",
  });
  const naverUrl = `https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc?${params.toString()}`;

  try {
    const r = await fetch(naverUrl, {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": KEY_ID,
        "X-NCP-APIGW-API-KEY": KEY_SECRET,
      },
      cache: "no-store",
    });
    if (!r.ok) {
      return NextResponse.json({ error: "naver_failed", status: r.status }, { status: 502 });
    }
    const j: any = await r.json();
    // 응답 결과에서 행정구역명을 조합 (시도 + 시군구 + 읍면동)
    const result = j?.results?.[0];
    const region = result?.region;
    const parts = [region?.area1?.name, region?.area2?.name, region?.area3?.name]
      .filter(Boolean)
      .join(" ");
    return NextResponse.json({ label: parts || null, raw: result || null });
  } catch (e: any) {
    return NextResponse.json({ error: "fetch_error", message: String(e?.message || e) }, { status: 502 });
  }
}
