/**
 * 인메모리 + localStorage 기반 mock store.
 * 기존 catchpass 시스템과 완전히 분리되어 있다.
 * 향후 어댑터를 통해 메인 src/와 연결될 때, 본 store는 ReferralAdapter 의 *구현*이 된다.
 */
import {
  CounterSnapshot,
  Invite,
  InviteStatus,
  MatrixKey,
  Reward,
  RewardKind,
  ShareChannel,
  TriggerEvent,
  TriggerEventKind,
  UserKind,
  ViralUser,
  matrixOf,
} from "../types";

const LS_KEY = "catchpass.viral.v1";

interface StoreShape {
  users: ViralUser[];
  invites: Invite[];
  rewards: Reward[];
  currentUserId: string | null;
  counter: CounterSnapshot;
}

const BASE62 = "ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz";
function rid(prefix: string, len = 8): string {
  let s = "";
  for (let i = 0; i < len; i++) s += BASE62[Math.floor(Math.random() * BASE62.length)];
  return `${prefix}_${s}`;
}
function token8(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += BASE62[Math.floor(Math.random() * BASE62.length)];
  return s;
}

const NICKS_R = ["북촌리뷰어", "성수파이브", "한남미식가", "강남스시러", "이태원와인러", "압구정뉴비", "연남고수", "잠실펫러버", "역삼치과러", "광화문한방러"];
const STORES = ["한남 코너 다이닝", "성수 베이커리 카페", "압구정 네일 아틀리에", "강남 1:1 PT 스튜디오", "잠실 도그 그루밍", "이태원 와인바", "광화문 한의원", "을지로 아로마 마사지"];

function defaultUsers(): ViralUser[] {
  const now = Date.now();
  return [
    {
      id: "rv_demo_alice",
      role: "reviewer",
      nickname: "앨리스",
      inviteStats: { sent: 2, accepted: 1, boxGrade: "basic", cumulativeBoxReward: 2000 },
      rewards: [],
      createdAt: now - 1000 * 60 * 60 * 24 * 14,
      pendingTrigger: null,
    },
    {
      id: "rv_demo_bob",
      role: "reviewer",
      nickname: "밥",
      inviteStats: { sent: 0, accepted: 0, boxGrade: "basic", cumulativeBoxReward: 0 },
      rewards: [],
      createdAt: now - 1000 * 60 * 60 * 24 * 4,
      pendingTrigger: null,
    },
    {
      id: "ow_demo_clay",
      role: "owner",
      nickname: "클레이",
      storeName: "한남 코너 다이닝",
      inviteStats: { sent: 1, accepted: 0, boxGrade: "basic", cumulativeBoxReward: 0 },
      rewards: [],
      createdAt: now - 1000 * 60 * 60 * 24 * 30,
      pendingTrigger: null,
    },
  ];
}

function defaultCounter(): CounterSnapshot {
  return {
    date: new Date().toISOString().slice(0, 10),
    todayBoxCount: 1283,
    todayAvgReward: 4250,
    liveStream: [
      { nickname: "강남 박OO", reward: 8000, ts: Date.now() - 4_000, matrix: "RR" },
      { nickname: "성수 김OO", reward: 3000, ts: Date.now() - 9_000, matrix: "RR" },
      { nickname: "압구정 정OO 사장님", reward: 10000, ts: Date.now() - 16_000, matrix: "OO" },
    ],
  };
}

function loadShape(): StoreShape {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoreShape;
      if (parsed && Array.isArray(parsed.users)) return parsed;
    }
  } catch {}
  const shape: StoreShape = {
    users: defaultUsers(),
    invites: [],
    rewards: [],
    currentUserId: "rv_demo_alice",
    counter: defaultCounter(),
  };
  return shape;
}

