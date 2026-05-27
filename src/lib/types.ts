export type Grade = "S" | "A" | "B" | "C" | "N";

export type SnsKind = "naver_blog" | "instagram" | "youtube" | "tiktok";

export interface SnsAccount {
  kind: SnsKind;
  url: string;
  influence: number; // 일방문자/팔로워/구독자 자연수
}

export interface Reviewer {
  id: string;
  email: string;
  passwordHash: string;
  nickname: string;
  sns: SnsAccount[];
  grade: Grade;
  createdAt: number;
  completedReviews: number;
  qualityScore: number; // 0~100
  noShowCount: number;
}

export interface Owner {
  id: string;
  email: string;
  passwordHash: string;
  storeName: string;
  category: string;
  area: string;
  plan: "Basic" | "Standard" | "Premium";
  createdAt: number;
}

export interface Store {
  id: string;
  ownerId: string;
  name: string;
  category: string;
  area: string;
  coverEmoji: string;
  rating: number;
  reviewCount: number;
  hours: string;
  // 지도/외부 링크
  lat?: number;
  lng?: number;
  address?: string;
  naverPlaceId?: string; // m.place.naver.com/place/<id> 의 id
}

export type CampaignKind = "visit" | "press";

export interface CampaignGradeQuota {
  S: number;
  A: number;
  B: number;
  C: number;
}

export interface Campaign {
  id: string;
  storeId: string;
  kind: CampaignKind;
  title: string;
  startAt: number;
  endAt: number;
  supportAmount: number; // 방문형 지원금 한도 (기자단의 경우 정산 예정금)
  quota: CampaignGradeQuota;
  used: { S: number; A: number; B: number; C: number };
  requiredChannels: SnsKind[];
  requiredMenus: string[];
  description: string;
  createdAt: number;
  // 기자단 전용
  pressKeywords?: string[];
  pressMaterials?: string[]; // 자료팩 — 파일명/요약 텍스트
  pressMinChars?: number; // 최소 본문자 수
}

export type PassStatus =
  | "active" // 24시간 카운트다운 중
  | "used" // QR 스캔 완료 → 리뷰 대기
  | "review_submitted" // 리뷰 등록됨, 검수 대기
  | "completed" // 검수 완료
  | "expired" // 24시간 경과 미사용
  | "rejected"; // 리뷰 반려

export interface Pass {
  id: string;
  code: string; // QR 코드 값
  reviewerId: string;
  campaignId: string;
  storeId: string;
  ownerId: string;
  reviewerGrade: Grade;
  issuedAt: number;
  expiresAt: number;
  usedAt?: number;
  paidAmount?: number;
  supportApplied?: number;
  reviewSubmittedAt?: number;
  reviewUrl?: string;
  reviewPhotos?: string[]; // data URL or placeholder
  reviewBody?: string;
  reviewChannel?: SnsKind;
  reviewStatus?: "pending" | "approved" | "rejected";
  // 자가점검 (방문형 리뷰 인증 시 사용자가 직접 체크)
  reviewSelfCheck?: {
    photos: boolean; // 사진 5장 이상
    body500: boolean; // 본문 500자 이상
    menus: boolean; // 메뉴/매장/분위기 사진 포함
    days30: boolean; // 30일 이상 게시 유지 동의
  };
  status: PassStatus;
}

export interface NotificationItem {
  id: string;
  userId: string;
  role: "reviewer" | "owner";
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
  link?: string;
}

export interface DBShape {
  reviewers: Reviewer[];
  owners: Owner[];
  stores: Store[];
  campaigns: Campaign[];
  passes: Pass[];
  notifications: NotificationItem[];
  seeded: boolean;
  naverDataFetched?: number; // 마지막 Naver Place 자동 갱신 timestamp
}
