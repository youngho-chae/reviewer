import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { AdminUser, Campaign, DBShape, Owner, Pass, RequiredMenu, ReservationEvent, Reviewer, SnsKind, Store } from "./types";
import { channelGradesFromSns, bestGrade } from "./grade";
import { kstMonthKey, kstMonthStart, prevMonthKey } from "./grade-regrade";
import { selfCheckConditions, defaultChannel } from "./channels";
import { REGIONS } from "./regions";
import { regionCenter } from "./geo";
import { STORYBOARD } from "./storyboard";
import { DELIVERY_ENABLED } from "./flags";
import { kstTodayStr, reservationDayEnd } from "./reservation";

// ─────────────────────────────────────────────────────────────
// [스토리보드 모드] design/storyboard-schema 브랜치 전용.
// 시드의 모든 표시용 문자열 데이터를 한글 스키마 라벨로 치환하여,
// 디자인 파트가 "어떤 위치에 어떤 데이터가 들어가는지"를 스토리보드로 확인할 수 있게 함.
// 실데이터 원복은 backup/real-mockdata 브랜치 참조.
// ─────────────────────────────────────────────────────────────
const SB = {
  storeName: "매장명",
  category: "카테고리",
  area: "지역",
  hours: "영업시간",
  address: "주소",
  visitTitle: "캠페인명",
  visitDesc: "캠페인설명",
  menu: "메뉴명",
  nickname: "닉네임",
  ownerStore: "매장명",
  keyword: "키워드",
  reserveNote: "예약안내",
  productOption: "옵션명",
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

// 시드/데모 캠페인 4자리 사용처리 코드 — 테스트 기준으로 전 캠페인 "1234" 통일 (2026-07-10).
// 동일 코드가 사장님의 여러 캠페인에 걸리므로, 4자리 lookup은 '가장 최근 발급분(active 우선)'
// 규칙으로 동작한다 (/api/passes/lookup — 단일 데모 사장님 구조에서 안전).
const DEMO_USE_CODE = "1234";

// 결정적 정수 (0 ≤ n < mod) — 전 지역 시드의 업종/지터/기간 분산용
function detNum(seed: string, mod: number): number {
  return crypto.createHash("sha256").update(seed).digest().readUInt32BE(0) % mod;
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
    // 블로그·인스타·틱톡 3채널 모두 모집하는 케이스 (2026-07-08 — 채널 조합 QA/데모)
    requiredChannels: ["naver_blog", "instagram", "tiktok"],
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
    requiredChannels: ["instagram", "naver_blog"],
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
    // 틱톡 "단독" 모집 매장 — 틱톡 미연동 계정(demo@reviewer.com: 블A·인C)이
    // 상세에서 [연동 필요]·확인불가 + CTA "SNS 연동 필요" 예외 케이스를 보게 하는 시드 (2026-07-08)
    naverPlaceId: "9990001234",
    name: "홍대 탕후루 팝업",
    category: "디저트",
    area: "홍대",
    coverEmoji: "🍡",
    address: "서울 마포구 홍익로 20",
    lat: 37.5552, lng: 126.9226,
    rating: 4.6, reviewCount: 154,
    menus: ["과일 탕후루 세트", "흑임자 아이스크림", "수제 젤리 박스"],
    requiredChannels: ["tiktok"],
    supportAmount: 40000,
    description: "숏폼 전용 체험 — 틱톡 채널에 15초 이상 영상 후기를 게시해주세요.",
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
    // 사업자 인증 (확정 정책 9) — 데모 계정은 인증 완료 상태로 시드 (기존 데모 무중단)
    bizNumber: "1234567890",
    bizStatus: "verified",
    bizVerifiedAt: now - 1000 * 60 * 60 * 24 * 6,
  };
  db.owners.push(owner);

  // 운영팀(검수) 계정 — /admin 백오피스 로그인용
  const admin: AdminUser = {
    id: detId("ad", "admin@catchrank.co.kr"),
    email: "admin@catchrank.co.kr",
    passwordHash: hash("demo1234"),
    name: "운영팀",
  };
  db.admins = [admin];

  for (let idx = 0; idx < SEED_STORES.length; idx++) {
    const s = SEED_STORES[idx];
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
    // 홈 큐레이션 타일(최근 등록 / 곧 마감 / 파격 지원금)이 의미있게 보이도록 날짜 스프레드.
    //  - idx 0~1: 최근 등록 (며칠 전 생성, 이번 달)  → "최근에 등록됨" 카운트
    //  - idx 2~4: 곧 마감 (며칠 후 종료)             → "곧 마감돼요" 카운트
    //  - 그 외:   지난 달 생성 + 28일 후 종료 (월 한도 검증에 미포함)
    const isRecent = idx <= 1;
    const isClosing = idx >= 2 && idx <= 4;
    const createdAt = isRecent
      ? now - 1000 * 60 * 60 * 24 * (idx + 2) // 2~3일 전
      : now - 1000 * 60 * 60 * 24 * 35;
    const endAt = isClosing
      ? now + 1000 * 60 * 60 * 24 * (idx) // 2~4일 후 (곧 마감)
      : now + 1000 * 60 * 60 * 24 * 28;
    const campaign: Campaign = {
      id: detId("cp", `${s.naverPlaceId}-default`),
      storeId,
      kind: "visit",
      title: STORYBOARD ? SB.visitTitle : `${s.name} 체험단`,
      startAt: now - 1000 * 60 * 60 * 24 * 2,
      endAt,
      supportAmount: s.supportAmount ?? 100000,
      quota: { S: 2, A: 3, B: 5, C: 10 },
      used: { S: 0, A: 0, B: 0, C: 0 },
      requiredChannels: s.requiredChannels,
      requiredMenus: menus,
      description: STORYBOARD
        ? SB.visitDesc
        : s.description ?? `${s.area}의 ${s.name}에서 시그니처 메뉴(${menuNames.join(", ")})를 체험하고 정성스러운 후기를 남겨주세요.`,
      highlightKeywords: STORYBOARD
        ? [SB.keyword, SB.keyword]
        : ([`${s.area} ${s.category}`, menuNames[0]].filter(Boolean) as string[]),
      createdAt,
      useCode: DEMO_USE_CODE,
      // 예약형 (2026-07-22 §2 — 운영 스케줄 포함) — 미용·의료·웰니스 등 예약 기반 업종.
      // 화~일 오전 11시~오후 8시 · 브레이크 오후 3~4시 · 같은 시간 2팀 (12시간제 표기 §7-2).
      // 피부과는 예약 가능 시작일(D+3) 데모 — 캘린더에서 앞 3일만 비활성 (신청은 즉시 가능 — 2026-07-23 정정).
      ...(["미용실", "네일아트", "피부과", "치과", "한의원", "PT", "필라테스", "마사지", "애견미용", "동물병원"].includes(
        s.category,
      )
        ? {
            reservationRequired: true,
            reservationNote: STORYBOARD ? SB.reserveNote : "주차는 매장 안내를 따라주세요",
            reservationSchedule: {
              days: [0, 2, 3, 4, 5, 6], // 월요일 휴무
              open: "11:00",
              close: "20:00",
              breakStart: "15:00",
              breakEnd: "16:00",
              slotCapacity: 2,
              ...(s.category === "피부과" ? { opensAt: now + 3 * 24 * 60 * 60 * 1000 } : {}),
            },
          }
        : {}),
    };
    db.campaigns.push(campaign);
  }

  // ── 데모 체험자 ──
  // 채널별 등급 데모: 블로그 A(영향력 큼) / 인스타 C(작음) → 표기 등급 A(최고 채널)
  const demoSns = [
    { kind: "naver_blog" as SnsKind, url: "https://blog.naver.com/demo", influence: 60000 },
    { kind: "instagram" as SnsKind, url: "https://instagram.com/demo", influence: 5800 },
  ];
  const demoChannelGrades = channelGradesFromSns(demoSns);
  const reviewer: Reviewer = {
    id: detId("rv", "demo@reviewer.com"),
    email: "demo@reviewer.com",
    passwordHash: hash("demo1234"),
    // 휴대폰 = 체험자 PK (2026-07-23 — 가입 인증 도입, 데모 계정은 인증 완료 상태로 시드)
    phone: "01011112222",
    phoneVerifiedAt: now - 1000 * 60 * 60 * 24 * 45,
    nickname: STORYBOARD ? SB.nickname : "북촌리뷰어",
    sns: demoSns,
    channelGrades: demoChannelGrades,
    grade: bestGrade(Object.values(demoChannelGrades)),
    // 직전 월 활동 시드가 재평가 대상이 되도록 평가월 이전 가입으로 설정
    createdAt: now - 1000 * 60 * 60 * 24 * 45,
    completedReviews: 6, // 지난달 완료 3건 포함 누적
    qualityScore: 88,
    noShowCount: 1, // 지난달 리뷰 기한 초과 1건 (스윕이 집계했을 값과 일치)
    // 바이럴 — 이미 2명 초대해서 일반 박스 단계
    inviteStats: { sent: 3, clicked: 3, accepted: 2, boxGrade: "basic" },
    // 상생 리뷰어 지정 (2026-08-07) — 직전 평가월 충족으로 시드해 유예 로직상 유지 상태.
    // 닉네임 옆 하트 악수 뱃지(WinWinBadge) 데모용 — 표시 전용 (P1 무영향)
    winWinBadge: { since: now - 1000 * 60 * 60 * 24 * 35, lastQualifiedMonth: prevMonthKey(kstMonthKey(now)) },
  };
  db.reviewers.push(reviewer);

  // 보조 체험자 (다른 등급/매장 데모) — 사장님 화면에서 다양한 reviewer 표시용
  // 영향력 450k = 지수점수 A밴드 상단 → 지난달 고성과와 합쳐 GS≥90 S 후보 데모 (S 자동 부여 없음)
  const reviewerASns = [{ kind: "instagram" as SnsKind, url: "https://instagram.com/sub", influence: 450000 }];
  const reviewerAGrades = channelGradesFromSns(reviewerASns);
  const reviewerA: Reviewer = {
    id: detId("rv", "demo-a@reviewer.com"),
    email: "demo-a@reviewer.com",
    passwordHash: hash("demo1234"),
    phone: "01022223333",
    phoneVerifiedAt: now - 1000 * 60 * 60 * 24 * 60,
    nickname: STORYBOARD ? SB.nickname : "성수러버",
    sns: reviewerASns,
    channelGrades: reviewerAGrades,
    grade: bestGrade(Object.values(reviewerAGrades)),
    createdAt: now - 1000 * 60 * 60 * 24 * 60,
    completedReviews: 16, // 지난달 완료 5건 포함 누적
    qualityScore: 92,
    noShowCount: 0,
  };
  db.reviewers.push(reviewerA);
  const reviewerCSns = [{ kind: "instagram" as SnsKind, url: "https://instagram.com/newbie", influence: 1200 }];
  const reviewerCGrades = channelGradesFromSns(reviewerCSns);
  const reviewerC: Reviewer = {
    id: detId("rv", "demo-c@reviewer.com"),
    email: "demo-c@reviewer.com",
    passwordHash: hash("demo1234"),
    phone: "01033334444",
    phoneVerifiedAt: now - 1000 * 60 * 60 * 24 * 40,
    nickname: STORYBOARD ? SB.nickname : "신규유저",
    sns: reviewerCSns,
    channelGrades: reviewerCGrades,
    grade: bestGrade(Object.values(reviewerCGrades)),
    createdAt: now - 1000 * 60 * 60 * 24 * 40,
    completedReviews: 1, // 지난달 완료 1건 (표본 부족 재평가 데모)
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
    rejectedOffset?: number; // 반려 시각 (기본 6일 전) — 재제출 기한(반려+7일) 케이스 분기용
    overdueHandled?: boolean; // 리뷰 기한 초과 기처리 — 스윕 재처리(알림·noShowCount 중복) 방지
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
    // 6) REJECTED — 리뷰 반려 (망원 비스트로). 반려 후 72h 경과 → 재제출 기한 지남 케이스
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
    // 7) USED + 리뷰 기한 초과 — 파생 표시 상태 "제출 기한 초과" (이용 후 7일 경과·미제출)
    {
      key: "demo-overdue-1",
      placeId: "1067489343",
      status: "used",
      issuedOffset: 9 * day,
      usedOffset: 8 * day + 12 * hour, // 마감(이용 후 7일)이 1.5일 전에 지남
      paid: 76000,
      support: 60000,
      grade: "B",
      overdueHandled: true,
    },
    // 8) REJECTED + 재제출 기한 초과 — 파생 표시 상태 "재제출 기한 초과" (반려 후 7일 경과)
    {
      key: "demo-rej-2",
      placeId: "demo-beauty-001",
      status: "rejected",
      issuedOffset: 20 * day,
      usedOffset: 19 * day + 12 * hour,
      reviewSubmittedOffset: 17 * day + 12 * hour,
      rejectedOffset: 16 * day, // 재제출 기한(반려 후 7일)이 9일 전에 지남
      paid: 55000,
      support: 55000,
      reviewUrl: "https://instagram.com/p/demo-beauty-rejected",
      reviewBody: "청담 헤어 살롱 방문 후기. (피드 사진 수 미달)",
      reviewChannel: "instagram",
      grade: "B",
    },
    // 9) USED, 리뷰 마감 24h 이내 — 첫 스윕에서 '리뷰 마감 24시간 전 ⏰' 알림이 발화하는 데모
    {
      key: "demo-due-soon-1",
      placeId: "demo-fit-001",
      status: "used",
      issuedOffset: 7 * day,
      usedOffset: 6 * day + 6 * hour, // 리뷰 마감까지 약 18시간
      paid: 70000,
      support: 60000,
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
    // 참여 채널 — 시드 지정값 또는 캠페인 우선순위 채널
    const passChannel: SnsKind = sp.reviewChannel ?? defaultChannel(camp.requiredChannels) ?? "naver_blog";
    const pass: Pass = {
      id: detId("ps", sp.key),
      code: detPassCode(sp.key),
      reviewerId: rid,
      campaignId: camp.id,
      storeId: store.id,
      ownerId: store.ownerId,
      reviewerGrade: sp.grade || "B",
      reviewChannel: passChannel,
      issuedAt,
      expiresAt: issuedAt + 24 * hour,
      status: sp.status,
    };
    if (sp.usedOffset !== undefined) {
      pass.usedAt = now - sp.usedOffset;
      pass.paidAmount = sp.paid;
      pass.supportApplied = sp.support;
    }
    if (sp.overdueHandled) pass.overdueHandled = true;
    if (sp.reviewSubmittedOffset !== undefined) {
      pass.reviewSubmittedAt = now - sp.reviewSubmittedOffset;
      pass.reviewUrl = sp.reviewUrl;
      pass.reviewBody = sp.reviewBody;
      pass.reviewStatus = sp.status === "completed" ? "approved" : sp.status === "rejected" ? "rejected" : "pending";
      pass.adNoticeConfirmed = true; // 제출 시 서버가 강제하는 광고 표기 확인
      if (sp.status !== "rejected") {
        // 채널별 자가점검 항목(유지 의무 keep 제외) 전부 충족 + 유지 동의로 시드
        pass.reviewSelfCheck = Object.fromEntries(
          selfCheckConditions(passChannel).map((c) => [c.key, true]),
        );
        pass.keepAgreed = true;
      } else {
        // 반려 사유 구조화 보존 — 상세 화면 노출 + 재제출 판단 근거
        pass.rejectReason =
          sp.key === "demo-rej-2"
            ? "피드 사진 수 미달 — 작성 조건(피드 사진/영상 3장 이상)이 확인되지 않습니다"
            : "광고 표시 문구 누락 — 본문에 경제적 대가 문구가 확인되지 않습니다";
        pass.rejectedAt = now - (sp.rejectedOffset ?? 6 * day);
      }
    }
    // quota 카운터 증가 (실 시나리오와 일관성) — 만료/취소만 슬롯 복구 대상이므로 그 외 상태는 소진 유지
    if (["active", "used", "review_submitted", "completed", "rejected"].includes(sp.status)) {
      const slot = pass.reviewerGrade === "N" ? "C" : (pass.reviewerGrade as "S" | "A" | "B" | "C");
      camp.used[slot] += 1;
      pass.consumedSlot = slot;
    }
    db.passes.push(pass);
  }

  // 7) CANCELLED — 사용 전 직접 취소 (삼청동 브런치). demo@reviewer.com 시점.
  //    취소 시 슬롯은 이미 복구되므로 camp.used를 증가시키지 않는다 (net-zero).
  //    PRD §7.8 — 데모 패스가 7개 PassStatus를 모두 커버하도록 보강.
  const cancelledCamp = findCampaign("2012466103");
  if (cancelledCamp) {
    const cancelledStore = db.stores.find((s) => s.id === cancelledCamp.storeId);
    if (cancelledStore) {
      const issuedAt = now - 2 * day;
      const cancelledPass: Pass = {
        id: detId("ps", "demo-cancelled-1"),
        code: detPassCode("demo-cancelled-1"),
        reviewerId: reviewer.id,
        campaignId: cancelledCamp.id,
        storeId: cancelledStore.id,
        ownerId: cancelledStore.ownerId,
        reviewerGrade: "B",
        consumedSlot: "B", // 취소 시 이미 복구됨 → camp.used는 증가시키지 않음
        issuedAt,
        expiresAt: issuedAt + 24 * hour,
        cancelledAt: now - 40 * hour, // 발급 후 몇 시간 뒤 취소
        status: "cancelled",
      };
      db.passes.push(cancelledPass);
    }
  }

  // ── 멤버십 플랜 다양화 시드 (2026-07-10 추천순) ──
  // 추천순 = 사장님 플랜 랭크(Premium>Standard>Basic>Free) → 캠페인 최신순 검증용.
  // Free 캠페인이 가장 최신이어도 Premium 캠페인이 상단에, 체험권 일시 소진(issued_out)
  // 캠페인은 최후순위로 밀리는지 확인한다. 기존 demo@store.com(Standard) 매장은 이관하지 않는다.
  const planSeedOwners: Array<{
    email: string;
    plan: Owner["plan"];
    bizNumber: string;
    stores: Array<{
      placeId: string; name: string; category: string; area: string; coverEmoji: string;
      address: string; lat: number; lng: number; menus: string[];
      campaignCreatedAgo: number; support: number; issuedOut?: boolean;
    }>;
  }> = [
    {
      email: "demo2@store.com",
      plan: "Premium",
      bizNumber: "2345678901",
      stores: [
        {
          placeId: "demo-plan-p1", name: "연남 파스타 바", category: "양식", area: "연남동",
          coverEmoji: "🍝", address: "서울 마포구 동교로 246", lat: 37.5606, lng: 126.9256,
          menus: ["봉골레 파스타", "부라타 샐러드"], campaignCreatedAgo: 1 * day, support: 90000,
        },
        {
          placeId: "demo-plan-p2", name: "연남 브런치 룸", category: "카페", area: "연남동",
          coverEmoji: "🥞", address: "서울 마포구 성미산로 190", lat: 37.5626, lng: 126.9238,
          menus: ["리코타 팬케이크", "브런치 플레이트"], campaignCreatedAgo: 2 * day, support: 70000,
          issuedOut: true, // 잔여 0 + 살아있는 체험권 → issued_out (노출 유지·발급 불가·추천순 최후)
        },
      ],
    },
    {
      email: "demo3@store.com",
      plan: "Free",
      bizNumber: "3456789012",
      stores: [
        {
          placeId: "demo-plan-f1", name: "왕십리 곱창집", category: "한식", area: "왕십리",
          coverEmoji: "🥘", address: "서울 성동구 왕십리로 315", lat: 37.5614, lng: 127.0374,
          menus: ["모둠 곱창", "곱창 볶음밥"], campaignCreatedAgo: 6 * hour, support: 60000, // 가장 최신 생성
        },
      ],
    },
  ];
  for (const po of planSeedOwners) {
    const planOwner: Owner = {
      id: detId("ow", po.email),
      email: po.email,
      passwordHash: hash("demo1234"),
      storeName: STORYBOARD ? SB.ownerStore : po.stores[0].name,
      category: STORYBOARD ? SB.category : po.stores[0].category,
      area: STORYBOARD ? SB.area : "서울",
      plan: po.plan,
      createdAt: now - 20 * day,
      bizNumber: po.bizNumber,
      bizStatus: "verified",
      bizVerifiedAt: now - 19 * day,
    };
    db.owners.push(planOwner);
    for (const st of po.stores) {
      const stId = detId("st", st.placeId);
      db.stores.push({
        id: stId,
        ownerId: planOwner.id,
        name: STORYBOARD ? SB.storeName : st.name,
        category: STORYBOARD ? SB.category : st.category,
        area: STORYBOARD ? SB.area : st.area,
        coverEmoji: st.coverEmoji,
        rating: 4.6,
        reviewCount: 128,
        hours: STORYBOARD ? SB.hours : "11:30 - 21:30",
        lat: st.lat,
        lng: st.lng,
        address: STORYBOARD ? SB.address : st.address,
        naverPlaceId: st.placeId,
      });
      const planCamp: Campaign = {
        id: detId("cp", `${st.placeId}-default`),
        storeId: stId,
        kind: "visit",
        title: STORYBOARD ? SB.visitTitle : `${st.name} 체험단`,
        startAt: now - st.campaignCreatedAgo,
        endAt: now + 21 * day,
        supportAmount: st.support,
        quota: st.issuedOut ? { S: 0, A: 0, B: 1, C: 0 } : { S: 1, A: 1, B: 2, C: 2 },
        used: st.issuedOut ? { S: 0, A: 0, B: 1, C: 0 } : { S: 0, A: 0, B: 0, C: 0 },
        requiredChannels: ["naver_blog", "instagram"],
        requiredMenus: st.menus.map((m) => ({ name: STORYBOARD ? SB.menu : m, price: 25000 })),
        description: STORYBOARD
          ? SB.visitDesc
          : `${st.area}의 ${st.name}에서 시그니처 메뉴(${st.menus.join(", ")})를 체험하고 후기를 남겨주세요.`,
        highlightKeywords: STORYBOARD ? [SB.keyword] : [`${st.area} ${st.category}`],
        createdAt: now - st.campaignCreatedAgo,
        useCode: DEMO_USE_CODE,
      };
      db.campaigns.push(planCamp);
      if (st.issuedOut) {
        // 잔여 0이지만 살아있는(active·미만료) 체험권 존재 → campaignExposure = "issued_out"
        const liveIssuedAt = now - 8 * hour;
        db.passes.push({
          id: detId("ps", `${st.placeId}-live`),
          code: detPassCode(`${st.placeId}-live`),
          reviewerId: reviewerA.id,
          campaignId: planCamp.id,
          storeId: stId,
          ownerId: planOwner.id,
          reviewerGrade: "A",
          consumedSlot: "B",
          issuedAt: liveIssuedAt,
          expiresAt: liveIssuedAt + 72 * hour,
          status: "active",
        });
      }
    }
  }

  // ── 전 지역 시드 (2026-07-10) — 1차(시도)·2차(시군구) 카테고리 전 지역 커버 ──
  // REGIONS(시도 17 × 시군구 전체)마다 매장 1곳 + 방문형 캠페인 1건을 시군구 기준 좌표
  // (geo.ts GUGUN_CENTERS — regionCenter 복합 키 "{시도} {시군구}"와 동일 지점) 인근에 배치한다.
  // → 어떤 지역을 선택해도 '반경 3km' 결과·전국 시도 클러스터 건수가 좌표 정합으로 보장된다.
  // 전국 매장은 별도 사장님(demo4, Basic) 소유 — 기존 demo@store.com 사장님 화면 데모를 훼손하지 않는다.
  const regionOwner: Owner = {
    id: detId("ow", "demo4@store.com"),
    email: "demo4@store.com",
    passwordHash: hash("demo1234"),
    storeName: STORYBOARD ? SB.ownerStore : "캐치패스 전국 데모 매장군",
    category: STORYBOARD ? SB.category : "카페",
    area: STORYBOARD ? SB.area : "전국",
    plan: "Basic",
    createdAt: now - 30 * day,
    bizNumber: "4567890123",
    bizStatus: "verified",
    bizVerifiedAt: now - 29 * day,
  };
  db.owners.push(regionOwner);

  // 업종 로테이션 — 카테고리 필터 그룹(카페/식당/뷰티/헬스)이 전국 어느 지역에서도 동작하도록 분산
  const REGION_SHOP_KINDS: Array<{
    category: string;
    name: (g: string) => string;
    emoji: string;
    menus: string[];
    support: number;
    channels: SnsKind[];
    reserve?: boolean; // 방문 전 예약 필수 (예약형 라이트, 2026-07-12) — 미용·웰니스 업종
  }> = [
    { category: "카페", name: (g) => `${g} 로스터리`, emoji: "☕", menus: ["시그니처 라떼", "크루아상 세트"], support: 40000, channels: ["naver_blog", "instagram"] },
    { category: "한식", name: (g) => `${g} 밥상`, emoji: "🍚", menus: ["제철 정식", "모둠 전"], support: 80000, channels: ["naver_blog"] },
    { category: "양식", name: (g) => `${g} 키친`, emoji: "🍝", menus: ["시그니처 파스타", "화덕 피자"], support: 90000, channels: ["naver_blog", "instagram"] },
    { category: "디저트", name: (g) => `${g} 베이크`, emoji: "🍰", menus: ["시즌 케이크", "휘낭시에"], support: 40000, channels: ["instagram", "tiktok"] },
    { category: "일식", name: (g) => `${g} 스시야`, emoji: "🍣", menus: ["초밥 12P", "사케동"], support: 100000, channels: ["naver_blog", "instagram"] },
    { category: "미용실", name: (g) => `${g} 헤어 라운지`, emoji: "💇", menus: ["컷+두피 클리닉", "전체 염색"], support: 70000, channels: ["instagram"], reserve: true },
    { category: "필라테스", name: (g) => `${g} 필라테스 랩`, emoji: "🧘", menus: ["1:1 체험 클래스", "그룹 클래스 4회"], support: 55000, channels: ["naver_blog", "instagram", "tiktok"], reserve: true },
    { category: "마사지", name: (g) => `${g} 테라피 스파`, emoji: "💆", menus: ["아로마 전신 60분", "등·어깨 집중 관리"], support: 70000, channels: ["naver_blog", "instagram"], reserve: true },
  ];

  for (const region of REGIONS) {
    for (const g of region.gugun) {
      const key = `region-${region.sido}-${g}`;
      const center = regionCenter(`${region.sido} ${g}`);
      if (!center) continue;
      const shop = REGION_SHOP_KINDS[detNum(`${key}:kind`, REGION_SHOP_KINDS.length)];
      // 기준점 인근 결정적 지터(±약 0.7km) — 반경 3km 내 보장 + 지도 핀 겹침 방지
      const jitter = (salt: string) => (detNum(`${key}:${salt}`, 1300) - 650) / 100000;
      const stId = detId("st", key);
      db.stores.push({
        id: stId,
        ownerId: regionOwner.id,
        name: STORYBOARD ? SB.storeName : shop.name(g),
        category: STORYBOARD ? SB.category : shop.category,
        area: STORYBOARD ? SB.area : g,
        coverEmoji: shop.emoji,
        rating: Math.round((4.2 + detNum(`${key}:rating`, 7) / 10) * 10) / 10,
        reviewCount: 40 + detNum(`${key}:rc`, 260),
        hours: STORYBOARD ? SB.hours : "11:00 - 21:00",
        lat: center.lat + jitter("lat"),
        lng: center.lng + jitter("lng"),
        address: STORYBOARD ? SB.address : `${region.sido} ${g} 중앙로 ${1 + detNum(`${key}:addr`, 120)}`,
        naverPlaceId: key,
      });
      const regionCreatedAt = now - (12 + detNum(`${key}:created`, 22)) * day;
      db.campaigns.push({
        id: detId("cp", `${key}-default`),
        storeId: stId,
        kind: "visit",
        title: STORYBOARD ? SB.visitTitle : `${shop.name(g)} 체험단`,
        startAt: regionCreatedAt,
        endAt: now + (7 + detNum(`${key}:end`, 21)) * day,
        supportAmount: shop.support,
        quota: { S: 0, A: 1, B: 1, C: 1 },
        used: { S: 0, A: 0, B: 0, C: 0 },
        requiredChannels: shop.channels,
        requiredMenus: shop.menus.map((m) => ({
          name: STORYBOARD ? SB.menu : m,
          price: priceForCategory(shop.category, `${key}:${m}`),
        })),
        description: STORYBOARD
          ? SB.visitDesc
          : `${region.sido} ${g}의 ${shop.name(g)}에서 ${shop.menus[0]}를 체험하고 후기를 남겨주세요.`,
        highlightKeywords: STORYBOARD ? [SB.keyword] : [`${g} ${shop.category}`, shop.menus[0]],
        createdAt: regionCreatedAt,
        useCode: DEMO_USE_CODE,
        // 예약형 (2026-07-22 §2 — 운영 스케줄 포함: 화~일 오전 11시~오후 8시 · 월요일 휴무)
        ...(shop.reserve
          ? {
              reservationRequired: true,
              reservationNote: STORYBOARD ? SB.reserveNote : "주차는 매장 안내를 따라주세요",
              reservationSchedule: { days: [0, 2, 3, 4, 5, 6], open: "11:00", close: "20:00", slotCapacity: 2 },
            }
          : {}),
      });
    }
  }

  // ── 배송형 + 포인트 시드 (2026-07-12 레뷰 벤치마크 — docs/벤치마크-레뷰.md) ──
  // 배송형 캠페인 3건(demo@store.com 소유 — 사장님 홈 발송 대기 큐 데모)과
  // 데모 체험자의 배송 패스(발송 대기/발송 완료/검수 완료) + 포인트 원장/출금 내역.
  // DELIVERY_ENABLED=false(main 릴리스)면 배송형 일체(매장·캠페인·패스·포인트·출금) 미시드.
  if (DELIVERY_ENABLED) {
    // category = **상품 카테고리** (2026-07-12 정정 — delivery-categories.ts 목록값).
    // 배송형은 매장이 아닌 스토어의 상품이 대상이라 플레이스 분류(카페·디저트 등)를 쓰지 않는다.
    const dvBrands: Array<{
      key: string;
      name: string;
      category: string;
      emoji: string;
      product: string;
      productValue: number;
      pointReward: number; // 0 = 제품만
      channels: SnsKind[];
      options?: string[]; // 상품 옵션 (2026-07-16 리뷰노트 벤치마크 — 신청 시 택1)
    }> = [
      { key: "dv-bakes", name: "카라멜 베이크 하우스", category: "식품", emoji: "🍪", product: "수제 쿠키 선물 세트", productValue: 32000, pointReward: 10000, channels: ["naver_blog", "instagram"] },
      { key: "dv-beans", name: "미드나잇 로스터스", category: "식품", emoji: "☕", product: "스페셜티 원두 2종 세트", productValue: 28000, pointReward: 5000, channels: ["tiktok"] },
      { key: "dv-meal", name: "한상 밀키트", category: "식품", emoji: "🍲", product: "갈비찜 밀키트 2인분", productValue: 39000, pointReward: 0, channels: ["instagram"] },
      { key: "dv-serum", name: "글로우랩 코스메틱", category: "뷰티", emoji: "🧴", product: "비타민 세럼 30ml", productValue: 42000, pointReward: 8000, channels: ["instagram", "tiktok"], options: ["비타민C 세럼", "레티놀 세럼"] },
      { key: "dv-diffuser", name: "온음 리빙", category: "리빙", emoji: "🕯️", product: "우드 룸 디퓨저 세트", productValue: 35000, pointReward: 0, channels: ["naver_blog"] },
      { key: "dv-airbuds", name: "사운드포켓", category: "디지털", emoji: "🎧", product: "무선 이어버드 라이트", productValue: 59000, pointReward: 15000, channels: ["naver_blog", "instagram"], options: ["화이트", "블랙"] },
    ];
    const dvStoreIds: Record<string, string> = {};
    for (const b of dvBrands) {
      const stId = detId("st", b.key);
      dvStoreIds[b.key] = stId;
      db.stores.push({
        id: stId,
        ownerId: owner.id,
        name: STORYBOARD ? SB.storeName : b.name,
        category: STORYBOARD ? SB.category : b.category,
        area: STORYBOARD ? SB.area : "전국 택배",
        coverEmoji: b.emoji,
        rating: Math.round((4.3 + detNum(`${b.key}:rating`, 6) / 10) * 10) / 10,
        reviewCount: 60 + detNum(`${b.key}:rc`, 300),
        hours: STORYBOARD ? SB.hours : "평일 발송 · 주문 후 2~3일",
        // 브랜드 물류 기준지 좌표 (지도 노출 대상 아님 — 배송 세그먼트는 리스트 전용)
        lat: 37.5665 + (detNum(`${b.key}:lat`, 100) - 50) / 1000,
        lng: 126.978 + (detNum(`${b.key}:lng`, 100) - 50) / 1000,
        address: STORYBOARD ? SB.address : "서울 성동구 물류센터로 12",
      });
      db.campaigns.push({
        id: detId("cp", `${b.key}-camp`),
        storeId: stId,
        kind: "delivery",
        title: STORYBOARD ? SB.visitTitle : `${b.product} 배송 체험단`,
        startAt: now - (5 + detNum(`${b.key}:start`, 5)) * day,
        endAt: now + (10 + detNum(`${b.key}:end`, 14)) * day,
        supportAmount: b.productValue, // 배송형 = 제공 상품 정가
        quota: { S: 1, A: 2, B: 3, C: 2 },
        used: { S: 0, A: 0, B: 0, C: 0 },
        requiredChannels: b.channels,
        requiredMenus: [],
        description: STORYBOARD
          ? SB.visitDesc
          : `${b.product}를 집으로 받아 체험하고 후기를 남겨주세요. 리뷰 검수 통과 시 ${b.pointReward > 0 ? `${b.pointReward.toLocaleString()}P(등급 배율 적용)가 적립됩니다.` : "브랜드 스토어에 후기가 소개됩니다."}`,
        highlightKeywords: STORYBOARD ? [SB.keyword] : [b.product, "택배 언박싱"],
        createdAt: now - (5 + detNum(`${b.key}:start`, 5)) * day,
        useCode: DEMO_USE_CODE,
        ...(b.pointReward > 0 ? { pointReward: b.pointReward } : {}),
        productCategory: b.category, // 상품 카테고리 — 탐색 배송 칩·필터 기준
        // 상품 옵션 (2026-07-16) — 신청 시 택1, 발송 큐 표시
        ...(b.options ? { productOptions: STORYBOARD ? b.options.map((_, i) => `${SB.productOption} ${i + 1}`) : b.options } : {}),
      });
    }
    const dvCamp = (key: string) => db.campaigns.find((c) => c.id === detId("cp", `${key}-camp`))!;

    // 배송 패스 — ① 발송 대기(사장님 큐 데모: demo + demo-a 2건) ② 발송 완료(리뷰 대기) ③ 검수 완료(포인트 적립)
    const mkShipping = (who: string) =>
      STORYBOARD
        ? { recipient: "수령인", phone: "000-0000-0000", address: "주소" }
        : who === "a"
          ? { recipient: "김성수", phone: "010-2222-3333", address: "서울 성동구 왕십리로 83, 101동 202호" }
          : { recipient: "박북촌", phone: "010-1234-5678", address: "서울 종로구 북촌로 57, 3층" };

    const dvPassSeeds: Array<{
      key: string;
      brand: string;
      status: "active" | "used" | "completed";
      reviewerId: string;
      grade: "A" | "B";
      channel: SnsKind;
      who: string;
      issuedOffset: number;
      usedOffset?: number;
      trackingNo?: string;
    }> = [
      { key: "demo-dv-active", brand: "dv-meal", status: "active", reviewerId: reviewer.id, grade: "B", channel: "instagram", who: "r", issuedOffset: 1 * day },
      { key: "demo-dv-ship-a", brand: "dv-bakes", status: "active", reviewerId: reviewerA.id, grade: "A", channel: "instagram", who: "a", issuedOffset: 2 * day },
      { key: "demo-dv-used", brand: "dv-bakes", status: "used", reviewerId: reviewer.id, grade: "B", channel: "naver_blog", who: "r", issuedOffset: 4 * day, usedOffset: 2 * day, trackingNo: "6912-3456-7890" },
    ];
    for (const sp of dvPassSeeds) {
      const camp = dvCamp(sp.brand);
      const p: Pass = {
        id: detId("ps", sp.key),
        code: detPassCode(sp.key),
        reviewerId: sp.reviewerId,
        campaignId: camp.id,
        storeId: camp.storeId,
        ownerId: owner.id,
        reviewerGrade: sp.grade,
        reviewChannel: sp.channel,
        issuedAt: now - sp.issuedOffset,
        expiresAt: camp.endAt, // 배송형 active 기한 = 캠페인 종료일
        shipping: mkShipping(sp.who),
        status: sp.status,
      };
      if (sp.usedOffset !== undefined) {
        p.usedAt = now - sp.usedOffset;
        p.shippedAt = now - sp.usedOffset;
        if (sp.trackingNo) p.trackingNo = sp.trackingNo;
      }
      camp.used[sp.grade] += 1;
      p.consumedSlot = sp.grade;
      db.passes.push(p);
    }

    // 검수 완료 배송 패스 — 포인트 적립 근거 (지난주 완료: 원두 세트는 지난 시즌 캠페인으로 가정)
    const dvDoneCamp = dvCamp("dv-bakes");
    const dvDone: Pass = {
      id: detId("ps", "demo-dv-done"),
      code: detPassCode("demo-dv-done"),
      reviewerId: reviewer.id,
      campaignId: dvDoneCamp.id,
      storeId: dvDoneCamp.storeId,
      ownerId: owner.id,
      reviewerGrade: "B",
      reviewChannel: "naver_blog",
      issuedAt: now - 12 * day,
      expiresAt: dvDoneCamp.endAt,
      shipping: mkShipping("r"),
      usedAt: now - 10 * day,
      shippedAt: now - 10 * day,
      trackingNo: "6900-0000-1111",
      reviewSubmittedAt: now - 8 * day,
      reviewUrl: "https://blog.naver.com/demo/dv-bakes-review",
      reviewBody: "수제 쿠키 선물 세트 언박싱부터 시식까지. 버터 향이 진하고 패키징이 선물용으로 좋았다...",
      reviewStatus: "approved",
      adNoticeConfirmed: true,
      reviewSelfCheck: Object.fromEntries(selfCheckConditions("naver_blog").map((c) => [c.key, true])),
      keepAgreed: true,
      completedAt: now - 7 * day,
      consumedSlot: "B",
      status: "completed",
    };
    dvDoneCamp.used.B += 1;
    db.passes.push(dvDone);

    // 포인트 원장 — 적립은 검수 승인 이벤트만(P4). 잔액 = 6,000 + 39,600 − 20,000 − 10,000 = 15,600P
    if (!db.pointTxns) db.pointTxns = [];
    if (!db.withdrawals) db.withdrawals = [];
    // ① dv-bakes 검수 승인 적립: 10,000P × B등급 60% = 6,000P
    db.pointTxns.push({
      id: detId("pt", "demo-pt-earn-1"),
      reviewerId: reviewer.id,
      type: "earn",
      amount: 6000,
      refPassId: dvDone.id,
      memo: STORYBOARD ? "적립 사유" : `${STORYBOARD ? SB.storeName : "카라멜 베이크 하우스"} 체험 리뷰 승인`,
      createdAt: now - 7 * day,
    });
    // ② 지난달 시즌 캠페인 적립(집계 이력) — 66,000P × B등급 60% = 39,600P
    db.pointTxns.push({
      id: detId("pt", "demo-pt-earn-2"),
      reviewerId: reviewer.id,
      type: "earn",
      amount: 39600,
      refPassId: dvDone.id,
      memo: STORYBOARD ? "적립 사유" : "시즌 기획전 배송 체험 리뷰 승인",
      createdAt: now - 26 * day,
    });
    // ③ 출금 완료 1건 — 20,000P: 세액 660원 → 소액부징수(1,000원 미만) 0원 · 수수료 500 · 실지급 19,500원
    const wdPaid = {
      id: detId("wd", "demo-wd-paid"),
      reviewerId: reviewer.id,
      amountPoints: 20000,
      incomeType: "business" as const,
      taxWithheld: 0,
      fee: 500,
      payout: 19500,
      bank: STORYBOARD ? "은행명" : "케이뱅크",
      account: STORYBOARD ? "계좌번호" : "100-123-456789",
      holder: STORYBOARD ? "예금주" : "박북촌",
      status: "paid" as const,
      requestedAt: now - 6 * day,
      processedAt: now - 4 * day,
    };
    db.withdrawals.push(wdPaid);
    db.pointTxns.push({
      id: detId("pt", "demo-pt-wd-1"),
      reviewerId: reviewer.id,
      type: "withdraw",
      amount: -20000,
      refWithdrawalId: wdPaid.id,
      memo: STORYBOARD ? "출금 신청" : "출금 신청 (케이뱅크 · 실지급 19,500원)",
      createdAt: now - 6 * day,
    });
    // ④ 출금 대기 1건 — 10,000P (어드민 출금 큐 데모): 세액 330원 → 소액부징수 0원 · 실지급 9,500원
    const wdPending = {
      id: detId("wd", "demo-wd-pending"),
      reviewerId: reviewer.id,
      amountPoints: 10000,
      incomeType: "business" as const,
      taxWithheld: 0,
      fee: 500,
      payout: 9500,
      bank: STORYBOARD ? "은행명" : "케이뱅크",
      account: STORYBOARD ? "계좌번호" : "100-123-456789",
      holder: STORYBOARD ? "예금주" : "박북촌",
      status: "requested" as const,
      requestedAt: now - 8 * hour,
    };
    db.withdrawals.push(wdPending);
    db.pointTxns.push({
      id: detId("pt", "demo-pt-wd-2"),
      reviewerId: reviewer.id,
      type: "withdraw",
      amount: -10000,
      refWithdrawalId: wdPending.id,
      memo: STORYBOARD ? "출금 신청" : "출금 신청 (케이뱅크 · 실지급 9,500원)",
      createdAt: now - 8 * hour,
    });
  }

  // ── 예약형 방문 예약 시드 (2026-07-16 v2 — 사장님 홈 예약 큐 데모) ──
  // 발송 대기 큐와 동일 취지: 예약 신청이 있어야 큐가 렌더되므로, 데모 사장님(demo@store.com)의
  // 예약형 캠페인에 3가지 상태(확인 대기 · 다른 시간 제안(응답 대기) · 확정)를 시드한다.
  // proposed 건의 체험자 = demo — 체험자 계정에서 제안 응답(라디오 4행) 화면도 바로 시연된다.
  {
    const ownerStoreIds = new Set(db.stores.filter((s) => s.ownerId === owner.id).map((s) => s.id));
    const rsvCamps = db.campaigns.filter(
      (c) => c.kind === "visit" && c.reservationRequired && ownerStoreIds.has(c.storeId) && c.endAt > now,
    );
    // 월요일 휴무(시드 스케줄) 회피 — 월요일에 걸리면 하루 미룬다 (데모 데이터 정합)
    const dstr = (days: number) => {
      let t = now + days * day;
      if (new Date(t + 9 * hour).getUTCDay() === 1) t += day;
      return kstTodayStr(t);
    };
    const proposalNote = STORYBOARD
      ? "안내사항"
      : "저녁 시간대는 예약이 몰려 있어요. 제안드린 시간이 어려우면 평일 낮으로 기타 요청 부탁드려요!";
    // 협상 히스토리(v3)를 상태별로 구성 — 확인 대기 / 제안(응답 대기) / 재제안(확인·거절 대기) / 확정
    const rsvSeeds: Array<{
      key: string;
      camp: Campaign | undefined;
      reviewerId: string;
      grade: "A" | "B" | "C";
      date: string;
      time: string;
      status: "requested" | "proposed" | "confirmed";
      withProposal?: boolean; // proposed 상태의 proposal 페이로드
      withCounter?: boolean; // 재제안까지 진행된 requested (사장님 확인/거절 대기)
    }> = [
      { key: "demo-rsv-requested", camp: rsvCamps[0], reviewerId: reviewerA.id, grade: "A", date: dstr(2), time: "14:00", status: "requested" },
      { key: "demo-rsv-proposed", camp: rsvCamps[1], reviewerId: reviewer.id, grade: "B", date: dstr(3), time: "19:00", status: "proposed", withProposal: true },
      { key: "demo-rsv-confirmed", camp: rsvCamps[2], reviewerId: reviewerC.id, grade: "C", date: dstr(1), time: "11:30", status: "confirmed" },
      { key: "demo-rsv-counter", camp: rsvCamps[3], reviewerId: reviewerA.id, grade: "A", date: dstr(3), time: "12:00", status: "requested", withCounter: true },
    ];
    for (const sp of rsvSeeds) {
      if (!sp.camp) continue; // 예약형 캠페인이 부족한 구성에서도 시드가 깨지지 않게
      const proposalSlots = [
        { date: sp.date, time: "17:00" },
        { date: dstr(4), time: "13:00" },
      ];
      // 히스토리 — request → (propose) → (counter) → (confirm)
      const history: ReservationEvent[] = [
        sp.withCounter
          ? { at: now - 8 * hour, by: "reviewer", kind: "request", date: dstr(2), time: "15:00" }
          : { at: now - 6 * hour, by: "reviewer", kind: "request", date: sp.date, time: sp.time },
      ];
      if (sp.withProposal) {
        history.push({ at: now - 2 * hour, by: "owner", kind: "propose", slots: proposalSlots, note: proposalNote });
      }
      if (sp.withCounter) {
        history.push({ at: now - 5 * hour, by: "owner", kind: "propose", slots: [{ date: dstr(2), time: "18:00" }] });
        history.push({ at: now - 1 * hour, by: "reviewer", kind: "counter", date: sp.date, time: sp.time });
      }
      if (sp.status === "confirmed") {
        history.push({ at: now - 3 * hour, by: "owner", kind: "confirm", date: sp.date, time: sp.time });
      }
      const p: Pass = {
        id: detId("ps", sp.key),
        code: detPassCode(sp.key),
        reviewerId: sp.reviewerId,
        campaignId: sp.camp.id,
        storeId: sp.camp.storeId,
        ownerId: owner.id,
        reviewerGrade: sp.grade,
        reviewChannel: defaultChannel(sp.camp.requiredChannels) ?? sp.camp.requiredChannels[0],
        consumedSlot: sp.grade,
        issuedAt: now - 6 * hour,
        expiresAt: reservationDayEnd(sp.date), // 예약형 기한 = 예약일 당일 말 (운영정책서 §15)
        reservation: {
          date: sp.date,
          time: sp.time,
          partySize: 2, // 방문 인원수 (2026-07-17 — 데모 2명)
          status: sp.status,
          requestedAt: now - 6 * hour,
          history,
          ...(sp.status === "confirmed" ? { confirmedAt: now - 3 * hour } : {}),
          ...(sp.withProposal
            ? { proposal: { slots: proposalSlots, note: proposalNote, proposedAt: now - 2 * hour } }
            : {}),
        },
        status: "active",
      };
      sp.camp.used[sp.grade] += 1;
      db.passes.push(p);
    }
    // 일정 차단 데모 (§6) — 첫 예약형 캠페인에 날짜 차단 1건 + 시간 차단 1건.
    // 체험자 신청 화면(비활성 표시)과 사장님 캠페인 관리(차단 목록·해제)를 바로 시연한다.
    if (rsvCamps[0]) {
      rsvCamps[0].reservationBlocks = {
        dates: [dstr(6)],
        slots: [{ date: dstr(2), time: "13:00" }],
      };
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

  // ── 관심 목록 시드 (2026-07-08) — 진행 가능 + 마감 케이스를 모두 커버 ──
  // '마감된 체험'용: 기간이 종료된 캠페인 2건을 별도 생성.
  // 홈·탐색에는 노출되지 않지만(campaignExposure=closed) 관심 목록에는 "마감된 체험"으로 유지되고,
  // 상세 진입 시 열람은 가능하되 CTA가 [마감된 체험이에요]로 비활성되는 흐름을 시연한다.
  const endedSeeds = [
    { placeId: "1621388960", key: "ended-1" }, // 한남 코너 다이닝 지난 캠페인
    { placeId: "959481202", key: "ended-2" }, // 북촌 한정식 지난 캠페인
  ];
  const endedCampaignIds: string[] = [];
  for (const es of endedSeeds) {
    const endedStore = db.stores.find((s) => s.id === detId("st", es.placeId));
    if (!endedStore) continue;
    const endedCampaign: Campaign = {
      id: detId("cp", `${es.placeId}-${es.key}`),
      storeId: endedStore.id,
      kind: "visit",
      title: STORYBOARD ? SB.visitTitle : `${endedStore.name} 지난 체험단`,
      startAt: now - 40 * day,
      endAt: now - 3 * day, // 기간 종료 → closed
      supportAmount: 80000,
      quota: { S: 1, A: 2, B: 3, C: 4 },
      used: { S: 1, A: 2, B: 3, C: 4 }, // 발급 소진 상태로 종료
      requiredChannels: ["naver_blog", "instagram"],
      requiredMenus: [{ name: STORYBOARD ? SB.menu : "시그니처 메뉴", price: 25000 }],
      description: STORYBOARD ? SB.visitDesc : `${endedStore.name}의 지난 시즌 체험 캠페인입니다.`,
      highlightKeywords: STORYBOARD ? [SB.keyword] : [endedStore.area],
      createdAt: now - 40 * day,
      useCode: DEMO_USE_CODE,
    };
    db.campaigns.push(endedCampaign);
    endedCampaignIds.push(endedCampaign.id);
  }

  // demo@reviewer.com의 관심 목록 — 진행 가능 2건(성수 3채널 모집 / 홍대 틱톡 단독 모집) + 마감 2건
  const interestOpenCampaigns = ["31906212", "9990001234"]
    .map((pid) => findCampaign(pid))
    .filter((c): c is NonNullable<typeof c> => !!c);
  db.interests = [
    ...interestOpenCampaigns.map((c, i) => ({
      reviewerId: reviewer.id,
      campaignId: c.id,
      createdAt: now - (1 + i) * day,
    })),
    ...endedCampaignIds.map((id, i) => ({
      reviewerId: reviewer.id,
      campaignId: id,
      createdAt: now - (5 + i) * day,
    })),
  ];

  // ── 등급 월간 재평가 데모 시드 (2026-07-08) — 직전 KST 월 활동 ──
  // lastRegradeMonth는 시드하지 않는다 → 재시드 후 첫 DB 로드에서 sweepMonthlyRegrade가
  // 이 데이터를 평가한다. 종료 캠페인(used=quota)에 귀속해 현재 노출/잔여에 영향 없음.
  //   demo   : 완료 3건(초과 결제율 0.8 한 건) + 리뷰 기한 초과 1건 → F 75 · W 27 · P −7 → 블로그 A→B 하락 데모
  //   demo-a : 완료 5건(초과 결제율 1.0×3 + 0.9×2 → W 96)·노쇼 0 → GS≥90 S 후보 + 상생 리뷰어 뱃지 (S 자동 부여 없음 → A 유지)
  //   demo-c : 완료 1건 → 표본 부족(neutralized) — 지수 단독 유지 데모
  const prevMonth = prevMonthKey(kstMonthKey(now));
  const prevStart = kstMonthStart(prevMonth);
  const tsInPrevMonth = (dayOfMonth: number, hourOfDay = 12) =>
    prevStart + (dayOfMonth - 1) * day + hourOfDay * hour;

  type PrevMonthPass = {
    key: string;
    reviewerId: string;
    grade: Pass["reviewerGrade"];
    campaignIdx: number; // endedCampaignIds 인덱스
    useDay: number; // 이용일 (직전 월의 KST 일자, ≤ 25 — 승인 시각까지 월 내 귀속 보장)
    paid: number;
    support: number;
    overdue?: boolean; // 리뷰 기한 초과(패널티) 케이스 — 완료 아님
    channel?: SnsKind;
  };
  const prevMonthPasses: PrevMonthPass[] = [
    // demo — 완료 3건 + 기한 초과 1건
    { key: "pm-demo-1", reviewerId: reviewer.id, grade: "A", campaignIdx: 0, useDay: 3, paid: 100000, support: 100000 },
    { key: "pm-demo-2", reviewerId: reviewer.id, grade: "A", campaignIdx: 0, useDay: 8, paid: 144000, support: 80000 }, // 초과율 0.8
    { key: "pm-demo-3", reviewerId: reviewer.id, grade: "A", campaignIdx: 1, useDay: 14, paid: 64000, support: 64000 },
    { key: "pm-demo-4", reviewerId: reviewer.id, grade: "A", campaignIdx: 1, useDay: 10, paid: 80000, support: 80000, overdue: true },
    // demo-a — 완료 5건 (지원금 대비 2배·1.9배 결제 = 초과율 캡 1.0/0.9)
    { key: "pm-a-1", reviewerId: reviewerA.id, grade: "A", campaignIdx: 0, useDay: 4, paid: 160000, support: 80000, channel: "instagram" },
    { key: "pm-a-2", reviewerId: reviewerA.id, grade: "A", campaignIdx: 0, useDay: 9, paid: 160000, support: 80000, channel: "instagram" },
    { key: "pm-a-3", reviewerId: reviewerA.id, grade: "A", campaignIdx: 1, useDay: 13, paid: 160000, support: 80000, channel: "instagram" },
    { key: "pm-a-4", reviewerId: reviewerA.id, grade: "A", campaignIdx: 1, useDay: 18, paid: 152000, support: 80000, channel: "instagram" },
    { key: "pm-a-5", reviewerId: reviewerA.id, grade: "A", campaignIdx: 0, useDay: 22, paid: 152000, support: 80000, channel: "instagram" },
    // demo-c — 완료 1건 (표본 부족)
    { key: "pm-c-1", reviewerId: reviewerC.id, grade: "C", campaignIdx: 1, useDay: 12, paid: 32000, support: 32000, channel: "instagram" },
  ];
  for (const pm of prevMonthPasses) {
    const campId = endedCampaignIds[pm.campaignIdx];
    if (!campId) continue;
    const camp = db.campaigns.find((c) => c.id === campId)!;
    const pmStore = db.stores.find((s) => s.id === camp.storeId)!;
    const usedAt = tsInPrevMonth(pm.useDay);
    const issuedAt = usedAt - 20 * hour;
    const p: Pass = {
      id: detId("ps", pm.key),
      code: detPassCode(pm.key),
      reviewerId: pm.reviewerId,
      campaignId: camp.id,
      storeId: pmStore.id,
      ownerId: pmStore.ownerId,
      reviewerGrade: pm.grade,
      reviewChannel: pm.channel ?? "naver_blog",
      issuedAt,
      expiresAt: issuedAt + 72 * hour,
      usedAt,
      paidAmount: pm.paid,
      supportApplied: pm.support,
      status: pm.overdue ? "used" : "completed",
    };
    if (pm.overdue) {
      // usedAt+7d(직전 월 내) 초과 — 스윕 재처리 방지 플래그, 재평가에서 해당 월 패널티로 귀속
      p.overdueHandled = true;
    } else {
      p.reviewSubmittedAt = usedAt + 2 * day;
      p.reviewUrl = STORYBOARD ? "리뷰URL" : `https://blog.naver.com/demo/${pm.key}`;
      p.reviewStatus = "approved";
      p.adNoticeConfirmed = true;
      p.completedAt = usedAt + 3 * day; // 검수 승인 시각 — 월간 재평가의 완료·상생 귀속 기준
    }
    // 종료 캠페인의 used는 이미 quota와 동일(발급 소진 종료) — 추가 증가 없음
    db.passes.push(p);
  }

  // ── 바이럴(레퍼럴) 시드 ──
  // 라이브 카운터 — 실제 시드 이벤트(DEMO2024 초대 수락)만 기록. 조작 수치 없음 (VER.1 MVP 원칙).
  // todayBoxCount는 snapshotCounter가 rewards 발행 시각 기준으로 매번 재계산한다.
  db.viralCounter = {
    date: new Date(now).toISOString().slice(0, 10),
    todayBoxCount: 0,
    liveStream: [
      { nickname: STORYBOARD ? SB.nickname : "성수러버", rewardText: "다음 체험 지원금 +50% 부스트", ts: now - 2 * day, matrix: "RR" },
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

  // 데모 보상 — 모두 실사용 가능한 종류(지원금 부스트)만 발행.
  //  seed-1: 이미 사용된 부스트 (사용 완료 상태 데모)
  //  seed-2: 미사용 부스트 +10% — 다음 체험권 사용 처리 시 자동 가산됨
  //  seed-3: 성수러버(피추천자)의 환영 부스트 +50% (DEMO2024 수락 보상)
  db.rewards = [
    {
      id: detId("rwd", "seed-1"),
      ownerUserId: reviewer.id,
      source: "referrer_box",
      kind: "support_bonus_pct",
      value: 10,
      issuedAt: now - 2 * day,
      expiresAt: now + 28 * day,
      usedAt: now - 1 * day,
      meta: { matrix: "RR", accepted: 1 },
    },
    {
      id: detId("rwd", "seed-2"),
      ownerUserId: reviewer.id,
      source: "referrer_box",
      kind: "support_bonus_pct",
      value: 10,
      issuedAt: now - 36 * hour,
      expiresAt: now + 28 * day,
      meta: { matrix: "RR", accepted: 2 },
    },
    {
      id: detId("rwd", "seed-3"),
      ownerUserId: reviewerA.id,
      source: "referee_welcome",
      kind: "support_bonus_pct",
      value: 50,
      issuedAt: now - 2 * day,
      expiresAt: now + 12 * day,
      meta: { matrix: "RR" },
    },
  ];
}
