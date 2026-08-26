// 등급 6단계 (2026-08-06 개편) — S+ = 계정(표기) 등급 전용(채널 등급 상한은 S,
// 조건: 채널 최고 등급 S + 성실 이행 만점 + 상생 만점 + 패널티 0 — grade-regrade sweep 판정).
// N = 채널 미연동 전용 상태 — 채널을 연동하면 최하라도 C.
export type Grade = "S+" | "S" | "A" | "B" | "C" | "N";

// 연동 가능한 채널은 네이버 블로그 / 인스타그램 / 틱톡 3종으로 한정 (v2.16)
export type SnsKind = "naver_blog" | "instagram" | "tiktok";

export interface SnsAccount {
  kind: SnsKind;
  url: string;
  influence: number; // 일 방문자(블로그 visitor_trend.current)/팔로워 자연수 (2026-07-28 확정)
  // ── 본인 소유 검증 (2026-07-10 신설) ──
  // 가입 자기신고분은 미검증(undefined). OAuth(네이버/페이스북/틱톡 로그인) 또는
  // 데모 검증(키 미설정 환경 시연용)으로 검증되면 아래 필드가 채워진다.
  // OAuth 액세스 토큰은 저장하지 않는다 — 검증 직후 폐기 (개인정보 최소 수집).
  verified?: boolean;
  verifiedAt?: number;
  verifiedVia?: "oauth" | "demo" | "bio"; // bio = 소개글 인증코드 검증 (2026-07-25 개편)
  // 네이버 블로그 한정 — 자체 등급평가 API(blog-analyzer)가 산정한 등급 (2026-07-25).
  // 설정 시 channelGradesFromSns가 영향력 공식 대신 이 값을 사용한다. total_visitors는 influence에 저장.
  apiGrade?: Grade;
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
  // 상생 중립 (2026-08-05 D3) — 당월 결제 표본 0건(배송형 전용 등): W를 평가에서 제외하고
  // GS = (0.70·I + 0.20·F) / 0.90 − P 로 재정규화 (W=0을 그대로 넣어 구조 손실 주지 않음)
  wNeutral?: boolean;
  skipped?: boolean; // 당월 이벤트 0건 — 등급 유지, 기록만
  // @deprecated 6단계 개편(2026-08-06)으로 S 자동 평가 도입 — 신규 기록 중단, 과거 이력 호환용 유지
  sCandidate?: boolean;
  winWinQualified?: boolean; // 당월 상생 리뷰어 기준(W≥60 & 완료 3건↑) 충족 여부
  at: number; // 재평가 실행 시각
}

export interface Reviewer {
  id: string;
  email: string;
  passwordHash: string;
  // ── 휴대폰 번호 (2026-07-23 — 체험자 계정 PK) ──
  // 가입 시 인증번호 검증 필수(src/lib/phone-verify.ts), 번호당 계정 1개(중복 가입 차단).
  // 알림톡 발송 기반(운영정책서 §15.7). 구버전(도입 전 가입) 계정은 undefined 허용.
  phone?: string; // 숫자만 "01012345678"
  phoneVerifiedAt?: number;
  // 간편로그인 프로바이더 고유 ID (2026-07-23 — src/lib/social-login.ts, 토큰 미저장)
  social?: { naver?: string; kakao?: string };
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
  marketingAgreedAt?: number; // [선택] 광고성 정보 수신·마케팅 활용 동의 시각 (2026-08-18)
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
  // 프로필 사진 (2026-08-05 — 마이페이지 아바타 꾸미기, dataURL 240px JPEG).
  // 본인 마이페이지 전용 표시 — 사장님·어드민 화면 노출 없음 (§4-5 식별정보 비노출과 무관)
  profileImage?: string;
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
  // 휴대폰 인증 (2026-08-18 가입 개편 — 가입 시 인증 필수, 구버전 계정은 미보유)
  phone?: string;
  phoneVerifiedAt?: number;
  // 계정 성격 (2026-08-18 진위확인 개편) — 사장님(직접 운영) | 마케터(대행 관리), 기본 사장님
  operatorType?: "owner" | "marketer";
  marketingAgreedAt?: number; // [선택] 광고성 정보 수신·마케팅 활용 동의 시각
  inviteStats?: InviteStats; // 사장님도 OR/OO 매트릭스로 추천 발신 가능
  // ── 사업자 인증 (확정 정책 9 — 수기 인증) ──
  // undefined = 인증 제도 도입 전 가입한 구버전 계정 → verified로 간주(폴백).
  // pending 상태에서는 사장님 화면 접근이 인증 대기 화면으로 대체된다 ("인증된 사장님" 권한).
  bizNumber?: string; // 사업자등록번호 10자리 (형식 검증만 — 진위 확인은 운영팀 수기)
  bizStatus?: "pending" | "verified";
  bizVerifiedAt?: number;
  // 대표 매장 (2026-07-31) — 새 캠페인 생성의 매장 리스트 기본 선택.
  // 미지정/소유 아님이면 첫 매장 폴백. 지정은 마이페이지 [매장 정보].
  primaryStoreId?: string;
  // 결제 주기 anchor (2026-08-03 — 정본 src/lib/billing-cycle.ts): 유료 플랜의 최근 결제(플랜
  // 시작/변경) 시각. 미기록(구버전·Free)은 가입일(createdAt) 폴백 — Free 주기 = 가입일 기준.
  planStartedAt?: number;
  // 결제 방식 (2026-08-10 통합 멤버십 설계안 §2① — 월간/연간은 별개 상품이 아니라 결제 방식).
  // 연간 = 10개월분 요금으로 12개월 이용(2개월 무료). 미기록(구버전·Free)은 monthly 간주.
  // 모집 주기(billingCycle)는 결제 방식과 무관하게 월 단위 anchor 그대로 — 연간의 "다음 결제"만 +1년.
  billing?: "monthly" | "yearly";
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
  // 플레이스 첫 썸네일 (2026-07-24 — URL 매장 등록 시 수집). 캠페인 생성 폼의
  // 대표 사진([0]) 프리필과 사진 미등록 캠페인 카드 폴백에 사용.
  thumbnailUrl?: string;
}

