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
  termsAgreedAt?: number; // 이용약관·개인정보 수집 동의 시각 (가입 시 필수)
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
  termsAgreedAt?: number; // 이용약관·개인정보 수집 동의 시각 (가입 시 필수)
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
  | "expired" // 24시간 경과 미사용 (모집 슬롯 복구됨)
  | "cancelled" // 체험자가 사용 전 직접 취소 (모집 슬롯 복구됨)
  | "rejected"; // 리뷰 반려 — 기한 내 1회 재제출 가능

export interface Pass {
  id: string;
  code: string; // QR 코드 값
  reviewerId: string;
  campaignId: string;
  storeId: string;
  ownerId: string;
  reviewerGrade: Grade;
  // 발급 시 차감한 등급 슬롯 — 만료/취소 시 이 슬롯을 복구한다.
  consumedSlot?: "S" | "A" | "B" | "C";
  issuedAt: number;
  expiresAt: number;
  usedAt?: number;
  cancelledAt?: number; // 체험자 취소 시각
  paidAmount?: number;
  supportApplied?: number;
  // 초대 보상(지원금 부스트)이 사용 처리에 적용된 경우 기록
  supportBoostPct?: number;
  boostRewardId?: string;
  reviewSubmittedAt?: number;
  reviewUrl?: string;
  reviewPhotos?: string[]; // data URL or placeholder
  reviewBody?: string;
  reviewChannel?: SnsKind;
  reviewStatus?: "pending" | "approved" | "rejected";
  // 자가점검 — 채널별 작성 조건 키에 대한 사용자 직접 체크 (v2.16부터 채널별 가변).
  // 키는 src/lib/channels.ts의 CHANNEL_REVIEW_CONDITIONS[channel] 정의를 따른다.
  reviewSelfCheck?: Record<string, boolean>;
  // 경제적 대가(광고) 표기 확인 — 리뷰 제출 시 서버가 필수로 검증·보존 (분쟁 근거)
  adNoticeConfirmed?: boolean;
  // 반려 처리 기록 — 사유는 체험자 화면에 그대로 노출되어 재작성 근거가 된다
  rejectReason?: string;
  rejectedAt?: number;
  resubmitCount?: number; // 반려 후 재제출 횟수 (최대 1회 허용)
  // 라이프사이클 스윕 중복 방지 플래그
  overdueHandled?: boolean; // 리뷰 기한(72h) 초과 처리 완료
  expiringSoonNotified?: boolean; // 만료 6시간 전 알림 발송 완료
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

// 모든 보상은 실제 사용 경로가 구현된 종류만 발행한다 (VER.1 MVP 원칙).
//  - support_bonus_pct: 다음 체험권 사용 처리 시 지원금 한도에 +N% 가산 (기준 지원금 100% 초과 불가)
//  - membership_discount: 멤버십 결제 시 할인 (value ≤ 100이면 %, 초과면 ₩) — PG 연동 시 결제 단계에서 소진
//  - quota_bonus: 이번 달 모집 한도 +N팀 — 플랜 한도 초과 캠페인 생성 시 자동 소진
export type RewardKind =
  | "support_bonus_pct"
  | "membership_discount"
  | "quota_bonus";

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

// 라이브 카운터 — 실제 발생한 보상 이벤트만 집계한다 (조작·노이즈 없음, VER.1 MVP 원칙).
export interface ViralCounter {
  date: string;             // YYYY-MM-DD
  todayBoxCount: number;    // 오늘 실제 열린 박스(발행 보상) 수
  liveStream: Array<{ nickname: string; rewardText: string; ts: number; matrix: MatrixKey }>;
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
