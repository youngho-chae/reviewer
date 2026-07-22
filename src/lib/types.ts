export type Grade = "S" | "A" | "B" | "C" | "N";

// 연동 가능한 채널은 네이버 블로그 / 인스타그램 / 틱톡 3종으로 한정 (v2.16)
export type SnsKind = "naver_blog" | "instagram" | "tiktok";

export interface SnsAccount {
  kind: SnsKind;
  url: string;
  influence: number; // 일방문자/팔로워/구독자 자연수
  // ── 본인 소유 검증 (2026-07-10 신설) ──
  // 가입 자기신고분은 미검증(undefined). OAuth(네이버/페이스북/틱톡 로그인) 또는
  // 데모 검증(키 미설정 환경 시연용)으로 검증되면 아래 필드가 채워진다.
  // OAuth 액세스 토큰은 저장하지 않는다 — 검증 직후 폐기 (개인정보 최소 수집).
  verified?: boolean;
  verifiedAt?: number;
  verifiedVia?: "oauth" | "demo";
  providerAccountId?: string; // 프로바이더 계정 고유 ID (네이버 id / FB user id / 틱톡 open_id)
  accountName?: string; // 프로바이더 표시명 또는 username
}

// ── 등급 월간 재평가 (2026-07-08 설계) ──
// 매월 말(KST) 직전 월 활동을 평가해 채널별 등급을 갱신한다.
//   GS_ch = 0.70·I(지수) + 0.20·F(성실 이행) + 0.10·W(상생지수) − P(패널티)
// 리뷰 품질은 주관 평가 배제 원칙으로 점수 요소에서 제외 — 반려 종착만 패널티로 반영.
export interface GradeHistoryEntry {
  month: string; // 평가 대상 월 "YYYY-MM" (KST)
  channel?: SnsKind; // 채널별 항목 (undefined = 표기 등급(연동 채널 중 최고) 변동 요약)
  from: Grade;
  to: Grade;
  breakdown: { I: number; F: number; W: number; P: number; GS: number };
  neutralized?: boolean; // 표본 부족(당월 이벤트 <2건) — F/W 중립, GS = I − P
  skipped?: boolean; // 당월 이벤트 0건 — 등급 유지, 기록만
  sCandidate?: boolean; // GS≥90 & 당월 노쇼 0 & 완료 5건↑ — S는 운영팀 부여(자동 승급 없음)
  winWinQualified?: boolean; // 당월 상생 리뷰어 기준(W≥60 & 완료 3건↑) 충족 여부
  at: number; // 재평가 실행 시각
}