// delivery(배송형)는 레뷰 벤치마크 반영(2026-07-12, docs/벤치마크-레뷰.md) —
// 상품을 택배로 수령해 체험 후 리뷰. 지역 무관 전국 참여, 발송 처리 후 리뷰 7일.
// press(기자단)는 이 릴리스 브랜치에서 제거 (2026-07-23 — dev 브랜치에서만 유지)
export type CampaignKind = "visit" | "delivery";

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
  authorityConfirmedAt?: number; // [필수] 매장 운영 권한 확인 동의 시각 (2026-07-28 — 증적)
  supportAmount: number; // 방문형 지원금 한도
  quota: CampaignGradeQuota;
  used: { S: number; A: number; B: number; C: number };
  requiredChannels: SnsKind[];
  requiredMenus: RequiredMenu[];
  description: string; // 매장 소개 (최대 500자)
  // 사장님이 후기에 강조해주길 원하는 키워드 — 체험 매장 상세에 노출 (v2.16)
  highlightKeywords?: string[];
  createdAt: number;
  // 조기 종료 (2026-07-24) — 사장님/운영자가 종료 시각을 앞당긴 기록.
  // 종료 판정은 언제나 endAt 기준 (조기 종료 = endAt을 현재로 당김) — 이 필드는 표기·감사용.
  closedAt?: number;
  closedBy?: "owner" | "admin";
  // 사장님이 캠페인 생성 시 지정하는 사용처리 4자리 숫자 코드 (체험권 인증용 비밀번호).
  // 체험자 화면에는 노출되지 않는다 — 사장님이 체험자의 체험권 화면 입력란에 직접 입력해 사용 처리.
  useCode: string; // "0000" ~ "9999"
  // ── 배송형(delivery) 전용 (2026-07-12 레뷰 벤치마크) ──
  // 리뷰 검수 승인 시 지급하는 체험 포인트(1P=1원). 실제 지급액은 참여 채널 등급 배율 적용
  // (P1: 등급은 혜택 크기) — src/lib/points.ts pointsForGrade. 0/미설정 = 제품만 제공.
  pointReward?: number;
  // 상품 카테고리 — 배송형은 매장이 아닌 "특정 스토어의 상품"이 대상이라 플레이스
  // 카테고리(카페·식당 등)와 맥락이 다르다. src/lib/delivery-categories.ts 목록의 값 (배송형 필수).
  productCategory?: string;
  // ── 방문형 예약 옵션 (예약형 — 2026-07-22 작업 리스트 1-1에서 독립 유형으로 승격) ──
  // true면 상세·체험권에 예약형 배지 + 예약 신청 플로우. 선정 절차는 두지 않는다(즉시 발급 유지).
  reservationRequired?: boolean;
  // 예약 운영 스케줄 (2026-07-22 예약형 체험 시스템 — 정본: 운영정책서 §15, src/lib/reservation.ts).
  // 예약형(reservationRequired) 전용. 미설정 구버전 캠페인은 reservation.ts 기본 스케줄로 해석.
  reservationSchedule?: ReservationSchedule;
  // 사장님 일정 차단 (2026-07-22) — 날짜/시간 차단·당일 일시중지. 예약형 전용 (방문형 미제공 — 6-4).
  reservationBlocks?: ReservationBlocks;
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