let shape: StoreShape = loadShape();
const listeners = new Set<() => void>();
function emit() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(shape)); } catch {}
  for (const l of listeners) l();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const store = {
  // Read
  getCurrentUser(): ViralUser | null {
    if (!shape.currentUserId) return null;
    return shape.users.find((u) => u.id === shape.currentUserId) ?? null;
  },
  listUsers(): ViralUser[] { return shape.users.slice(); },
  listInvites(): Invite[] { return shape.invites.slice(); },
  listRewards(): Reward[] { return shape.rewards.slice(); },
  getCounter(): CounterSnapshot { return shape.counter; },
  findInvite(token: string): Invite | null {
    return shape.invites.find((i) => i.token === token) ?? null;
  },
  findUser(id: string): ViralUser | null {
    return shape.users.find((u) => u.id === id) ?? null;
  },

  // Auth (mock — switch among demo users)
  setCurrentUser(id: string | null) {
    shape.currentUserId = id;
    emit();
  },

  // Admin / debug
  reset() {
    shape = {
      users: defaultUsers(),
      invites: [],
      rewards: [],
      currentUserId: "rv_demo_alice",
      counter: defaultCounter(),
    };
    emit();
  },

  // Trigger simulation — 외부 메인 catchpass 시스템에서 발생하는 이벤트를 mock
  fireTrigger(userId: string, kind: TriggerEventKind, contextLabel: string, amount?: number) {
    const u = shape.users.find((x) => x.id === userId);
    if (!u) return;
    const evt: TriggerEvent = { kind, contextLabel, amount, createdAt: Date.now() };
    u.pendingTrigger = evt;
    emit();
  },
  clearTrigger(userId: string) {
    const u = shape.users.find((x) => x.id === userId);
    if (!u) return;
    u.pendingTrigger = null;
    emit();
  },

  // Live counter tick — simulates SSE
  tickCounter() {
    const c = shape.counter;
    const inc = 1 + Math.floor(Math.random() * 3);
    c.todayBoxCount += inc;
    // 평균은 가벼운 noise
    c.todayAvgReward = Math.max(1000, c.todayAvgReward + Math.floor(Math.random() * 200 - 100));
    // 가끔 stream에 한 줄 추가
    if (Math.random() < 0.55) {
      const r = Math.floor(1000 + Math.random() * 14000);
      const nickRoll = Math.random();
      const matrixRoll = Math.random();
      const matrix: MatrixKey = matrixRoll < 0.55 ? "RR" : matrixRoll < 0.75 ? "OR" : matrixRoll < 0.92 ? "OO" : "RO";
      const nickname = nickRoll < 0.7
        ? `${["강남","성수","압구정","한남","연남","잠실","이태원","광화문"][Math.floor(Math.random()*8)]} ${"가나다라마바사아자차"[Math.floor(Math.random()*10)]}OO${matrix.includes("O") ? " 사장님" : ""}`
        : `${NICKS_R[Math.floor(Math.random() * NICKS_R.length)]}`;
      c.liveStream.unshift({ nickname, reward: r, ts: Date.now(), matrix });
      if (c.liveStream.length > 8) c.liveStream.length = 8;
    }
    emit();
  },

  // ─────────────────────────────────────────────────────────────
  // 어댑터 인터페이스 구현 (ReferralAdapter)
  // ─────────────────────────────────────────────────────────────

  /**
   * 추천 토큰 발급. UI에서 [친구에게 쏘기] 누른 직후 호출.
   */
  recordInviteSent(args: { referrerId: string; targetKind: UserKind; channel: ShareChannel; storeId?: string }): Invite {
    const u = shape.users.find((x) => x.id === args.referrerId);
    if (!u) throw new Error("referrer not found");
    const inv: Invite = {
      token: token8(),
      referrerId: u.id,
      referrerKind: u.role,
      targetKind: args.targetKind,
      storeId: args.storeId,
      channel: args.channel,
      status: "issued",
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 14,
    };
    shape.invites.unshift(inv);
    u.inviteStats.sent += 1;
    emit();
    return inv;
  },

  markInviteClicked(token: string) {
    const inv = shape.invites.find((i) => i.token === token);
    if (!inv) return;
    if (inv.status === "issued") {
      inv.status = "clicked";
      emit();
    }
  },

  /**
   * 신규 가입자가 토큰을 소비하면서 회원이 됨. 양면 보상 즉시 지급.
   */
  recordInviteAccepted(args: {
    token: string;
    refereeRole: UserKind;
    refereeNickname: string;
    refereeStoreName?: string;
  }): { referrerReward: Reward; refereeReward: Reward; refereeUser: ViralUser } | null {
    const inv = shape.invites.find((i) => i.token === args.token);
    if (!inv) return null;
    if (inv.status === "signed_up" || inv.status === "expired") return null;
    if (inv.consumedBy) return null;
    if (Date.now() > inv.expiresAt) {
      inv.status = "expired";
      emit();
      return null;
    }
    const refereeUser: ViralUser = {
      id: rid("user"),
      role: args.refereeRole,
      nickname: args.refereeNickname,
      storeName: args.refereeStoreName,
      inviteStats: { sent: 0, accepted: 0, boxGrade: "basic", cumulativeBoxReward: 0 },
      rewards: [],
      createdAt: Date.now(),
      pendingTrigger: null,
    };
    shape.users.push(refereeUser);
    inv.status = "signed_up";
    inv.consumedAt = Date.now();
    inv.consumedBy = refereeUser.id;

    const referrer = shape.users.find((u) => u.id === inv.referrerId)!;
    referrer.inviteStats.accepted += 1;
    referrer.inviteStats.boxGrade = computeBoxGrade(referrer.inviteStats.accepted);

    const m = matrixOf(inv.referrerKind, inv.targetKind);
    const referrerReward = issueReferrerReward(referrer, m);
    const refereeReward = issueRefereeReward(refereeUser, m);

    referrer.inviteStats.cumulativeBoxReward += referrerReward.kind === "cash" ? referrerReward.value : 0;

    // Live counter에도 흔적 남김
    shape.counter.liveStream.unshift({
      nickname: refereeUser.nickname,
      reward: refereeReward.kind === "cash" ? refereeReward.value : 5000,
      ts: Date.now(),
      matrix: m,
    });
    shape.counter.todayBoxCount += 2; // 양측 2개 박스
    if (shape.counter.liveStream.length > 8) shape.counter.liveStream.length = 8;

    emit();
    return { referrerReward, refereeReward, refereeUser };
  },

  /**
   * 트리거 T1: 패스 사용 후 추천 모듈을 띄울 수 있도록 알림.
   */
  onPassUsed(args: { reviewerId: string; passId: string; savedAmount: number }) {
    this.fireTrigger(args.reviewerId, "T1_pass_used", `방금 ₩${args.savedAmount.toLocaleString()} 절약 (${args.passId})`, args.savedAmount);
  },
  /**
   * 트리거 T4: 사장님 캠페인 생성 직후.
   */
  onCampaignCreated(args: { ownerId: string; campaignId: string }) {
    this.fireTrigger(args.ownerId, "T4_campaign_created", `${args.campaignId} 캠페인 등록 완료`);
  },
  onGradeUp(args: { reviewerId: string; toGrade: string }) {
    this.fireTrigger(args.reviewerId, "T3_grade_up", `${args.toGrade} 등급 진입`);
  },
};