export interface Reviewer {
  id: string;
  email: string;
  passwordHash: string;
  nickname: string;
  sns: SnsAccount[];
  // 표기용 대표 등급 — '종합 등급'이라는 별도 평가 기준은 존재하지 않는다 (2026-07-10 정정).
  // 등급은 채널별로 각각 평가되며(channelGrades), 이 값은 마이페이지 등 단일 등급 UI/뱃지에
  // 연동 채널 중 가장 높은 등급을 표기하기 위한 파생 값이다 (bestGrade).
  grade: Grade;
  // 채널별 등급 — 연동된 각 채널을 독립적으로 평가 (v2.16).
  // 예: { naver_blog: "A", instagram: "C" }
  channelGrades?: Partial<Record<SnsKind, Grade>>;
  createdAt: number;
  termsAgreedAt?: number; // 이용약관·개인정보 수집 동의 시각 (가입 시 필수)
  completedReviews: number;
  // @deprecated 재평가 설계(2026-07-08)에서 리뷰 품질 요소가 제외되어 미사용 확정.
  // 제거하지 않고 유지만 한다 (데이터정책서 §qualityScore 참조).
  qualityScore: number; // 0~100
  noShowCount: number;
  inviteStats?: InviteStats; // 바이럴(레퍼럴) — 추천 발신/수락/박스 등급 누적
  // ── 등급 월간 재평가 ──
  gradeHistory?: GradeHistoryEntry[];
  lastRegradeAt?: number;
  // 상생 리뷰어 뱃지 — 표면적 신뢰 표식(지원금 배율·참여 조건 무영향, P1 무관).
  // 유예 1개월: lastQualifiedMonth가 평가월 직전 월이면 유지, 2개월 연속 미달 시 회수.
  winWinBadge?: { since: number; lastQualifiedMonth: string };
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
  // ── 사업자 인증 (확정 정책 9 — 수기 인증) ──
  // undefined = 인증 제도 도입 전 가입한 구버전 계정 → verified로 간주(폴백).
  // pending 상태에서는 사장님 화면 접근이 인증 대기 화면으로 대체된다 ("인증된 사장님" 권한).
  bizNumber?: string; // 사업자등록번호 10자리 (형식 검증만 — 진위 확인은 운영팀 수기)
  bizStatus?: "pending" | "verified";
  bizVerifiedAt?: number;
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

// delivery(배송형)는 레뷰 벤치마크 반영(2026-07-12, docs/벤치마크-레뷰.md) —
// 상품을 택배로 수령해 체험 후 리뷰. 지역 무관 전국 참여, 발송 처리 후 리뷰 7일.
export type CampaignKind = "visit" | "press" | "delivery";

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
  // 사장님이 캠페인 생성 시 지정하는 사용처리 4자리 숫자 코드 (체험권 인증용 비밀번호).
  // 체험자 화면에는 노출되지 않는다 — 사장님이 체험자의 체험권 화면 입력란에 직접 입력해 사용 처리.
  useCode: string; // "0000" ~ "9999"
  // 기자단 전용
  pressKeywords?: string[];
  pressMaterials?: string[]; // 자료팩 — 파일명/요약 텍스트
  pressMinChars?: number; // 최소 본문자 수
  // ── 배송형(delivery) 전용 (2026-07-12 레뷰 벤치마크) ──
  // 리뷰 검수 승인 시 지급하는 체험 포인트(1P=1원). 실제 지급액은 참여 채널 등급 배율 적용
  // (P1: 등급은 혜택 크기) — src/lib/points.ts pointsForGrade. 0/미설정 = 제품만 제공.
  pointReward?: number;
  // 상품 카테고리 — 배송형은 매장이 아닌 "특정 스토어의 상품"이 대상이라 플레이스
  // 카테고리(카페·식당 등)와 맥락이 다르다. src/lib/delivery-categories.ts 목록의 값 (배송형 필수).
  productCategory?: string;
  // ── 방문형 예약 옵션 (예약형 라이트 — flags.ts '추후 확장'의 1단계) ──
  // true면 상세·체험권에 "방문 전 예약 필수" 배지 + 안내. 선정 절차는 두지 않는다(즉시 발급 유지).
  reservationRequired?: boolean;
  // 예약 안내 (2026-07-16 리뷰노트 벤치마크 — "가능 요일" 대응) — 가능 요일·시간대 등 자유 텍스트.
  // 상세 배너·발급 시트에 노출. reservationRequired 캠페인 전용 (선택 입력, 최대 80자).
  reservationNote?: string;
  // 배송형 상품 옵션 (2026-07-16 리뷰노트 벤치마크) — 색상·구성 등 최대 5개.
  // 설정 시 신청에서 택1 필수 (Pass.shipping.option) — 발송 목적으로 발송 큐에 표시.
  productOptions?: string[];
  // 캠페인 사진 (2026-07-17 회의) — [0]=플레이스 대표 이미지 + 사장님 추가 사진.
  // 생성 시 3~20장 필수 (클라이언트 리사이즈 dataURL 또는 URL). 미보유 구 시드는
  // photosForCampaign 폴백(대표 1 + 결정론 2장)으로 렌더.
  photos?: string[];
}

