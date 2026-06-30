export type Grade = "S" | "A" | "B" | "C" | "N";

// 연동 가능한 채널은 네이버 블로그 / 인스타그램 / 틱톡 3종으로 한정 (v2.16)
export type SnsKind = "naver_blog" | "instagram" | "tiktok";

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
  grade: Grade; // 종합 등급(연동 채널 중 최상위) — 단일 등급 UI/뱃지에 사용
  // 채널별 등급 — 연동된 각 채널을 독립적으로 평가 (v2.16).
  // 예: { naver_blog: "A", instagram: "C" }
  channelGrades?: Partial<Record<SnsKind, Grade>>;
  createdAt: number;
  completedReviews: number;
  qualityScore: number; // 0~100
  noShowCount: number;
  inviteStats?: InviteStats; // 바이럴(레퍼럴) — 추천 발신/수락/박스 등급 누적
}

export interface Owner {
  id: string;
  email: string;
  passwordHash: string;
  storeName: string;
  category: string;
  area: string;
  plan: "Free" | "Basic" | "Standard" | "Premium";
  createdAt: number;
  inviteStats?: InviteStats; // 사장님도 OR/OO 매트릭스로 추천 발신 가능
}

// 운영팀(검수) 계정 — 리뷰 통과/반려 백오피스 전용.
export interface AdminUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
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

// 필수 주문 메뉴 — 사장님이 메뉴명과 함께 가격을 입력할 수 있음.
// 가격은 체험자에게 노출되어 받게 될 혜택의 크기를 확인하는 용도.
export interface RequiredMenu {
  name: string;
  price?: number; // 원 단위 (선택)
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
  requiredMenus: RequiredMenu[];
  description: string; // 매장 소개 (최대 500자)
  // 사장님이 후기에 강조해주길 원하는 키워드 — 체험 매장 상세에 노출 (v2.16)
  highlightKeywords?: string[];
  createdAt: number;
  // 사장님이 캠페인 생성 시 지정하는 사용처리 4자리 숫자 코드.
  // 유저 체험권 화면에 노출되며, 사장님이 QR 스캔 대신 이 4자리를 입력하면 사용 처리됨.
  useCode: string; // "0000" ~ "9999"
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
  // 자가점검 — 채널별 작성 조건 키에 대한 사용자 직접 체크 (v2.16부터 채널별 가변).
  // 키는 src/lib/channels.ts의 CHANNEL_REVIEW_CONDITIONS[channel] 정의를 따른다.
  reviewSelfCheck?: Record<string, boolean>;
  status: PassStatus;
}

// ─────────────────────────────────────────────────────────────
// 바이럴 (Referral) — Toss 6원리 적용 ("docs/viral-test/PRD-viral-referral.md")
// 메인 통합 (v2.8): 어댑터 인터페이스(`src/lib/referral.ts`) + API 3종 + 혜택 탭 UI
// ─────────────────────────────────────────────────────────────

export type UserKind = "reviewer" | "owner";
export type BoxGrade = "basic" | "silver" | "gold";

export interface InviteStats {
  sent: number;       // 토큰 발급 수
  clicked: number;    // 토큰 클릭 수
  accepted: number;   // 가입 완료(소비) 수
  boxGrade: BoxGrade; // 누적 accepted 기반 단계 (1~2 basic / 3~4 silver / 5+ gold)
  cumulativeCash: number; // 보너스 캐시 누적
}

export type InviteStatus = "issued" | "clicked" | "signed_up" | "expired";
export type ShareChannel = "kakao" | "sms" | "instagram_dm" | "copy_link";
export type MatrixKey = "RR" | "RO" | "OR" | "OO";

export interface Invite {
  token: string;          // 8자 base62, /r/i/<token>로 진입
  referrerId: string;
  referrerKind: UserKind;
  targetKind: UserKind;
  storeId?: string;        // OR 매트릭스에서 매장 컨텍스트 (선택)
  campaignId?: string;     // T1 트리거에서 패스 컨텍스트 (선택)
  channel?: ShareChannel;
  status: InviteStatus;
  createdAt: number;
  expiresAt: number;       // 14일
  consumedAt?: number;
  consumedBy?: string;     // 신규 가입자(피추천자) id
}

export type RewardKind =
  | "cash"                  // 보너스 캐시 (₩)
  | "support_bonus_pct"     // 첫 캠페인 지원금 +N%
  | "membership_discount"   // 멤버십 할인 (사장님: %)
  | "quota_bonus"           // 캠페인 모집 한도 +N팀
  | "spotlight_pass";       // 시그니처 우선 노출권

export interface Reward {
  id: string;
  ownerUserId: string;      // 보상을 받는 사용자 id (reviewer 또는 owner)
  source: "referrer_box" | "referee_welcome" | "milestone";
  kind: RewardKind;
  value: number;
  issuedAt: number;
  expiresAt: number;
  usedAt?: number;
  meta?: { matrix?: MatrixKey; accepted?: number; isBonus?: boolean };
}

export interface ViralCounter {
  date: string;             // YYYY-MM-DD
  todayBoxCount: number;
  todayAvgReward: number;
  liveStream: Array<{ nickname: string; reward: number; ts: number; matrix: MatrixKey }>;
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
  admins?: AdminUser[]; // 운영팀 검수 계정
  stores: Store[];
  campaigns: Campaign[];
  passes: Pass[];
  notifications: NotificationItem[];
  // ── 바이럴(레퍼럴) ──
  invites?: Invite[];
  rewards?: Reward[];
  viralCounter?: ViralCounter;
  // ──
  seeded: boolean;
  seedVersion?: number; // 시드 스키마 변경 시 bump → 자동 재시드 트리거
  naverDataFetched?: number; // 마지막 Naver Place 자동 갱신 timestamp
}
