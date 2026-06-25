// 바이럴(레퍼럴) 어댑터 라이브러리 — 메인 catchpass에 흡수된 viral 트랙.
// 설계 노트: /docs/viral-test/PRD-viral-referral.md (Toss 6원리 매핑)
// 본 모듈은 DB 객체를 직접 변형(mutate)한다. 호출자는 saveDBAsync로 영속화.

import { randomBytes } from "node:crypto";
import {
  BoxGrade,
  DBShape,
  Invite,
  InviteStats,
  MatrixKey,
  Owner,
  Reviewer,
  Reward,
  RewardKind,
  ShareChannel,
  UserKind,
  ViralCounter,
} from "./types";

const TOKEN_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 헷갈리는 0/O/1/I/L 제외
const INVITE_TTL_DAYS = 14;
const REWARD_TTL_DAYS = 30;
const REFEREE_WELCOME_TTL_DAYS = 14;

// ────────────────────────────────────────────────────────────
// 기초 헬퍼
// ────────────────────────────────────────────────────────────

export function matrixOf(referrerKind: UserKind, targetKind: UserKind): MatrixKey {
  if (referrerKind === "reviewer" && targetKind === "reviewer") return "RR";
  if (referrerKind === "reviewer" && targetKind === "owner") return "RO";
  if (referrerKind === "owner" && targetKind === "reviewer") return "OR";
  return "OO";
}

export function computeBoxGrade(accepted: number): BoxGrade {
  if (accepted >= 5) return "gold";
  if (accepted >= 3) return "silver";
  return "basic";
}

export function defaultInviteStats(): InviteStats {
  return { sent: 0, clicked: 0, accepted: 0, boxGrade: "basic", cumulativeCash: 0 };
}

export function ensureInviteStats<T extends Reviewer | Owner>(user: T): T {
  if (!user.inviteStats) user.inviteStats = defaultInviteStats();
  return user;
}

export function ensureCounter(db: DBShape): ViralCounter {
  if (!db.viralCounter) {
    db.viralCounter = {
      date: new Date().toISOString().slice(0, 10),
      todayBoxCount: 0,
      todayAvgReward: 0,
      liveStream: [],
    };
  }
  return db.viralCounter;
}

function newToken(): string {
  const bytes = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  return s;
}

function rid(prefix: string): string {
  const bytes = randomBytes(6);
  let s = "";
  const al = "abcdefghjkmnpqrstuvwxyz23456789";
  for (let i = 0; i < bytes.length; i++) s += al[bytes[i] % al.length];
  return `${prefix}_${s}`;
}

// ────────────────────────────────────────────────────────────
// 토큰 발급 (T1~T5 트리거 + /r/invite/new 진입에서 호출)
// ────────────────────────────────────────────────────────────

export function createInvite(
  db: DBShape,
  args: {
    referrerId: string;
    referrerKind: UserKind;
    targetKind: UserKind;
    storeId?: string;
    campaignId?: string;
    channel?: ShareChannel;
  },
): Invite {
  if (!db.invites) db.invites = [];
  // 발신자 stats 갱신
  if (args.referrerKind === "reviewer") {
    const u = db.reviewers.find((r) => r.id === args.referrerId);
    if (u) ensureInviteStats(u).inviteStats!.sent += 1;
  } else {
    const u = db.owners.find((o) => o.id === args.referrerId);
    if (u) ensureInviteStats(u).inviteStats!.sent += 1;
  }
  const now = Date.now();
  const inv: Invite = {
    token: newToken(),
    referrerId: args.referrerId,
    referrerKind: args.referrerKind,
    targetKind: args.targetKind,
    storeId: args.storeId,
    campaignId: args.campaignId,
    channel: args.channel,
    status: "issued",
    createdAt: now,
    expiresAt: now + INVITE_TTL_DAYS * 86_400_000,
  };
  db.invites.unshift(inv);
  return inv;
}

export function markInviteClicked(db: DBShape, token: string): Invite | null {
  if (!db.invites) return null;
  const inv = db.invites.find((i) => i.token === token);
  if (!inv) return null;
  if (inv.status === "issued") {
    inv.status = "clicked";
    if (inv.referrerKind === "reviewer") {
      const u = db.reviewers.find((r) => r.id === inv.referrerId);
      if (u) ensureInviteStats(u).inviteStats!.clicked += 1;
    } else {
      const u = db.owners.find((o) => o.id === inv.referrerId);
      if (u) ensureInviteStats(u).inviteStats!.clicked += 1;
    }
  }
  return inv;
}