// 예약형 방문 일정 (2026-07-16 리뷰노트 벤치마크 · v2 제안 플로우 — 정본: 운영정책서 §15, src/lib/reservation.ts)
// 예약은 참여 승인/선정이 아니라 "일정 조율"이다 — 사장님의 일방 거절/취소는 없다(P1).
// 사장님은 [예약 확인] 또는 [다른 시간 제안]만 가능하고, 취소 결정권은 체험자에게 있다
// (제안 거절 = 체험자 취소 — 패널티·재신청 제한 없음).
// **QR·사용 처리는 예약 확정(confirmed) 후에만 열린다** (2026-07-16 회의 — 확정 전 QR 미노출).
export interface PassReservation {
  date: string; // "YYYY-MM-DD" (KST) — 체험자 희망(또는 확정) 일시
  time: string; // "HH:mm" — RESERVATION_TIME_SLOTS 중 하나 (기타 직접 입력 포함)
  // 방문 인원수 (2026-07-17 회의 — 신청 시 필수, 사장님 예약 큐에 표시)
  partySize?: number;
  status: "requested" | "proposed" | "confirmed"; // 확인 대기 / 사장님 대안 제안(응답 대기) / 확정
  requestedAt: number;
  confirmedAt?: number;
  // 사장님 대안 제안 — 슬롯 최대 3개 + 수기 안내사항(선택지가 더 필요하거나 추가 안내 시).
  // 체험자는 슬롯 수락(=확정) / 기타 일시 직접 입력(=재제안, 1회) / 거절(=취소) 중 선택한다.
  proposal?: {
    slots: Array<{ date: string; time: string }>; // 0~3개 (0개면 안내사항 필수)
    note?: string; // 수기 안내사항 — 체험자 화면에 그대로 노출 (최대 200자)
    proposedAt: number;
  };
  // 협상 히스토리 (2026-07-16 v3) — 양측 화면에 타임라인으로 노출되는 append-only 로그.
  // 제안 횟수 판정의 정본: 사장님 propose 1회 · 체험자 counter 1회 (reservation.ts 헬퍼).
  history?: ReservationEvent[];
}

// 예약 협상 이벤트 — request(체험자 희망/변경) → propose(사장님 대안, 1회) →
// counter(체험자 재제안, 1회) → confirm/accept(확정) 또는 decline(거절 = 취소, 패널티 없음)
export interface ReservationEvent {
  at: number;
  by: "reviewer" | "owner";
  kind: "request" | "propose" | "counter" | "confirm" | "accept" | "decline";
  date?: string; // request/counter/confirm/accept의 일시
  time?: string;
  slots?: Array<{ date: string; time: string }>; // propose 전용
  note?: string; // propose 안내사항
}

// 배송형 신청 시 체험자가 입력하는 배송지 — 발송 목적 한정으로 사장님에게 노출된다
// (확정 정책 8 익명 원칙의 명시적 예외 — 등급은 계속 비노출. 데이터정책서 §1.0b).
export interface ShippingInfo {
  recipient: string; // 수령인 이름
  phone: string;
  address: string;
  // 선택한 상품 옵션 — campaign.productOptions 중 하나 (옵션 캠페인은 필수, 2026-07-16)
  option?: string;
}

export type PassStatus =
  | "active" // 72시간(발급 후) 카운트다운 중
  | "used" // QR 스캔 완료 → 리뷰 대기
  | "review_submitted" // 리뷰 등록됨, 검수 대기
  | "completed" // 검수 완료
  | "expired" // 72시간 경과 미사용 (모집 슬롯 복구됨 · 연장/복구 불가)
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
  // 취소 경위 — "proposal_declined" = 사장님 시간 제안 거절로 인한 취소 (2026-07-16 v2).
  // 이 취소는 패널티·12h 재신청 제한을 적용하지 않는다 (일정이 맞지 않은 것일 뿐).
  cancelledVia?: "proposal_declined";
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
  completedAt?: number; // 운영팀 검수 승인 시각 — 월간 재평가의 완료·상생 집계 귀속 기준
  // 라이프사이클 스윕 중복 방지 플래그
  overdueHandled?: boolean; // 리뷰 기한(이용 후 7일) 초과 처리 완료
  expiringSoonNotified?: boolean; // 만료 6시간 전 알림 발송 완료
  reviewDueSoonNotified?: boolean; // 리뷰 마감 24시간 전 알림 발송 완료
  // 4자리 사용처리 코드 오입력 가드 — 연속 5회 실패 시 3분 잠금 (브루트포스 방지, 2026-07-12 §9-2)
  useCodeFailCount?: number; // 연속 실패 횟수 (성공 시 리셋)
  useCodeLockUntil?: number; // 잠금 해제 시각 (epoch ms)
  // 게시 유지(90일) 동의 — 리뷰 제출 시 서버가 필수로 검증·보존 (자가점검과 분리된 별도 동의)
  keepAgreed?: boolean;
  // ── 배송형 전용 (2026-07-12) ──
  shipping?: ShippingInfo; // 신청 시 입력한 배송지 (발송 목적 한정 노출)
  shippedAt?: number; // 사장님 발송 처리 시각 (= usedAt과 함께 세팅 — 리뷰 7일 기산점)
  trackingNo?: string; // 운송장 번호 (선택)
  courier?: string; // 택배사 코드 (src/lib/couriers.ts — 체험자 배송 조회 링크용, 2026-07-16)
  // ── 예약형 방문 전용 (2026-07-16 리뷰노트 벤치마크) ──
  // 존재 시 expiresAt = 예약일 당일 말(KST 23:59) — 72h 고정 기한의 명시적 예외.
  reservation?: PassReservation;
  status: PassStatus;
}

