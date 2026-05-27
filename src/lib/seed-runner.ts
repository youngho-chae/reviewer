import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { Campaign, DBShape, Owner, Reviewer, SnsKind, Store } from "./types";

// 결정론적 ID — 서버리스 인스턴스 간 동일 ID 보장
function detId(prefix: string, seed: string): string {
  const h = crypto.createHash("sha256").update(seed).digest("hex").slice(0, 12);
  return `${prefix}_${h}`;
}

// ─────────────────────────────────────────────────────────────
// 매장 시드 — 실제 네이버 Place ID 10개 (사용자 제공) + 합리적 추정값.
// 실제 매장명/주소/메뉴는 자사 운영팀이 Naver Place 페이지에서 확인 후
// 정정 권장. 좌표는 동네 중심으로 근사.
// ─────────────────────────────────────────────────────────────
interface SeedStore {
  naverPlaceId: string;
  name: string;
  category: string;
  area: string;
  coverEmoji: string;
  address: string;
  lat: number;
  lng: number;
  rating: number;
  reviewCount: number;
  menus: string[]; // 카테고리에 어울리는 임의 시그니처 메뉴 풀
  requiredChannels: SnsKind[];
}

const SEED_STORES: SeedStore[] = [
  {
    naverPlaceId: "1621388960",
    name: "한남 코너 다이닝",
    category: "양식",
    area: "한남동",
    coverEmoji: "🍝",
    address: "서울 용산구 한남대로 27길",
    lat: 37.5340,
    lng: 127.0028,
    rating: 4.7,
    reviewCount: 312,
    menus: ["트러플 파스타", "립아이 스테이크", "수제 화덕 피자"],
    requiredChannels: ["naver_blog", "instagram"],
  },
  {
    naverPlaceId: "31906212",
    name: "성수 베이커리 카페",
    category: "카페",
    area: "성수동",
    coverEmoji: "🥐",
    address: "서울 성동구 성수이로 88",
    lat: 37.5446,
    lng: 127.0556,
    rating: 4.8,
    reviewCount: 524,
    menus: ["크루아상 세트", "시그니처 라떼", "휘낭시에"],
    requiredChannels: ["instagram", "naver_blog"],
  },
  {
    naverPlaceId: "959481202",
    name: "북촌 한정식",
    category: "한식",
    area: "북촌",
    coverEmoji: "🍱",
    address: "서울 종로구 북촌로 23",
    lat: 37.5826,
    lng: 126.9846,
    rating: 4.6,
    reviewCount: 187,
    menus: ["한정식 코스", "갈비찜 정식", "잡채 정식"],
    requiredChannels: ["naver_blog", "instagram"],
  },
  {
    naverPlaceId: "32126858",
    name: "강남 스시 오마카세",
    category: "일식",
    area: "강남",
    coverEmoji: "🍣",
    address: "서울 강남구 도산대로 87",
    lat: 37.5246,
    lng: 127.0392,
    rating: 4.9,
    reviewCount: 421,
    menus: ["오마카세 디너 12종", "사케 페어링", "초밥 런치 세트"],
    requiredChannels: ["instagram", "youtube"],
  },
  {
    naverPlaceId: "1922926992",
    name: "이태원 와인바",
    category: "주점",
    area: "이태원",
    coverEmoji: "🍷",
    address: "서울 용산구 이태원로 200",
    lat: 37.5345,
    lng: 126.9947,
    rating: 4.5,
    reviewCount: 268,
    menus: ["하우스 와인 1병", "치즈 플레이트", "샤퀴테리 보드"],
    requiredChannels: ["instagram", "naver_blog"],
  },
  {
    naverPlaceId: "11858321",
    name: "홍대 분식 다이너",
    category: "한식",
    area: "홍대",
    coverEmoji: "🍜",
    address: "서울 마포구 와우산로 29길",
    lat: 37.5563,
    lng: 126.9237,
    rating: 4.4,
    reviewCount: 612,
    menus: ["떡볶이 세트", "트러플 떡갈비", "수제 만두"],
    requiredChannels: ["instagram", "tiktok"],
  },
  {
    naverPlaceId: "2012466103",
    name: "삼청동 브런치",
    category: "카페",
    area: "삼청동",
    coverEmoji: "🍳",
    address: "서울 종로구 삼청로 56",
    lat: 37.5847,
    lng: 126.9819,
    rating: 4.6,
    reviewCount: 345,
    menus: ["아보카도 토스트", "에그 베네딕트", "수제 그래놀라 볼"],
    requiredChannels: ["naver_blog", "instagram"],
  },
  {
    naverPlaceId: "1067489343",
    name: "연남 라멘",
    category: "일식",
    area: "연남동",
    coverEmoji: "🍥",
    address: "서울 마포구 연남로 1길",
    lat: 37.5634,
    lng: 126.9248,
    rating: 4.7,
    reviewCount: 489,
    menus: ["돈코츠 라멘", "차슈동", "교자 세트"],
    requiredChannels: ["instagram", "naver_blog"],
  },
  {
    naverPlaceId: "1185421575",
    name: "가로수길 디저트 살롱",
    category: "카페",
    area: "신사동",
    coverEmoji: "🧁",
    address: "서울 강남구 가로수길 41",
    lat: 37.5197,
    lng: 127.0226,
    rating: 4.8,
    reviewCount: 276,
    menus: ["시그니처 케이크", "마카롱 6종", "딸기 타르트"],
    requiredChannels: ["instagram", "naver_blog"],
  },
  {
    naverPlaceId: "1261430410",
    name: "망원 비스트로",
    category: "양식",
    area: "망원동",
    coverEmoji: "🥩",
    address: "서울 마포구 망원로 5길",
    lat: 37.5560,
    lng: 126.9050,
    rating: 4.5,
    reviewCount: 198,
    menus: ["오늘의 비스트로 코스", "수제 햄버그스테이크", "와인 한 잔 페어링"],
    requiredChannels: ["naver_blog", "instagram"],
  },
];

