// 네이버 플레이스 스텁 (로컬 검증용) — 샌드박스에서 naver.com이 차단되므로
// m.place.naver.com 응답 구조(__NEXT_DATA__ / og: 메타)를 재현한다.
// 사용: node scripts/place-stub.mjs &  →  NAVER_PLACE_BASE=http://127.0.0.1:4210 npx next dev
//  - /place/11660082/home : __NEXT_DATA__ 정상 케이스 (이름·카테고리·주소·좌표·썸네일)
//  - /place/22000001/home : __NEXT_DATA__ 없이 og: 메타만 있는 케이스 (구조 변경 폴백)
//  - /place/33000002/home : 좌표 없는 케이스 (regionCenter 폴백 검증)
import http from "node:http";

const PORT = Number(process.env.PLACE_STUB_PORT || 4210);

function page(nextData, og) {
  const nd = nextData
    ? `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script>`
    : "";
  const ogTags = Object.entries(og || {})
    .map(([k, v]) => `<meta property="og:${k}" content="${v}"/>`)
    .join("\n");
  return `<!DOCTYPE html><html><head>${ogTags}</head><body>${nd}</body></html>`;
}

const PLACES = {
  "11660082": page(
    {
      props: {
        pageProps: {
          place: {
            base: {
              id: "11660082",
              name: "쟈니브로스버거 압구정본점",
              category: "햄버거",
              address: "서울특별시 강남구 신사동 668-9",
              roadAddress: "서울특별시 강남구 압구정로42길 25",
              x: "127.0387",
              y: "37.5271",
              phone: "02-000-0000",
              businessStatus: { status: "영업 중" },
            },
            images: [
              { url: "https://ldb-phinf.pstatic.net/20240101_1/place-thumb-1.jpg" },
              { url: "https://ldb-phinf.pstatic.net/20240101_2/place-thumb-2.jpg" },
            ],
            visitorReviewsTotal: 321,
            visitorReviewsScore: 4.5,
          },
        },
      },
    },
    { image: "https://ldb-phinf.pstatic.net/20240101_1/og-image.jpg", title: "쟈니브로스버거 압구정본점 : 네이버" },
  ),
  "22000001": page(null, {
    title: "연희동 소금빵집 : 네이버",
    description: "베이커리 · 서울특별시 서대문구 연희로 100",
    image: "https://ldb-phinf.pstatic.net/20240202_9/og-only-thumb.jpg",
  }),
  "33000002": page(
    {
      props: {
        pageProps: {
          place: {
            base: {
              id: "33000002",
              name: "수원 화서동 파스타",
              category: "이탈리아음식",
              address: "경기도 수원시 팔달구 화서동 123-4",
              roadAddress: "경기도 수원시 팔달구 화서문로 10",
            },
          },
        },
      },
    },
    { image: "https://ldb-phinf.pstatic.net/20240303_3/no-coord-thumb.jpg" },
  ),
};

http
  .createServer((req, res) => {
    const m = (req.url || "").match(/^\/place\/(\d+)\/home/);
    const body = m ? PLACES[m[1]] : null;
    if (!body) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(body);
  })
  .listen(PORT, () => console.log(`[place-stub] listening on :${PORT}`));