// ─────────────────────────────────────────────────────────────
// 포인트 (2026-07-12 레뷰 벤치마크 — docs/벤치마크-레뷰.md §3.1, 정책 정본: 운영정책서 §14)
// 원장은 append-only — 잔액은 합산 파생 (조작 방지·감사 추적). 정책 상수: src/lib/points.ts
// ─────────────────────────────────────────────────────────────

export type PointTxnType =
  | "earn" // 리뷰 검수 승인 적립 (+) — 실제 발생 이벤트만 (P4)
  | "withdraw" // 출금 신청 차감 (−) — 신청 즉시 차감
  | "withdraw_refund"; // 출금 반려 복구 (+)

export interface PointTxn {
  id: string;
  reviewerId: string;
  type: PointTxnType;
  amount: number; // 부호 포함 (earn/refund 양수, withdraw 음수)
  refPassId?: string; // earn — 적립 근거 체험권
  refWithdrawalId?: string; // withdraw / withdraw_refund
  memo: string; // 내역 화면 표기용 (예: "○○ 체험 리뷰 승인")
  createdAt: number;
}

export type WithdrawalStatus = "requested" | "paid" | "rejected";

// 출금 신청 — 신청 시점에 세액·수수료·실지급액을 확정 계산해 보존한다 (세율 변경 소급 방지).
// 실서비스는 원천징수 신고를 위해 실명·주민등록번호 수집이 필요하다 — 프로토타입은 미수집
// (데이터정책서 §1.0b).
export interface WithdrawalRequest {
  id: string;
  reviewerId: string;
  amountPoints: number; // 신청 포인트 (= 과세 대상 지급액, 1P=1원)
  incomeType: "business"; // 사업소득 3.3% 고정 (계속·반복 활동 기준 — 운영정책서 §14)
  taxWithheld: number; // 원천징수세액 (소액부징수 반영)
  fee: number; // 이체 수수료
  payout: number; // 실지급액 = amountPoints − taxWithheld − fee
  bank: string;
  account: string;
  holder: string; // 예금주
  // 계좌 본인 인증 수단 (2026-07-12 고도화) — "openbanking" = KFTC 계좌실명조회로
  // 예금주 대조 완료 / "demo" = 키 미설정 환경의 데모 인증. 인증 없이는 신청 불가.
  accountVerifiedVia?: "openbanking" | "demo";
  status: WithdrawalStatus;
  requestedAt: number;
  processedAt?: number; // 운영팀 지급/반려 처리 시각
  rejectReason?: string;
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
  token: string;          // 8자 영대문자·숫자(31자 charset, 혼동 문자 0/O/1/I/L 제외), /r/i/<token>로 진입
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

// 관심 목록 (2026-07-07 회의) — 매장이 아니라 "캠페인 단위"로 저장.
// 캠페인이 완전히 종료되어도 목록에서 유지하고 '마감된 체험' 표기만 한다
// (소진됐다 살아나는 노출 구조를 만들지 않는다 — 상태는 렌더 시점에 계산).
export interface Interest {
  reviewerId: string;
  campaignId: string;
  createdAt: number;
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
  // ── 관심 목록 (캠페인 단위) ──
  interests?: Interest[];
  // ── 포인트 (2026-07-12 레뷰 벤치마크) ──
  pointTxns?: PointTxn[];
  withdrawals?: WithdrawalRequest[];
  // ──
  seeded: boolean;
  seedVersion?: number; // 시드 스키마 변경 시 bump → 자동 재시드 트리거
  lastRegradeMonth?: string; // 등급 월간 재평가가 완료된 마지막 평가 대상 월 "YYYY-MM" (KST)
  naverDataFetched?: number; // 마지막 Naver Place 자동 갱신 timestamp
}