// ────────────────────────────────────────────────────────────
// 토큰 수락 — 신규 가입과 동시에 양면 보상 발행
//   (회원가입은 /api/auth/signup이 처리하고, 그 후 본 함수를 호출)
// ────────────────────────────────────────────────────────────

const REFEREE_REWARD_TABLE: Record<MatrixKey, {
  mainKind: RewardKind;
  mainValue: number;
  bonusCashRange: [number, number];
}> = {
  RR: { mainKind: "support_bonus_pct", mainValue: 50, bonusCashRange: [1000, 5000] },
  RO: { mainKind: "membership_discount", mainValue: 50, bonusCashRange: [2000, 8000] },
  OR: { mainKind: "support_bonus_pct", mainValue: 50, bonusCashRange: [1500, 6000] },
  OO: { mainKind: "membership_discount", mainValue: 50, bonusCashRange: [3000, 10000] },
};

export interface AcceptResult {
  referrerReward: Reward;
  refereeMainReward: Reward;
  refereeBonusReward: Reward;
}

export function acceptInvite(
  db: DBShape,
  args: { token: string; refereeId: string; refereeKind: UserKind },
): { ok: false; error: string } | { ok: true; result: AcceptResult } {
  if (!db.invites) db.invites = [];
  if (!db.rewards) db.rewards = [];
  const inv = db.invites.find((i) => i.token === args.token);
  if (!inv) return { ok: false, error: "토큰을 찾을 수 없습니다" };
  if (inv.status === "signed_up") return { ok: false, error: "이미 사용된 초대입니다" };
  if (inv.status === "expired" || Date.now() > inv.expiresAt) {
    inv.status = "expired";
    return { ok: false, error: "만료된 초대입니다" };
  }
  if (inv.referrerId === args.refereeId) return { ok: false, error: "본인의 초대는 사용할 수 없습니다" };
  if (inv.targetKind !== args.refereeKind) {
    return { ok: false, error: `이 초대는 ${inv.targetKind === "owner" ? "사장님" : "체험자"} 가입에만 사용할 수 있습니다` };
  }

  // 토큰 소비
  inv.status = "signed_up";
  inv.consumedAt = Date.now();
  inv.consumedBy = args.refereeId;

  const m = matrixOf(inv.referrerKind, inv.targetKind);

  // 발신자 stats 갱신
  const referrer = inv.referrerKind === "reviewer"
    ? db.reviewers.find((r) => r.id === inv.referrerId)
    : db.owners.find((o) => o.id === inv.referrerId);
  if (referrer) {
    ensureInviteStats(referrer);
    referrer.inviteStats!.accepted += 1;
    referrer.inviteStats!.boxGrade = computeBoxGrade(referrer.inviteStats!.accepted);
  }

  // 추천자 행운 박스 보상 발행 (가변 캐시 또는 멤버십/quota 보너스)
  const referrerReward = issueReferrerReward(db, inv.referrerKind, inv.referrerId, m, referrer?.inviteStats?.accepted ?? 1);
  if (referrer?.inviteStats && referrerReward.kind === "cash") {
    referrer.inviteStats.cumulativeCash += referrerReward.value;
  }

  // 피추천자 환영 박스 보상 발행 (확정 + 가변 캐시)
  const refereeMain = issueRefereeMainReward(db, args.refereeId, m);
  const refereeBonus = issueRefereeBonusReward(db, args.refereeId, m);

  // 라이브 카운터 갱신
  const counter = ensureCounter(db);
  const refereeNickname = args.refereeKind === "owner"
    ? db.owners.find((o) => o.id === args.refereeId)?.storeName || "신규 매장"
    : db.reviewers.find((r) => r.id === args.refereeId)?.nickname || "신규 체험자";
  counter.liveStream.unshift({
    nickname: refereeNickname,
    reward: refereeMain.kind === "cash" ? refereeMain.value : refereeBonus.value,
    ts: Date.now(),
    matrix: m,
  });
  counter.todayBoxCount += 2; // 양측 박스 2개
  if (counter.liveStream.length > 8) counter.liveStream.length = 8;

  return {
    ok: true,
    result: { referrerReward, refereeMainReward: refereeMain, refereeBonusReward: refereeBonus },
  };
}

