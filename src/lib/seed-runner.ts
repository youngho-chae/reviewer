import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { Campaign, DBShape, Owner, Pass, RequiredMenu, Reviewer, SnsKind, Store } from "./types";

// ─────────────────────────────────────────────────────────────
// [스토리보드 모드] design/storyboard-schema 브랜치 전용.
// 시드의 모든 표시용 문자열 데이터를 한글 스키마 라벨로 치환하여,
// 디자인 파트가 "어떤 위치에 어떤 데이터가 들어가는지"를 스토리보드로 확인할 수 있게 함.
// 실데이터 원복은 backup/real-mockdata 브랜치 참조.
// ─────────────────────────────────────────────────────────────
const STORYBOARD = true;
const SB = {
  storeName: "매장명",
  category: "카테고리",
  area: "지역",
  hours: "영업시간",
  address: "주소",
  visitTitle: "캠페인명",
  pressTitle: "기자단명",
  visitDesc: "캠페인설명",
  pressDesc: "기자단설명",
  menu: "메뉴명",
  nickname: "닉네임",
  ownerStore: "매장명",
  keyword: "키워드",
  material: "자료명",
};

// 결정론적 ID — 서버리스 인스턴스 간 동일 ID 보장
function detId(prefix: string, seed: string): string {
  const h = crypto.createHash("sha256").update(seed).digest("hex").slice(0, 12);
  return `${prefix}_${h}`;
}

// 결정론적 단축 코드 (QA용) — 시드 데이터의 패스에 부여
function detPassCode(seed: string): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const h = crypto.createHash("sha256").update(seed).digest();
  let s = "";
  for (let i = 0; i < 8; i++) s += alphabet[h[i] % alphabet.length];
  return s;
}

// 결정론적 캠페인 4자리 사용처리 코드 (시드/데모용).
function detUseCode(seed: string): string {
  const h = crypto.createHash("sha256").update(`usecode:${seed}`).digest();
  const n = (h.readUInt16BE(0) % 10000);
  return n.toString().padStart(4, "0");
}

// ─────────────────────────────────────────────────────────────
// 매장 시드 — 다양한 업종을 포함하여 QA/데모 폭을 확보.
// 음식점은 실 네이버 Place ID 사용, 그 외는 데모용 가상 placeId.
// 좌표는 동네 중심 근사.
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
  menus: string[];
  requiredChannels: SnsKind[];
  supportAmount?: number; // 기본 100,000
  description?: string;
}

