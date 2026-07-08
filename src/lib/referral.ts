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
  return { sent: 0, clicked: 0, accepted: 0, boxGrade: "basic" };
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

// 피추천자(신규 가입자) 환영 보상 — 모두 실사용 경로가 구현된 종류만.
//  체험자 가입: 첫 체험 지원금 +50% 부스트 / 사장님 가입: 첫 달 멤버십 50% 할인(PG 결제 시 소진)
const REFEREE_REWARD_TABLE: Record<MatrixKey, { mainKind: RewardKind; mainValue: number }> = {
  RR: { mainKind: "support_bonus_pct", mainValue: 50 },
  RO: { mainKind: "membership_discount", mainValue: 50 },
  OR: { mainKind: "support_bonus_pct", mainValue: 50 },
  OO: { mainKind: "membership_discount", mainValue: 50 },
};

// 추천자(체험자) 행운 박스 — 박스 등급별 지원금 부스트 (다음 체험권 사용 시 자동 적용)
const REFERRER_BOOST_BY_GRADE: Record<BoxGrade, number> = { basic: 10, silver: 20, gold: 30 };

export interface AcceptResult {
  referrerReward: Reward;
  refereeReward: Reward;
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

  // 추천자 행운 박스 보상 발행 (지원금 부스트 또는 멤버십/quota 보너스)
  const referrerReward = issueReferrerReward(db, inv.referrerKind, inv.referrerId, m, referrer?.inviteStats?.accepted ?? 1);

  // 피추천자 환영 박스 보상 발행
  const refereeReward = issueRefereeReward(db, args.refereeId, m);

  // 라이브 카운터 갱신 — 실제 발생 이벤트만 기록
  const counter = ensureCounter(db);
  const refereeNickname = args.refereeKind === "owner"
    ? db.owners.find((o) => o.id === args.refereeId)?.storeName || "신규 매장"
    : db.reviewers.find((r) => r.id === args.refereeId)?.nickname || "신규 체험자";
  counter.liveStream.unshift({
    nickname: refereeNickname,
    rewardText: rewardLabel(refereeReward),
    ts: Date.now(),
    matrix: m,
  });
  if (counter.liveStream.length > 8) counter.liveStream.length = 8;

  return { ok: true, result: { referrerReward, refereeReward } };
}

// 추천자 행운 박스 — 체험자는 박스 등급별 지원금 부스트, 사장님은 멤버십/quota 보너스
function issueReferrerReward(
  db: DBShape,
  referrerKind: UserKind,
  referrerId: string,
  m: MatrixKey,
  accepted: number,
): Reward {
  let kind: RewardKind;
  let value: number;
  if (referrerKind === "owner") {
    if (m === "OO") {
      kind = "membership_discount";
      value = 10000; // ₩10,000 다음 멤버십 결제 할인 (PG 결제 시 소진)
    } else {
      kind = "quota_bonus";
      value = 3; // 이번 달 캠페인 모집 한도 +3팀
    }
  } else {
    kind = "support_bonus_pct";
    value = REFERRER_BOOST_BY_GRADE[computeBoxGrade(accepted)];
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

function issueRefereeReward(db: DBShape, refereeId: string, m: MatrixKey): Reward {
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

// ────────────────────────────────────────────────────────────
// 카운터 (라이브 N명 + 평균)
// ────────────────────────────────────────────────────────────

// 라이브 카운터 스냅샷 — 오늘 실제 발행된 보상 수만 집계한다.
// (구 counterWithNoise의 조작값 생성은 허위 표시 소지가 있어 VER.1에서 제거됨)
export function snapshotCounter(db: DBShape): ViralCounter {
  const c = ensureCounter(db);
  const today = new Date().toISOString().slice(0, 10);
  const startOfDay = new Date(`${today}T00:00:00`).getTime();
  c.date = today;
  c.todayBoxCount = (db.rewards ?? []).filter((r) => r.issuedAt >= startOfDay).length;
  return { ...c, liveStream: c.liveStream.slice(0, 6) };
}

// 보상 라벨 (UI 공용)
export function rewardLabel(r: Reward): string {
  switch (r.kind) {
    case "support_bonus_pct": return `다음 체험 지원금 +${r.value}% 부스트`;
    case "membership_discount": return r.value <= 100 ? `멤버십 ${r.value}% 할인` : `멤버십 ${r.value.toLocaleString()}원 할인`;
    case "quota_bonus": return `이번 달 모집 한도 +${r.value}팀`;
  }
}

export function rewardEmoji(r: Reward): string {
  switch (r.kind) {
    case "support_bonus_pct": return "💰";
    case "membership_discount": return "💎";
    case "quota_bonus": return "📈";
  }
}

// 매트릭스 미리보기 카피 (피추천자가 받을 보상)
export function refereePreview(m: MatrixKey): string {
  switch (m) {
    case "RR": return "첫 체험 지원금 +50% 부스트";
    case "RO": return "첫 달 멤버십 50% 할인";
    case "OR": return "이 매장 첫 체험 +50% 지원금 부스트";
    case "OO": return "사장님 동료 가입 첫 달 멤버십 50% 할인";
  }
}

// ────────────────────────────────────────────────────────────
// 보상 사용 (redemption) — 발행된 보상이 실제 소비되는 경로
// ────────────────────────────────────────────────────────────

// 사용 가능한 지원금 부스트 — 미사용·미만료 중 가장 큰 것 하나
export function findSupportBoost(db: DBShape, reviewerId: string): Reward | null {
  const now = Date.now();
  const candidates = (db.rewards ?? []).filter(
    (r) => r.ownerUserId === reviewerId && r.kind === "support_bonus_pct" && !r.usedAt && r.expiresAt > now,
  );
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.value - a.value || a.expiresAt - b.expiresAt)[0];
}

// 부스트 적용 지원금 한도 — 등급 한도 × (1+pct), 캠페인 기준 지원금(=S등급 100%)을 넘지 않음. 100원 단위.
export function boostedLimit(baseSupport: number, gradeLimit: number, pct: number): number {
  const boosted = Math.round((gradeLimit * (1 + pct / 100)) / 100) * 100;
  return Math.min(baseSupport, boosted);
}

// 사용 가능한 모집 한도 보너스 합계 (사장님)
export function availableQuotaBonus(db: DBShape, ownerId: string): number {
  const now = Date.now();
  return (db.rewards ?? [])
    .filter((r) => r.ownerUserId === ownerId && r.kind === "quota_bonus" && !r.usedAt && r.expiresAt > now)
    .reduce((sum, r) => sum + r.value, 0);
}

// 플랜 한도 초과분을 quota_bonus로 충당 — 필요한 만큼 보너스를 소진 처리
export function consumeQuotaBonus(db: DBShape, ownerId: string, needed: number): void {
  if (needed <= 0) return;
  const now = Date.now();
  const usable = (db.rewards ?? [])
    .filter((r) => r.ownerUserId === ownerId && r.kind === "quota_bonus" && !r.usedAt && r.expiresAt > now)
    .sort((a, b) => a.expiresAt - b.expiresAt);
  let remaining = needed;
  for (const r of usable) {
    if (remaining <= 0) break;
    r.usedAt = now;
    remaining -= r.value;
  }
}
