// 본 트랙은 기존 src/lib/types.ts를 import하지 않는다 — 의도적으로 격리.
// 향후 어댑터 머지 시점에 mapping 함수만 작성.

export type UserKind = "reviewer" | "owner";
export type BoxGrade = "basic" | "silver" | "gold";

export interface ViralUser {
  id: string;
  role: UserKind;
  nickname: string;
  storeName?: string; // owner only
  inviteStats: {
    sent: number;
    accepted: number;
    boxGrade: BoxGrade;
    cumulativeBoxReward: number;
  };
  rewards: Reward[];
  createdAt: number;
  /**
   * 외부(메인 catchpass) 시스템에서 알려준 "신호" — 본 트랙에서는 mock 트리거.
   * 트리거 발생 시 noticeId를 늘려서 UI가 상단 카드를 띄움.
   */
  pendingTrigger?: TriggerEvent | null;
}

export type TriggerEventKind =
  | "T1_pass_used"
  | "T2_review_completed"
  | "T3_grade_up"
  | "T4_campaign_created"
  | "T5_owner_scan_done";

export interface TriggerEvent {
  kind: TriggerEventKind;
  contextLabel: string;
  amount?: number; // 예: 절약 지원금
  createdAt: number;
}

export type InviteStatus = "issued" | "clicked" | "signed_up" | "expired";

export interface Invite {
  token: string;
  referrerId: string;
  referrerKind: UserKind;
  targetKind: UserKind;
  storeId?: string;
  channel?: ShareChannel;
  status: InviteStatus;
  createdAt: number;
  expiresAt: number;
  consumedAt?: number;
  consumedBy?: string;
}

export type ShareChannel = "kakao" | "sms" | "instagram_dm" | "copy_link";

export type RewardKind =
  | "cash" // 보너스 캐시
  | "support_bonus_pct" // 첫 캠페인 지원금 +N%
  | "membership_discount" // 사장님 멤버십 할인 1만원
  | "quota_bonus" // 캠페인 모집 한도 +N팀
  | "spotlight_pass"; // 시그니처 우선 노출권

export interface Reward {
  id: string;
  ownerUserId: string;
  source: "referrer_box" | "referee_welcome" | "milestone";
  kind: RewardKind;
  value: number;
  issuedAt: number;
  expiresAt: number;
  usedAt?: number;
  meta?: Record<string, unknown>;
}

export interface CounterSnapshot {
  date: string; // YYYY-MM-DD
  todayBoxCount: number;
  todayAvgReward: number;
  liveStream: Array<{ nickname: string; reward: number; ts: number; matrix: MatrixKey }>;
}

// Two-sided matrix
export type MatrixKey = "RR" | "RO" | "OR" | "OO";
export function matrixOf(referrerKind: UserKind, targetKind: UserKind): MatrixKey {
  if (referrerKind === "reviewer" && targetKind === "reviewer") return "RR";
  if (referrerKind === "reviewer" && targetKind === "owner") return "RO";
  if (referrerKind === "owner" && targetKind === "reviewer") return "OR";
  return "OO";
}