const SEED_STORES: SeedStore[] = [
  // ── 음식 / 카페 / 주점 ──
  {
    naverPlaceId: "1621388960",
    name: "한남 코너 다이닝",
    category: "양식",
    area: "한남동",
    coverEmoji: "🍝",
    address: "서울 용산구 한남대로 27길",
    lat: 37.5340, lng: 127.0028,
    rating: 4.7, reviewCount: 312,
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
    lat: 37.5446, lng: 127.0556,
    rating: 4.8, reviewCount: 524,
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
    lat: 37.5826, lng: 126.9846,
    rating: 4.6, reviewCount: 187,
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
    lat: 37.5246, lng: 127.0392,
    rating: 4.9, reviewCount: 421,
    menus: ["오마카세 디너 12종", "사케 페어링", "초밥 런치 세트"],
    requiredChannels: ["instagram", "youtube"],
    supportAmount: 150000,
  },
  {
    naverPlaceId: "1922926992",
    name: "이태원 와인바",
    category: "주점",
    area: "이태원",
    coverEmoji: "🍷",
    address: "서울 용산구 이태원로 200",
    lat: 37.5345, lng: 126.9947,
    rating: 4.5, reviewCount: 268,
    menus: ["하우스 와인 1병", "치즈 플레이트", "샤퀴테리 보드"],
    requiredChannels: ["instagram", "naver_blog"],
  },
  {
    naverPlaceId: "11858321",
    name: "홍대 분식 다이너",
    category: "분식",
    area: "홍대",
    coverEmoji: "🍜",
    address: "서울 마포구 와우산로 29길",
    lat: 37.5563, lng: 126.9237,
    rating: 4.4, reviewCount: 612,
    menus: ["떡볶이 세트", "트러플 떡갈비", "수제 만두"],
    requiredChannels: ["instagram", "tiktok"],
    supportAmount: 50000,
  },
  {
    naverPlaceId: "2012466103",
    name: "삼청동 브런치",
    category: "카페",
    area: "삼청동",
    coverEmoji: "🍳",
    address: "서울 종로구 삼청로 56",
    lat: 37.5847, lng: 126.9819,
    rating: 4.6, reviewCount: 345,
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
    lat: 37.5634, lng: 126.9248,
    rating: 4.7, reviewCount: 489,
    menus: ["돈코츠 라멘", "차슈동", "교자 세트"],
    requiredChannels: ["instagram", "naver_blog"],
  },
  {
    naverPlaceId: "1185421575",
    name: "가로수길 디저트 살롱",
    category: "디저트",
    area: "신사동",
    coverEmoji: "🧁",
    address: "서울 강남구 가로수길 41",
    lat: 37.5197, lng: 127.0226,
    rating: 4.8, reviewCount: 276,
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
    lat: 37.5560, lng: 126.9050,
    rating: 4.5, reviewCount: 198,
    menus: ["오늘의 비스트로 코스", "수제 햄버그스테이크", "와인 한 잔 페어링"],
    requiredChannels: ["naver_blog", "instagram"],
  },

  // ── 미용 / 뷰티 ──
  {
    naverPlaceId: "demo-beauty-001",
    name: "성수 헤어살롱 메종",
    category: "미용실",
    area: "성수동",
    coverEmoji: "💇",
    address: "서울 성동구 성수동2가 277",
    lat: 37.5448, lng: 127.0586,
    rating: 4.8, reviewCount: 412,
    menus: ["디자이너 컷", "컬러 + 클리닉", "두피 스파"],
    requiredChannels: ["instagram", "naver_blog"],
    supportAmount: 80000,
    description: "성수동 디자이너 헤어살롱에서 컷 또는 컬러 시술을 체험하고 비포/애프터 사진과 함께 후기를 남겨주세요.",
  },
  {
    naverPlaceId: "demo-beauty-002",
    name: "압구정 네일 아틀리에",
    category: "네일아트",
    area: "압구정",
    coverEmoji: "💅",
    address: "서울 강남구 압구정로 60길 13",
    lat: 37.5273, lng: 127.0286,
    rating: 4.9, reviewCount: 587,
    menus: ["젤 네일 (시그니처)", "케어 + 파라핀", "발 케어 페디큐어"],
    requiredChannels: ["instagram", "tiktok"],
    supportAmount: 60000,
    description: "압구정 프리미엄 네일 아틀리에에서 손/발 케어 + 시그니처 아트 디자인을 체험해보세요.",
  },
  {
    naverPlaceId: "demo-beauty-003",
    name: "청담 피부과 클리닉",
    category: "피부과",
    area: "청담",
    coverEmoji: "🩺",
    address: "서울 강남구 청담동 89-12",
    lat: 37.5230, lng: 127.0492,
    rating: 4.7, reviewCount: 234,
    menus: ["인모드 리프팅", "물광 주사", "기본 피부 스케일링"],
    requiredChannels: ["naver_blog", "instagram"],
    supportAmount: 200000,
    description: "청담 피부과의 인모드 리프팅 또는 기본 스케일링 1회 시술 체험.",
  },

  // ── 의료 / 헬스케어 ──
  {
    naverPlaceId: "demo-clinic-001",
    name: "역삼 치과의원",
    category: "치과",
    area: "역삼동",
    coverEmoji: "🦷",
    address: "서울 강남구 테헤란로 152",
    lat: 37.5005, lng: 127.0364,
    rating: 4.6, reviewCount: 178,
    menus: ["전문가 치아 미백", "기본 스케일링", "잇몸 케어"],
    requiredChannels: ["naver_blog"],
    supportAmount: 120000,
    description: "전문가 미백 또는 스케일링 1회 체험 후 상세 후기 작성.",
  },
  {
    naverPlaceId: "demo-clinic-002",
    name: "광화문 한의원",
    category: "한의원",
    area: "광화문",
    coverEmoji: "🌿",
    address: "서울 종로구 종로 19",
    lat: 37.5707, lng: 126.9772,
    rating: 4.5, reviewCount: 92,
    menus: ["체질 진단 + 침치료", "추나 요법", "한방 다이어트 상담"],
    requiredChannels: ["naver_blog", "instagram"],
    supportAmount: 90000,
    description: "한의사 1:1 체질 진단 + 침/추나 1회 체험.",
  },

  // ── 펫 ──
  {
    naverPlaceId: "demo-pet-001",
    name: "잠실 도그 그루밍",
    category: "애견미용",
    area: "잠실",
    coverEmoji: "🐶",
    address: "서울 송파구 올림픽로 240",
    lat: 37.5133, lng: 127.1028,
    rating: 4.9, reviewCount: 326,
    menus: ["기본 미용 (중형견)", "스파 + 미용 풀패키지", "위생 컷"],
    requiredChannels: ["instagram", "naver_blog"],
    supportAmount: 70000,
    description: "반려견 사이즈별 그루밍 + 스파 체험. 미용 전/후 사진 필수.",
  },
  {
    naverPlaceId: "demo-pet-002",
    name: "성수 동물병원",
    category: "동물병원",
    area: "성수동",
    coverEmoji: "🐾",
    address: "서울 성동구 연무장길 17",
    lat: 37.5443, lng: 127.0566,
    rating: 4.7, reviewCount: 145,
    menus: ["종합 건강검진", "기본 예방접종", "치아 스케일링"],
    requiredChannels: ["naver_blog"],
    supportAmount: 130000,
    description: "반려동물 종합 검진 1회 체험. 사전 예약 필수.",
  },

  // ── 운동 / 웰니스 ──
  {
    naverPlaceId: "demo-fit-001",
    name: "강남 1:1 PT 스튜디오",
    category: "PT",
    area: "강남",
    coverEmoji: "🏋️",
    address: "서울 강남구 강남대로 358",
    lat: 37.4988, lng: 127.0276,
    rating: 4.8, reviewCount: 211,
    menus: ["1:1 PT 4회권", "체형 분석 + 1회 PT", "그룹 클래스 1회"],
    requiredChannels: ["instagram", "naver_blog"],
    supportAmount: 150000,
    description: "전문 트레이너의 체형 분석 + 1:1 PT 체험.",
  },
  {
    naverPlaceId: "demo-fit-002",
    name: "한남 필라테스 스튜디오",
    category: "필라테스",
    area: "한남동",
    coverEmoji: "🧘",
    address: "서울 용산구 한남대로 91",
    lat: 37.5345, lng: 127.0042,
    rating: 4.7, reviewCount: 168,
    menus: ["기구 1:1 1회", "기구 그룹 2회", "매트 그룹 4회"],
    requiredChannels: ["instagram"],
    supportAmount: 85000,
    description: "리포머/캐딜락 1:1 또는 그룹 클래스 체험.",
  },
  {
    naverPlaceId: "demo-fit-003",
    name: "을지로 아로마 마사지",
    category: "마사지",
    area: "을지로",
    coverEmoji: "💆",
    address: "서울 중구 을지로 67",
    lat: 37.5663, lng: 126.9921,
    rating: 4.6, reviewCount: 89,
    menus: ["딥티슈 60분", "스웨디시 60분", "두피 + 어깨 30분"],
    requiredChannels: ["naver_blog", "instagram"],
    supportAmount: 80000,
    description: "전문 테라피스트의 1:1 아로마 마사지 60분 체험.",
  },
];