// 추천자 행운 박스 — 박스 등급에 따른 가변 캐시(체험자) 또는 사장님 전용 보상
function issueReferrerReward(
  db: DBShape,
  referrerKind: UserKind,
  referrerId: string,
  m: MatrixKey,
  accepted: number,
): Reward {
  let kind: RewardKind;
  let value: number;
  if (referrerKind === "owner" && (m === "OO" || m === "OR")) {
    if (m === "OO") {
      kind = "membership_discount";
      value = 10000; // ₩10,000 다음 결제 할인
    } else {
      kind = "quota_bonus";
      value = 3; // 캠페인 모집 한도 +3팀
    }
  } else {
    const grade = computeBoxGrade(accepted);
    const range: [number, number] = grade === "gold" ? [8000, 20000] : grade === "silver" ? [3000, 8000] : [1000, 3000];
    value = Math.floor(range[0] + Math.random() * (range[1] - range[0]));
    kind = "cash";
  }
  const r: Reward = {
    id: rid("rwd"),
    ownerUserId: referrerId,
    source: "referrer_box",
    kind,
    value,
    issuedAt: Date.now(),
    expiresAt: Date.now() + REWARD_TTL_DAYS * 86_400_000,
    meta: { matrix: m, accepted },
  };
  if (!db.rewards) db.rewards = [];
  db.rewards.unshift(r);
  return r;
}

function issueRefereeMainReward(db: DBShape, refereeId: string, m: MatrixKey): Reward {
  const table = REFEREE_REWARD_TABLE[m];
  const r: Reward = {
    id: rid("rwd"),
    ownerUserId: refereeId,
    source: "referee_welcome",
    kind: table.mainKind,
    value: table.mainValue,
    issuedAt: Date.now(),
    expiresAt: Date.now() + REFEREE_WELCOME_TTL_DAYS * 86_400_000,
    meta: { matrix: m },
  };
  if (!db.rewards) db.rewards = [];
  db.rewards.unshift(r);
  return r;
}

function issueRefereeBonusReward(db: DBShape, refereeId: string, m: MatrixKey): Reward {
  const range = REFEREE_REWARD_TABLE[m].bonusCashRange;
  const value = Math.floor(range[0] + Math.random() * (range[1] - range[0]));
  const r: Reward = {
    id: rid("rwd"),
    ownerUserId: refereeId,
    source: "referee_welcome",
    kind: "cash",
    value,
    issuedAt: Date.now(),
    expiresAt: Date.now() + REWARD_TTL_DAYS * 86_400_000,
    meta: { matrix: m, isBonus: true },
  };
  if (!db.rewards) db.rewards = [];
  db.rewards.unshift(r);
  return r;
}

// ────────────────────────────────────────────────────────────
// 카운터 (라이브 N명 + 평균)
// ────────────────────────────────────────────────────────────

export function snapshotCounter(db: DBShape): ViralCounter {
  return ensureCounter(db);
}

// 라이브 ticker noise — 데모용 (실시간감 부여). 호출자가 1초 주기로 GET하면 매번 약간 다른 숫자가 보임.
export function counterWithNoise(db: DBShape): ViralCounter {
  const c = ensureCounter(db);
  // 매 호출 시 deterministic이 아니라 약간 변동 — 보존은 하지 않음
  const today = new Date().toISOString().slice(0, 10);
  if (c.date !== today) {
    c.date = today;
    c.todayBoxCount = 1200 + Math.floor(Math.random() * 100); // 기본 트래픽 시뮬
  }
  c.todayBoxCount += Math.floor(Math.random() * 3);
  c.todayAvgReward = Math.max(1000, (c.todayAvgReward || 4250) + Math.floor(Math.random() * 200 - 100));
  return { ...c, liveStream: c.liveStream.slice(0, 6) };
}

// 보상 라벨 (UI 공용)
export function rewardLabel(r: Reward): string {
  switch (r.kind) {
    case "cash": return `보너스 캐시 ₩${r.value.toLocaleString()}`;
    case "support_bonus_pct": return `첫 캠페인 지원금 +${r.value}%`;
    case "membership_discount": return r.value <= 100 ? `멤버십 ${r.value}% 할인` : `멤버십 ₩${r.value.toLocaleString()} 할인`;
    case "quota_bonus": return `캠페인 모집 한도 +${r.value}팀`;
    case "spotlight_pass": return `시그니처 우선 노출권 ${r.value}회`;
  }
}

export function rewardEmoji(r: Reward): string {
  switch (r.kind) {
    case "cash": return "💵";
    case "support_bonus_pct": return "💰";
    case "membership_discount": return "💎";
    case "quota_bonus": return "📈";
    case "spotlight_pass": return "✨";
  }
}

// 매트릭스 미리보기 카피 (피추천자가 받을 보상)
export function refereePreview(m: MatrixKey): string {
  switch (m) {
    case "RR": return "첫 캠페인 지원금 +50% 쿠폰";
    case "RO": return "첫 달 멤버십 50% 할인";
    case "OR": return "이 매장 첫 캠페인 +50% 지원금";
    case "OO": return "사장님 동료 가입 첫 달 멤버십 50% 할인";
  }
}