// 예약 운영 스케줄 (2026-07-22 예약형 체험 시스템 작업 리스트 §2)
// MVP: 선택한 모든 운영 요일에 동일한 운영시간 적용 (요일별 상이 운영시간은 후속 고도화 — 2-3).
// 브레이크 타임은 단일 구간만 지원 (복수 구간은 후속 확인 — 2-4).
export interface ReservationSchedule {
  days: number[]; // 예약 가능 요일 0(일)~6(토) — 미포함 요일은 신청 불가
  open: string; // 운영 시작 "HH:mm" (30분 단위)
  close: string; // 운영 종료 "HH:mm" — "24:00" 허용 (24시간 매장: 00:00~24:00)
  breakStart?: string; // 브레이크 타임 시작 (선택 — 해당 구간 슬롯은 비활성 표시)
  breakEnd?: string;
  // 예약 가능 시작일 (epoch) — 캠페인 공개일과 구분 (2-5). 신청 게이트가 아니라 방문 날짜 하한
  // (2026-07-23 정정 — 캘린더에서 이전 날짜만 비활성). 2026-08-03: 예약형은 오픈 당일 방문 예약
  // 불가 — 실제 하한은 max(opensAt, 오픈일+1)(reservationOpenDate), 미설정 시 오픈일+1(내일)부터.
  opensAt?: number;
  // 같은 시간대 동시 예약 가능 팀 수 (§13 확정 필요 A 기본안 — 1~5, 기본 1팀).
  // 취소·거절·만료 시 정원은 자동 복구된다 (점유 = 살아있는 예약 패스 수 집계 — 별도 원장 없음).
  slotCapacity?: number;
}