function pickMenus(pool: string[], seed: string): string[] {
  const h = crypto.createHash("sha256").update(seed).digest();
  const shuffled = pool.slice().sort((a, b) => {
    const ia = pool.indexOf(a);
    const ib = pool.indexOf(b);
    return (h[ia % h.length] - h[ib % h.length]) || 0;
  });
  return shuffled.slice(0, 2);
}

// 데모용 가격 시드 — 카테고리별 합리적 범위에서 시드 기반으로 결정.
function seededPrice(seed: string, base: number, span: number): number {
  const h = crypto.createHash("sha256").update(seed).digest();
  const offset = h[0] % Math.max(1, Math.floor(span / 1000));
  const price = base + offset * 1000;
  return Math.round(price / 1000) * 1000; // 천원 단위 반올림
}

function priceForCategory(category: string, menuName: string): number {
  const seed = `${category}::${menuName}`;
  switch (category) {
    case "양식": return seededPrice(seed, 22000, 18000);
    case "한식": return seededPrice(seed, 18000, 22000);
    case "일식": return seededPrice(seed, 28000, 32000);
    case "카페": return seededPrice(seed, 6500, 5500);
    case "주점": return seededPrice(seed, 24000, 26000);
    case "분식": return seededPrice(seed, 7500, 6500);
    case "디저트": return seededPrice(seed, 8500, 7500);
    case "미용실": return seededPrice(seed, 35000, 65000);
    case "네일아트": return seededPrice(seed, 45000, 35000);
    case "피부과": return seededPrice(seed, 150000, 250000);
    case "치과": return seededPrice(seed, 80000, 80000);
    case "한의원": return seededPrice(seed, 50000, 50000);
    case "애견미용": return seededPrice(seed, 45000, 35000);
    case "동물병원": return seededPrice(seed, 80000, 100000);
    case "PT": return seededPrice(seed, 70000, 80000);
    case "필라테스": return seededPrice(seed, 55000, 45000);
    case "마사지": return seededPrice(seed, 70000, 50000);
    default: return seededPrice(seed, 25000, 25000);
  }
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
    storeName: STORYBOARD ? SB.ownerStore : "CATCHPASS 데모 매장군",
    category: STORYBOARD ? SB.category : "한식",
    area: STORYBOARD ? SB.area : "서울",
    plan: "Standard",
    createdAt: now - 1000 * 60 * 60 * 24 * 7,
  };
  db.owners.push(owner);

  for (const s of SEED_STORES) {
    const storeId = detId("st", s.naverPlaceId);
    const store: Store = {
      id: storeId,
      ownerId: owner.id,
      name: STORYBOARD ? SB.storeName : s.name,
      category: STORYBOARD ? SB.category : s.category,
      area: STORYBOARD ? SB.area : s.area,
      coverEmoji: s.coverEmoji,
      rating: s.rating,
      reviewCount: s.reviewCount,
      hours: STORYBOARD ? SB.hours : "11:30 - 21:30",
      lat: s.lat,
      lng: s.lng,
      address: STORYBOARD ? SB.address : s.address,
      naverPlaceId: s.naverPlaceId,
    };
    db.stores.push(store);

    const menuNames = pickMenus(s.menus, s.naverPlaceId);
    const menus: RequiredMenu[] = menuNames.map((name) => ({
      name: STORYBOARD ? SB.menu : name,
      price: priceForCategory(s.category, name),
    }));
    // 시드 캠페인은 지난 달에 생성된 것으로 처리 → 이번 달 monthlyTeamLimit 검증에 포함되지 않음.
    // (실 데모에서 신규 캠페인 생성 / 월 한도 기능을 테스트할 수 있도록)
    const campaign: Campaign = {
      id: detId("cp", `${s.naverPlaceId}-default`),
      storeId,
      kind: "visit",
      title: STORYBOARD ? SB.visitTitle : `${s.name} 체험단`,
      startAt: now - 1000 * 60 * 60 * 24 * 2,
      endAt: now + 1000 * 60 * 60 * 24 * 28,
      supportAmount: s.supportAmount ?? 100000,
      quota: { S: 2, A: 3, B: 5, C: 10 },
      used: { S: 0, A: 0, B: 0, C: 0 },
      requiredChannels: s.requiredChannels,
      requiredMenus: menus,
      description: STORYBOARD
        ? SB.visitDesc
        : s.description ?? `${s.area}의 ${s.name}에서 시그니처 메뉴(${menuNames.join(", ")})를 체험하고 정성스러운 후기를 남겨주세요.`,
      createdAt: now - 1000 * 60 * 60 * 24 * 35,
      useCode: detUseCode(`${s.naverPlaceId}-default`),
    };
    db.campaigns.push(campaign);
  }

  // ── 기자단 캠페인 ──
  // 1) 첫 음식점 (한남 코너 다이닝)
  const pressStore = db.stores[0];
  if (pressStore) {
    db.campaigns.push({
      id: detId("cp", `${pressStore.id}-press`),
      storeId: pressStore.id,
      kind: "press",
      title: STORYBOARD ? SB.pressTitle : `${pressStore.name} 기자단 모집`,
      startAt: now - 1000 * 60 * 60 * 24,
      endAt: now + 1000 * 60 * 60 * 24 * 21,
      supportAmount: 150000,
      quota: { S: 1, A: 2, B: 3, C: 0 },
      used: { S: 0, A: 0, B: 0, C: 0 },
      requiredChannels: ["naver_blog", "instagram"],
      requiredMenus: [],
      description: STORYBOARD
        ? SB.pressDesc
        : `${pressStore.name}의 신메뉴 출시 보도용 콘텐츠를 작성해주세요. 자료팩(제품 사진/매장 사진/브랜드 스토리)을 참고하여 자연스러운 후기 형태로 작성해주시면 됩니다.`,
      createdAt: now - 1000 * 60 * 60 * 24 * 35,
      pressKeywords: STORYBOARD ? [SB.keyword, SB.keyword, SB.keyword] : ["가을 신메뉴", "프리미엄 다이닝", "한남 맛집"],
      pressMaterials: STORYBOARD
        ? [SB.material, SB.material, SB.material, SB.material]
        : [
            "신메뉴 상세 사진 8장 (.zip)",
            "브랜드 스토리 텍스트 (2,400자)",
            "사장님 인터뷰 영상 (3분)",
            "로고/심볼 가이드 (PDF)",
          ],
      pressMinChars: 1500,
      useCode: detUseCode(`${pressStore.id}-press`),
    });
  }
  // 2) 두 번째 매장 기자단 — 스토리보드에서는 카테고리가 모두 "카테고리"이므로 인덱스로 선택
  const nailStore = STORYBOARD ? db.stores[2] : db.stores.find((s) => s.category === "네일아트");
  if (nailStore) {
    db.campaigns.push({
      id: detId("cp", `${nailStore.id}-press`),
      storeId: nailStore.id,
      kind: "press",
      title: STORYBOARD ? SB.pressTitle : `${nailStore.name} 시즌 컬렉션 기자단`,
      startAt: now - 1000 * 60 * 60 * 24 * 2,
      endAt: now + 1000 * 60 * 60 * 24 * 14,
      supportAmount: 120000,
      quota: { S: 1, A: 1, B: 2, C: 0 },
      used: { S: 0, A: 0, B: 0, C: 0 },
      requiredChannels: ["instagram", "tiktok"],
      requiredMenus: [],
      description: STORYBOARD
        ? SB.pressDesc
        : `시즌 한정 컬렉션의 화보 컷을 활용해 SNS 콘텐츠를 작성합니다. 자료팩에서 디자인 14종 고해상도 사진과 브랜드 톤매뉴얼을 받아보실 수 있습니다.`,
      createdAt: now - 1000 * 60 * 60 * 24 * 35,
      pressKeywords: STORYBOARD ? [SB.keyword, SB.keyword, SB.keyword] : ["압구정 네일", "시즌 컬렉션", "프리미엄 네일아트"],
      pressMaterials: STORYBOARD
        ? [SB.material, SB.material, SB.material]
        : [
            "디자인 14종 화보 (.zip)",
            "브랜드 톤매뉴얼 (PDF)",
            "인플루언서 게시 가이드 (1.2k자)",
          ],
      pressMinChars: 1200,
      useCode: detUseCode(`${nailStore.id}-press`),
    });
  }

  // ── 데모 체험자 ──
  const reviewer: Reviewer = {
    id: detId("rv", "demo@reviewer.com"),
    email: "demo@reviewer.com",
    passwordHash: hash("demo1234"),
    nickname: STORYBOARD ? SB.nickname : "북촌리뷰어",
    sns: [
      { kind: "naver_blog", url: "https://blog.naver.com/demo", influence: 2400 },
      { kind: "instagram", url: "https://instagram.com/demo", influence: 5800 },
    ],
    grade: "B",
    createdAt: now - 1000 * 60 * 60 * 24 * 5,
    completedReviews: 3,
    qualityScore: 88,
    noShowCount: 0,
    // 바이럴 — 이미 2명 초대해서 일반 박스 단계, 보너스 캐시 ₩4,000 누적
    inviteStats: { sent: 3, clicked: 3, accepted: 2, boxGrade: "basic", cumulativeCash: 4000 },
  };
  db.reviewers.push(reviewer);

  // 보조 체험자 (다른 등급/매장 데모) — 사장님 화면에서 다양한 reviewer 표시용
  const reviewerA: Reviewer = {
    id: detId("rv", "demo-a@reviewer.com"),
    email: "demo-a@reviewer.com",
    passwordHash: hash("demo1234"),
    nickname: STORYBOARD ? SB.nickname : "성수러버",
    sns: [{ kind: "instagram", url: "https://instagram.com/sub", influence: 12400 }],
    grade: "A",
    createdAt: now - 1000 * 60 * 60 * 24 * 30,
    completedReviews: 11,
    qualityScore: 92,
    noShowCount: 0,
  };
  db.reviewers.push(reviewerA);
  const reviewerC: Reviewer = {
    id: detId("rv", "demo-c@reviewer.com"),
    email: "demo-c@reviewer.com",
    passwordHash: hash("demo1234"),
    nickname: STORYBOARD ? SB.nickname : "신규유저",
    sns: [{ kind: "instagram", url: "https://instagram.com/newbie", influence: 320 }],
    grade: "C",
    createdAt: now - 1000 * 60 * 60 * 24 * 2,
    completedReviews: 0,
    qualityScore: 70,
    noShowCount: 0,
  };
  db.reviewers.push(reviewerC);

  // ──────────────────────────────────────────────
  // QA 데모용 패스 시드 — demo@reviewer.com 시점에서
  // 모든 PassStatus 케이스가 표시되도록 다양한 상태를 생성.
  // ──────────────────────────────────────────────
  const findCampaign = (placeId: string) => db.campaigns.find((c) => c.kind === "visit" && c.storeId === detId("st", placeId));
  const day = 1000 * 60 * 60 * 24;
  const hour = 1000 * 60 * 60;
  const REVIEW_DEADLINE = 72 * hour;

  type SeedPass = {
    key: string;
    placeId: string;
    status: Pass["status"];
    issuedOffset: number; // 과거로 얼마 전 발급 (ms)
    usedOffset?: number;
    reviewSubmittedOffset?: number;
    paid?: number;
    support?: number;
    reviewUrl?: string;
    reviewBody?: string;
    reviewChannel?: SnsKind;
    grade?: Pass["reviewerGrade"];
    reviewerId?: string;
  };

  const seedPasses: SeedPass[] = [
    // 1) ACTIVE — 사용 전 (성수 베이커리, 12h 남음)
    {
      key: "demo-active-1",
      placeId: "31906212",
      status: "active",
      issuedOffset: 12 * hour, // 12시간 전 발급 → 12시간 남음
      grade: "B",
    },
    // 2) USED — 사용 완료, 리뷰 작성 대기 (강남 스시, 30시간 전 사용)
    {
      key: "demo-used-1",
      placeId: "32126858",
      status: "used",
      issuedOffset: 36 * hour,
      usedOffset: 30 * hour, // 리뷰 마감까지 42h 남음
      paid: 180000,
      support: 150000,
      grade: "B",
    },
    // 3) REVIEW_SUBMITTED — 검수 대기 (이태원 와인바, 어제 제출)
    {
      key: "demo-rev-1",
      placeId: "1922926992",
      status: "review_submitted",
      issuedOffset: 3 * day,
      usedOffset: 2 * day,
      reviewSubmittedOffset: 18 * hour,
      paid: 92000,
      support: 92000,
      reviewUrl: "https://blog.naver.com/demo/winebar-review",
      reviewBody: "이태원 와인바에서 즐긴 평일 저녁의 짧은 호사. 하우스 와인 한 병과 시그니처 치즈 플레이트로 시작했다. 첫 잔의 향이 인상적이었고, 직원의 친절한 설명 덕분에 와인 초보도 편안하게 즐길 수 있었다...",
      reviewChannel: "naver_blog",
      grade: "B",
    },
    // 4) COMPLETED — 모든 과정 완료 (북촌 한정식, 7일 전)
    {
      key: "demo-done-1",
      placeId: "959481202",
      status: "completed",
      issuedOffset: 8 * day,
      usedOffset: 7 * day,
      reviewSubmittedOffset: 5 * day,
      paid: 110000,
      support: 100000,
      reviewUrl: "https://blog.naver.com/demo/bukchon-review",
      reviewBody: "북촌 한정식의 정갈한 코스를 즐기고 왔다. 갈비찜 정식은 양념의 깊이가 인상적이었고, 곁들임 찬도 하나하나 정성이 느껴졌다. 사진 위주로 후기를 정리했다...",
      reviewChannel: "naver_blog",
      grade: "B",
    },
    // 5) EXPIRED — 24h 경과 미사용 (홍대 분식)
    {
      key: "demo-exp-1",
      placeId: "11858321",
      status: "expired",
      issuedOffset: 3 * day, // 발급 3일 전 → 2일 전 만료
      grade: "B",
    },
    // 6) REJECTED — 리뷰 반려 (망원 비스트로)
    {
      key: "demo-rej-1",
      placeId: "1261430410",
      status: "rejected",
      issuedOffset: 10 * day,
      usedOffset: 9 * day,
      reviewSubmittedOffset: 7 * day,
      paid: 88000,
      support: 88000,
      reviewUrl: "https://blog.naver.com/demo/mangwon-review",
      reviewBody: "망원 비스트로 방문 후기. (광고 표시 문구 누락)",
      reviewChannel: "naver_blog",
      grade: "B",
    },

    // ── 사장님 화면(로그/리뷰 조회 등)용: 다른 체험자가 만든 패스도 추가 ──
    // 다른 리뷰어 (성수러버, A등급) — 성수 베이커리 완료 건
    {
      key: "demo-other-A-1",
      placeId: "31906212",
      status: "completed",
      issuedOffset: 6 * day,
      usedOffset: 5 * day,
      reviewSubmittedOffset: 3 * day,
      paid: 130000,
      support: 100000,
      reviewUrl: "https://instagram.com/p/seongsu-bakery",
      reviewBody: "성수 베이커리 카페의 평일 아침 풍경. 크루아상이 정말 결이 살아있고 시그니처 라떼와 잘 어울렸다. 인스타에 비포/애프터로 게시.",
      reviewChannel: "instagram",
      grade: "A",
      reviewerId: detId("rv", "demo-a@reviewer.com"),
    },
    // 신규 유저 C등급 — 가로수길 디저트 active
    {
      key: "demo-other-C-1",
      placeId: "1185421575",
      status: "active",
      issuedOffset: 4 * hour,
      grade: "C",
      reviewerId: detId("rv", "demo-c@reviewer.com"),
    },
    // A등급 — 강남 스시 review_submitted
    {
      key: "demo-other-A-2",
      placeId: "32126858",
      status: "review_submitted",
      issuedOffset: 2 * day,
      usedOffset: 1 * day,
      reviewSubmittedOffset: 8 * hour,
      paid: 150000,
      support: 150000,
      reviewUrl: "https://blog.naver.com/sub/omakase",
      reviewBody: "강남 스시 오마카세 12종 디너 후기. 셰프의 손길과 사케 페어링까지 모든 코스가 잘 짜여있었다...",
      reviewChannel: "naver_blog",
      grade: "A",
      reviewerId: detId("rv", "demo-a@reviewer.com"),
    },
  ];

  for (const sp of seedPasses) {
    const camp = findCampaign(sp.placeId);
    if (!camp) continue;
    const store = db.stores.find((s) => s.id === camp.storeId);
    if (!store) continue;
    const rid = sp.reviewerId || reviewer.id;
    const issuedAt = now - sp.issuedOffset;
    const pass: Pass = {
      id: detId("ps", sp.key),
      code: detPassCode(sp.key),
      reviewerId: rid,
      campaignId: camp.id,
      storeId: store.id,
      ownerId: store.ownerId,
      reviewerGrade: sp.grade || "B",
      issuedAt,
      expiresAt: issuedAt + 24 * hour,
      status: sp.status,
    };
    if (sp.usedOffset !== undefined) {
      pass.usedAt = now - sp.usedOffset;
      pass.paidAmount = sp.paid;
      pass.supportApplied = sp.support;
    }
    if (sp.reviewSubmittedOffset !== undefined) {
      pass.reviewSubmittedAt = now - sp.reviewSubmittedOffset;
      pass.reviewUrl = sp.reviewUrl;
      pass.reviewBody = sp.reviewBody;
      pass.reviewChannel = sp.reviewChannel;
      pass.reviewStatus = sp.status === "completed" ? "approved" : sp.status === "rejected" ? "rejected" : "pending";
      if (sp.status !== "rejected") {
        pass.reviewSelfCheck = { photos: true, body500: true, menus: true, days30: true };
      }
    }
    // quota 카운터 증가 (실 시나리오와 일관성)
    if (["active", "used", "review_submitted", "completed"].includes(sp.status)) {
      camp.used[pass.reviewerGrade === "N" ? "C" : pass.reviewerGrade] += 1;
    }
    db.passes.push(pass);
  }

  // ── 기자단 데모 패스 — 모든 상태 커버 ──
  const pressCampaigns = db.campaigns.filter((c) => c.kind === "press");
  if (pressCampaigns.length > 0) {
    // 1) 한남 기자단 active (자료 수령 후 작성 중)
    const p1 = pressCampaigns[0];
    if (p1) {
      const ps: Pass = {
        id: detId("ps", "demo-press-active"),
        code: detPassCode("demo-press-active"),
        reviewerId: reviewer.id,
        campaignId: p1.id,
        storeId: p1.storeId,
        ownerId: db.stores.find((s) => s.id === p1.storeId)!.ownerId,
        reviewerGrade: "B",
        issuedAt: now - 2 * day,
        expiresAt: now + 19 * day, // 기자단은 캠페인 종료까지 사용 가능
        status: "active",
      };
      p1.used.B += 1;
      db.passes.push(ps);
    }
    // 2) 네일 기자단 review_submitted (작성 후 검수 대기)
    const p2 = pressCampaigns[1];
    if (p2) {
      const ps: Pass = {
        id: detId("ps", "demo-press-submitted"),
        code: detPassCode("demo-press-submitted"),
        reviewerId: reviewer.id,
        campaignId: p2.id,
        storeId: p2.storeId,
        ownerId: db.stores.find((s) => s.id === p2.storeId)!.ownerId,
        reviewerGrade: "B",
        issuedAt: now - 5 * day,
        expiresAt: now + 9 * day,
        status: "review_submitted",
        reviewUrl: "https://www.instagram.com/p/demo-nail-press",
        reviewBody: "압구정 네일 아틀리에의 시즌 한정 컬렉션을 미리 만나봤다. 시즌 컬렉션의 14종 디자인 중 가장 시즌감을 잘 표현한 두 디자인을 골랐다. 압구정 네일이 보여줄 수 있는 디테일의 깊이가 정말 매력적이었다...".padEnd(1300, "·"),
        reviewChannel: "instagram",
        reviewSubmittedAt: now - 12 * hour,
        reviewStatus: "pending",
      };
      p2.used.B += 1;
      db.passes.push(ps);
    }
    // 3) 한남 기자단 completed (다른 reviewer A로) — 정산 완료
    if (p1) {
      const ps: Pass = {
        id: detId("ps", "demo-press-completed"),
        code: detPassCode("demo-press-completed"),
        reviewerId: reviewerA.id,
        campaignId: p1.id,
        storeId: p1.storeId,
        ownerId: db.stores.find((s) => s.id === p1.storeId)!.ownerId,
        reviewerGrade: "A",
        issuedAt: now - 12 * day,
        expiresAt: now + 9 * day,
        status: "completed",
        reviewUrl: "https://blog.naver.com/sub/hannam-press",
        reviewBody: "한남 코너 다이닝의 가을 신메뉴 5종을 미리 즐겨봤다. 자료팩에서 제공한 사진과 브랜드 스토리를 참고해 자연스러운 후기로 풀어냈고, 트러플과 가을 채소가 어우러진 메인 코스가 특히 인상적이었다...".padEnd(1600, "·"),
        reviewChannel: "naver_blog",
        reviewSubmittedAt: now - 9 * day,
        reviewStatus: "approved",
      };
      p1.used.A += 1;
      db.passes.push(ps);
    }
  }

  // 데모 사장님 알림 몇 건
  db.notifications.push({
    id: detId("nt", "seed-1"),
    userId: owner.id,
    role: "owner",
    title: "신규 리뷰 등록",
    body: "체험자가 리뷰를 등록했습니다.",
    createdAt: now - 12 * hour,
    read: false,
    link: "/o/reviews",
  });
  db.notifications.push({
    id: detId("nt", "seed-2"),
    userId: reviewer.id,
    role: "reviewer",
    title: "체험권 발급",
    body: "성수 베이커리 카페 체험권이 발급되었습니다.",
    createdAt: now - 12 * hour,
    read: false,
    link: "/r/passes",
  });

  // ── 바이럴(레퍼럴) 시드 ──
  // 라이브 카운터 초기값 (혜택 탭 상단 N명 카운터 + ticker)
  db.viralCounter = {
    date: new Date(now).toISOString().slice(0, 10),
    todayBoxCount: 1283,
    todayAvgReward: 4250,
    liveStream: [
      { nickname: STORYBOARD ? SB.nickname : "강남 박OO", reward: 8000, ts: now - 4_000, matrix: "RR" },
      { nickname: STORYBOARD ? SB.nickname : "성수 김OO", reward: 3000, ts: now - 9_000, matrix: "RR" },
      { nickname: STORYBOARD ? SB.nickname : "압구정 정OO 사장님", reward: 10000, ts: now - 16_000, matrix: "OO" },
      { nickname: STORYBOARD ? SB.nickname : "한남 이OO", reward: 5500, ts: now - 28_000, matrix: "OR" },
    ],
  };

  // 데모 invite — 북촌리뷰어가 이미 발송한 토큰들
  db.invites = [
    {
      token: "DEMO2024",
      referrerId: reviewer.id,
      referrerKind: "reviewer",
      targetKind: "reviewer",
      channel: "kakao",
      status: "signed_up",
      createdAt: now - 3 * day,
      expiresAt: now + 11 * day,
      consumedAt: now - 2 * day,
      consumedBy: reviewerA.id,
    },
    {
      token: "WAITROOM",
      referrerId: reviewer.id,
      referrerKind: "reviewer",
      targetKind: "reviewer",
      channel: "sms",
      status: "clicked",
      createdAt: now - 1 * day,
      expiresAt: now + 13 * day,
    },
    {
      token: "TRYTODAY",
      referrerId: reviewer.id,
      referrerKind: "reviewer",
      targetKind: "owner",
      channel: "copy_link",
      status: "issued",
      createdAt: now - 6 * hour,
      expiresAt: now + 14 * day - 6 * hour,
    },
  ];

  // 데모 보상 — 북촌리뷰어가 행운 박스 2번 오픈
  db.rewards = [
    {
      id: detId("rwd", "seed-1"),
      ownerUserId: reviewer.id,
      source: "referrer_box",
      kind: "cash",
      value: 2000,
      issuedAt: now - 2 * day,
      expiresAt: now + 28 * day,
      meta: { matrix: "RR", accepted: 1 },
    },
    {
      id: detId("rwd", "seed-2"),
      ownerUserId: reviewer.id,
      source: "referrer_box",
      kind: "cash",
      value: 2000,
      issuedAt: now - 36 * hour,
      expiresAt: now + 28 * day,
      meta: { matrix: "RR", accepted: 2 },
    },
  ];
}
