// 네이버 플레이스 스텁 (로컬 검증용) — 샌드박스에서 naver.com이 차단되므로
// m.place.naver.com 응답 구조를 재현한다. 실 QA(2026-07-24)에서 확인된 특성 반영:
//   - 현행 모바일 페이지는 window.__APOLLO_STATE__ + ld+json 임베딩
//   - og:description은 "방문자리뷰 N"류 리뷰 요약 — 업종·주소로 쓰면 안 됨 (오염 케이스 포함)
// 사용: node scripts/place-stub.mjs &  →  NAVER_PLACE_BASE=http://127.0.0.1:4210 npx next dev
//  - /place/11660082/home : __APOLLO_STATE__ 현행 구조 (+ 오염 og:description)
//  - /place/22000001/home : og + ld+json만 (Apollo/NEXT_DATA 없음 — 주소·좌표는 ld+json)
//  - /place/33000002/home : 구형 __NEXT_DATA__ · 좌표 없음 (regionCenter 폴백)
//  - /place/44000003/home : og만 + 오염 description (업종·지역 오염 회귀 케이스)
import http from "node:http";

const PORT = Number(process.env.PLACE_STUB_PORT || 4210);

function page({ apollo, nextData, ldJson, og }) {
  const parts = [];
  if (og) {
    parts.push(
      Object.entries(og)
        .map(([k, v]) => `<meta property="og:${k}" content="${v}"/>`)
        .join("\n"),
    );
  }
  if (ldJson) parts.push(`<script type="application/ld+json">${JSON.stringify(ldJson)}</script>`);
  const body = [];
  if (nextData) body.push(`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script>`);
  if (apollo) body.push(`<script>window.__APOLLO_STATE__ = ${JSON.stringify(apollo)};if(window.a){}</script>`);
  return `<!DOCTYPE html><html><head>${parts.join("\n")}</head><body>${body.join("\n")}</body></html>`;
}

const PLACES = {
  // 현행 구조 — Apollo 캐시 "*Base:{id}". og:description은 리뷰 요약(오염원)
  "11660082": page({
    apollo: {
      "RestaurantBase:11660082": {
        id: "11660082",
        name: "쟈니브로스버거 압구정본점",
        category: "햄버거",
        address: "서울특별시 강남구 신사동 668-9",
        roadAddress: "서울특별시 강남구 압구정로42길 25",
        x: "127.0387",
        y: "37.5271",
        visitorReviewsScore: 4.5,
        visitorReviewsTotal: 321,
        imageUrl: "https://ldb-phinf.pstatic.net/20240101_1/place-thumb-1.jpg",
      },
    },
    og: {
      title: "쟈니브로스버거 압구정본점 : 네이버",
      description: "방문자리뷰 321 · 블로그리뷰 45",
      image: "https://ldb-phinf.pstatic.net/20240101_1/og-image.jpg",
    },
  }),
  // Apollo/NEXT_DATA 없이 og + ld+json — 주소·좌표·썸네일은 ld+json에서
  "22000001": page({
    og: {
      title: "연희동 소금빵집 : 네이버",
      description: "방문자리뷰 3",
      image: "https://ldb-phinf.pstatic.net/20240202_9/og-only-thumb.jpg",
    },
    ldJson: {
      "@context": "http://schema.org",
      "@type": "Bakery",
      name: "연희동 소금빵집",
      address: { "@type": "PostalAddress", streetAddress: "서울특별시 서대문구 연희로 100" },
      geo: { "@type": "GeoCoordinates", latitude: 37.5686, longitude: 126.9316 },
      image: "https://ldb-phinf.pstatic.net/20240202_9/ld-thumb.jpg",
      telephone: "02-111-2222",
    },
  }),
  // 구형 __NEXT_DATA__ · 좌표 없음 — 시군구 기준점 폴백 검증
  "33000002": page({
    nextData: {
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
    og: { image: "https://ldb-phinf.pstatic.net/20240303_3/no-coord-thumb.jpg" },
  }),
  // og만 + 오염 description — 업종/지역이 리뷰 요약으로 오염되면 안 된다 (실 QA 회귀)
  "44000003": page({
    og: {
      title: "데이터 없는 매장 : 네이버",
      description: "방문자리뷰 3",
      image: "https://ldb-phinf.pstatic.net/20240404_4/og-poison-thumb.jpg",
    },
  }),
};

http
  .createServer((req, res) => {
    const m = (req.url || "").match(/^\/(?:place|restaurant|cafe)\/(\d+)\/home/);
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