// 사장님 일정 차단 (2026-07-22 §6) — 예약형 전용. 차단해도 기존 확정 예약은 자동 취소하지 않는다.
export interface ReservationBlocks {
  dates?: string[]; // 차단 날짜 "YYYY-MM-DD" — 해당 날짜 전체 비활성
  slots?: Array<{ date: string; time: string }>; // 특정 날짜의 특정 시간만 차단
  // 당일 예약 일시중지 — 값이 오늘(KST)과 같을 때만 유효 → 자정이 지나면 자연 해제 (6-3).
  pausedDate?: string;
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
  // 예약 대기 중 희망 일정 변경 1회 소진 여부 (2026-07-22 §3-3 — 무제한 변경 금지).
  // 사장님 제안 후 '기타 재제안'(counter 1회)과는 별개 카운트 (§3-3 정책 확인 → 별개로 확정).
  changeUsed?: boolean;
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
  // 영수증 리뷰 참여(2026-08-07)는 모집 인원을 차감하지 않으므로 이 필드가 없다(복구도 없음).
  consumedSlot?: "S" | "A" | "B" | "C";
  issuedAt: number;
  expiresAt: number;
  usedAt?: number;
  cancelledAt?: number; // 취소 시각
  // 취소 경위 (2026-07-22 §5-4 — 운영/CS 화면은 주체를 구분, 체험자 화면은 '취소' + 서브 문구).
  //  - undefined            : 체험자 직접 취소 — 12h 재신청 제한 적용 (유일하게 쿨다운이 걸리는 경위)
  //  - "proposal_declined"  : 체험자가 사장님 시간 제안을 거절 (2026-07-16 v2)
  //  - "owner_declined"     : 사장님이 미확정 예약 요청을 **명시적으로** 거절 (5-1)
  //  - "auto_unconfirmed"   : 방문 희망 시각까지 미확정 — 스윕 자동 취소 (§13-B, 2026-08-11 분리:
  //                           구 owner_declined 재사용 시 "사장님이 취소했어요"로 읽혀 취소 아닌
  //                           단순 미확정으로 오인되던 표기 문제 — 전용 카피로 구분)
  //  - "owner_cancelled"    : 사장님이 확정된 예약을 취소 (5-3 — cancelReason 필수)
  //  - "admin_cancelled"    : 운영자 수동 취소 (13-1)
  // undefined 외 모든 경위는 패널티·12h 재신청 제한을 적용하지 않는다 (체험자 귀책 아님).
  cancelledVia?: "proposal_declined" | "owner_declined" | "auto_unconfirmed" | "owner_cancelled" | "admin_cancelled" | "campaign_closed";
  // 사장님 확정 취소 사유 코드 (2026-08-04 — 4지선다+직접 입력 데이터화, 어드민 통계용.
  // 정본 라벨·정제 안내 문구: src/lib/reservation.ts OWNER_CANCEL_REASONS. custom이면
  // cancelReason에 직접 입력 원문, 그 외에는 라벨이 저장된다)
  cancelReasonCode?: "time_error" | "party_error" | "menu_unavailable" | "store_issue" | "custom";
  // 사장님(확정 취소)·운영자 취소 사유 — 체험자 화면에 그대로 노출 (5-3)
  cancelReason?: string;
  paidAmount?: number;
  supportApplied?: number;
  // 초대 보상(지원금 부스트)이 사용 처리에 적용된 경우 기록
  supportBoostPct?: number;
  boostRewardId?: string;
  // 영수증 리뷰 참여 (2026-08-07 — SNS 미연동(N) 참여 경로, 방문형 전용): SNS 채널 대신
  // 매장 영수증 리뷰를 작성한다. reviewChannel 없음 · reviewerGrade N(10%) · 제출 = 캡처 업로드.
  receiptReview?: boolean;
  reviewSubmittedAt?: number;
  reviewUrl?: string;
  // @deprecated 영수증 리뷰 제출물(캡처 dataURL) — 2026-08-07 당일 개정으로 URL 제출로 전환
  // (reviewUrl 공통 사용). 신규 기록 중단 — 구 제출분 표시 호환용만 유지.
  reviewImage?: string;
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
  expiringSoonNotified?: boolean; // 만료 임박 알림 발송 완료 (방문형 6h 전 · 예약 확정형 24h 전)
  reviewDueSoonNotified?: boolean; // 리뷰 마감 24시간 전 알림 발송 완료
  // ── 예약 관련 리마인드 플래그 (2026-07-22 §11-3, §13-B) ──
  ownerRemindNotified?: boolean; // 예약 요청 24시간 무응답 — 사장님 리마인드 발송 완료
  visitRemindNotified?: boolean; // 확정 예약 방문 전날 — 체험자 리마인드 발송 완료
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
// 모집 한도 리필권 (2026-07-31 BM 전략안 · 2차 보완 — **쿠폰형**, append-only 원장).
// 구매 = 쿠폰 발급(자동 적용 아님) — [지금 쓰기]/[나중에 쓰기]. 미사용 쿠폰은 쿠폰함에 보관.
// **사용 시점**에 그 결제 주기(캘린더 월 KST) 한도에 가산되고, 사용한 주기까지만 유효
// (가산분 이월 불가 — 미사용 쿠폰 자체는 보관 유지). amount는 구매 시점 플랜 기준 고정.
export interface LimitRefill {
  id: string;
  ownerId: string;
  plan: Owner["plan"]; // 구매 시점 플랜 (지급 수량 근거·지표용)
  amount: number; // 사용 시 추가되는 모집 한도 (= 구매 시점 플랜의 월 한도)
  price: number; // 결제 금액 (현행 12,900원 — 청구·지표용 스냅샷)
  purchasedAt: number;
  usedAt?: number; // 사용 시각 — 미설정 = 보유 중(쿠폰함)
  usedMonth?: string; // 사용(적용)된 결제 주기 "YYYY-MM" (KST) — 이 달의 한도에만 가산
}

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

// 웹푸시 구독 (2026-08-13 — 실제 모바일 웹푸시, 정본 src/lib/push.ts)
// 브라우저 PushSubscription을 계정에 귀속 저장. endpoint가 고유 키(기기·브라우저 단위) —
// 같은 계정이 여러 기기를 구독할 수 있고, 발송 실패(404/410 = 만료) 시 자동 정리된다.
export interface PushSub {
  id: string;
  userId: string;
  role: "reviewer" | "owner";
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: number;
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
  // ── 모집 한도 리필권 (2026-07-31 BM 전략안 — 정본 src/lib/limit-refill.ts) ──
  limitRefills?: LimitRefill[];
  // ── 웹푸시 구독 (2026-08-13 — 정본 src/lib/push.ts) ──
  pushSubs?: PushSub[];
  // ──
  seeded: boolean;
  seedVersion?: number; // 시드 스키마 변경 시 bump → 자동 재시드 트리거
  lastRegradeMonth?: string; // 등급 월간 재평가가 완료된 마지막 평가 대상 월 "YYYY-MM" (KST)
  naverDataFetched?: number; // 마지막 Naver Place 자동 갱신 timestamp
  // 자가 실행 데이터 패치 적용 이력 (2026-08-07 — src/lib/data-patches.ts) —
  // 시드와 달리 기존 데이터를 지우지 않고 특정 레코드만 보정/추가하는 1회성 마이그레이션
  appliedPatches?: string[];
}
