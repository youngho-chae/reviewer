import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Naver Static Maps API 프록시.
// 서버사이드 호출이라 NCP "Web 서비스 URL" 화이트리스트 불필요.
// Client ID/Secret만 있으면 작동.

// NCP 키는 환경변수로만 주입한다(소스 하드코딩 폴백 제거).
const KEY_ID = process.env.NAVER_MAP_CLIENT_ID || "";
const KEY_SECRET = process.env.NAVER_MAP_CLIENT_SECRET || "";

export async function GET(req: NextRequest) {
  if (!KEY_ID || !KEY_SECRET) {
    return NextResponse.json({ error: "map_not_configured" }, { status: 503 });
  }
  const url = new URL(req.url);
  const center = url.searchParams.get("center") || "126.978,37.5665";
  const level = url.searchParams.get("level") || "11";
  const w = Math.min(parseInt(url.searchParams.get("w") || "600", 10), 1024);
  const h = Math.min(parseInt(url.searchParams.get("h") || "400", 10), 1024);
  const markers = url.searchParams.getAll("marker"); // pos:lng lat|type:n|label:1 ...

  const params = new URLSearchParams();
  params.set("center", center);
  params.set("level", level);
  params.set("w", String(w));
  params.set("h", String(h));
  params.set("scale", "2");
  for (const m of markers) {
    params.append("markers", m);
  }

  const naverUrl = `https://naveropenapi.apigw.ntruss.com/map-static/v2/raster?${params.toString()}`;

  try {
    const r = await fetch(naverUrl, {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": KEY_ID,
        "X-NCP-APIGW-API-KEY": KEY_SECRET,
      },
      cache: "no-store",
    });
    if (!r.ok) {
      const body = await r.text();
      return NextResponse.json(
        { error: "naver_static_map_failed", status: r.status, body: body.slice(0, 400) },
        { status: 502 }
      );
    }
    const buf = await r.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": r.headers.get("content-type") || "image/png",
        "Cache-Control": "public, max-age=600",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: "fetch_error", message: String(e?.message || e) }, { status: 502 });
  }
}