function computeBoxGrade(accepted: number): "basic" | "silver" | "gold" {
  if (accepted >= 5) return "gold";
  if (accepted >= 3) return "silver";
  return "basic";
}

const REFEREE_REWARD_TABLE: Record<MatrixKey, { kind: RewardKind; value: number; bonusCashRange: [number, number] }> = {
  RR: { kind: "support_bonus_pct", value: 50, bonusCashRange: [1000, 5000] },
  RO: { kind: "membership_discount", value: 50, bonusCashRange: [2000, 8000] },
  OR: { kind: "support_bonus_pct", value: 50, bonusCashRange: [1500, 6000] },
  OO: { kind: "membership_discount", value: 50, bonusCashRange: [3000, 10000] },
};

function issueReferrerReward(referrer: ViralUser, m: MatrixKey): Reward {
  const accepted = referrer.inviteStats.accepted;
  const isOwner = referrer.role === "owner";
  let kind: RewardKind = "cash";
  let value = 0;
  if (isOwner && (m === "OO" || m === "OR")) {
    if (m === "OO") {
      kind = "membership_discount";
      value = 10000;
    } else {
      kind = "quota_bonus";
      value = 3;
    }
  } else {
    // reviewer referrer: variable cash by box grade
    const grade = computeBoxGrade(accepted);
    const range = grade === "gold" ? [8000, 20000] : grade === "silver" ? [3000, 8000] : [1000, 3000];
    value = Math.floor(range[0] + Math.random() * (range[1] - range[0]));
    kind = "cash";
  }
  const r: Reward = {
    id: rid("rwd"),
    ownerUserId: referrer.id,
    source: "referrer_box",
    kind,
    value,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30,
    meta: { matrix: m, accepted },
  };
  referrer.rewards.unshift(r);
  shape.rewards.unshift(r);
  return r;
}

function issueRefereeReward(referee: ViralUser, m: MatrixKey): Reward {
  const table = REFEREE_REWARD_TABLE[m];
  const cashValue = Math.floor(table.bonusCashRange[0] + Math.random() * (table.bonusCashRange[1] - table.bonusCashRange[0]));
  // 환영 박스의 메인 보상은 "support_bonus_pct" or "membership_discount" 중 하나.
  // 가변 보너스 캐시는 별도 reward로 발행.
  const r: Reward = {
    id: rid("rwd"),
    ownerUserId: referee.id,
    source: "referee_welcome",
    kind: table.kind,
    value: table.value,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 14,
    meta: { matrix: m },
  };
  const bonus: Reward = {
    id: rid("rwd"),
    ownerUserId: referee.id,
    source: "referee_welcome",
    kind: "cash",
    value: cashValue,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30,
    meta: { matrix: m, isBonus: true },
  };
  referee.rewards.unshift(r);
  referee.rewards.unshift(bonus);
  shape.rewards.unshift(r);
  shape.rewards.unshift(bonus);
  return r;
}

// Live counter ticker — 모든 페이지에서 1초 주기
let counterTimer: ReturnType<typeof setInterval> | null = null;
export function startCounterTicker() {
  if (counterTimer) return;
  counterTimer = setInterval(() => store.tickCounter(), 1500);
}