// 매장당 임의 메뉴 2개를 시그니처 메뉴 풀에서 선정
function pickMenus(pool: string[], seed: string): string[] {
  const h = crypto.createHash("sha256").update(seed).digest();
  const shuffled = pool.slice().sort((a, b) => {
    const ia = pool.indexOf(a);
    const ib = pool.indexOf(b);
    return (h[ia % h.length] - h[ib % h.length]) || 0;
  });
  return shuffled.slice(0, 2);
}

export function runSeed(db: DBShape) {
  if (db.seeded) return;
  db.seeded = true;

  const hash = (p: string) => bcrypt.hashSync(p, 8);
  const now = Date.now();

  // 단일 데모 사장님이 모든 매장을 소유 (테스트 편의)
  const owner: Owner = {
    id: detId("ow", "demo@store.com"),
    email: "demo@store.com",
    passwordHash: hash("demo1234"),
    storeName: "CATCHPASS 데모 매장군",
    category: "한식",
    area: "서울",
    plan: "Standard",
    createdAt: now - 1000 * 60 * 60 * 24 * 7,
  };
  db.owners.push(owner);

  for (const s of SEED_STORES) {
    const storeId = detId("st", s.naverPlaceId);
    const store: Store = {
      id: storeId,
      ownerId: owner.id,
      name: s.name,
      category: s.category,
      area: s.area,
      coverEmoji: s.coverEmoji,
      rating: s.rating,
      reviewCount: s.reviewCount,
      hours: "11:30 - 21:30",
      lat: s.lat,
      lng: s.lng,
      address: s.address,
      naverPlaceId: s.naverPlaceId,
    };
    db.stores.push(store);

    const menus = pickMenus(s.menus, s.naverPlaceId);
    const campaign: Campaign = {
      id: detId("cp", `${s.naverPlaceId}-default`),
      storeId,
      kind: "visit",
      title: `${s.name} 체험단`,
      startAt: now - 1000 * 60 * 60 * 24 * 2,
      endAt: now + 1000 * 60 * 60 * 24 * 28,
      supportAmount: 100000,
      quota: { S: 2, A: 3, B: 5, C: 10 },
      used: { S: 0, A: 0, B: 0, C: 0 },
      requiredChannels: s.requiredChannels,
      requiredMenus: menus,
      description: `${s.area}의 ${s.name}에서 시그니처 메뉴(${menus.join(", ")})를 체험하고 정성스러운 후기를 남겨주세요.`,
      createdAt: now - 1000 * 60 * 60 * 24 * 2,
    };
    db.campaigns.push(campaign);
  }

  // 기자단 캠페인 1건 (첫 매장 기준) — Press 플로우 데모용
  const pressStore = db.stores[0];
  if (pressStore) {
    const pressCampaign: Campaign = {
      id: detId("cp", `${pressStore.id}-press`),
      storeId: pressStore.id,
      kind: "press",
      title: `${pressStore.name} 기자단 모집`,
      startAt: now - 1000 * 60 * 60 * 24,
      endAt: now + 1000 * 60 * 60 * 24 * 21,
      supportAmount: 150000, // 정산 예정금
      quota: { S: 1, A: 2, B: 3, C: 0 },
      used: { S: 0, A: 0, B: 0, C: 0 },
      requiredChannels: ["naver_blog", "instagram"],
      requiredMenus: [],
      description: `${pressStore.name}의 신메뉴 출시 보도용 콘텐츠를 작성해주세요. 자료팩(제품 사진/매장 사진/브랜드 스토리)을 참고하여 자연스러운 후기 형태로 작성해주시면 됩니다.`,
      createdAt: now - 1000 * 60 * 60 * 24,
      pressKeywords: ["가을 신메뉴", "프리미엄 다이닝", "한남 맛집"],
      pressMaterials: [
        "신메뉴 상세 사진 8장 (.zip)",
        "브랜드 스토리 텍스트 (2,400자)",
        "사장님 인터뷰 영상 (3분)",
        "로고/심볼 가이드 (PDF)",
      ],
      pressMinChars: 1500,
    };
    db.campaigns.push(pressCampaign);
  }

  // 데모 체험자
  const reviewer: Reviewer = {
    id: detId("rv", "demo@reviewer.com"),
    email: "demo@reviewer.com",
    passwordHash: hash("demo1234"),
    nickname: "북촌리뷰어",
    sns: [
      { kind: "naver_blog", url: "https://blog.naver.com/demo", influence: 2400 },
      { kind: "instagram", url: "https://instagram.com/demo", influence: 5800 },
    ],
    grade: "B",
    createdAt: now - 1000 * 60 * 60 * 24 * 5,
    completedReviews: 3,
    qualityScore: 88,
    noShowCount: 0,
  };
  db.reviewers.push(reviewer);
}
