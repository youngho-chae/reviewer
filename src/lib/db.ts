import fs from "node:fs";
import path from "node:path";
import { DBShape } from "./types";
import { kvAvailable, kvLoad, kvLoadLegacy, kvSave } from "./kv";
import { sweepPassLifecycle } from "./pass-lifecycle";
import { sweepMonthlyRegrade } from "./grade-regrade";

// 3-단 영속성 계층:
//   1) Vercel KV (Upstash Redis REST API) — 환경변수 있으면 우선 사용 → 멀티 인스턴스 공유 가능
//   2) /tmp JSON 스냅샷 — 단일 인스턴스 내 follow-up 요청 가속용
//   3) 모듈 전역 변수 — 같은 워밍 인스턴스 안에서 가장 빠른 액세스

const SNAPSHOT_PATH = process.env.CATCHPASS_DB_PATH || path.join("/tmp", "catchpass-db.json");

const empty: DBShape = {
  reviewers: [],
  owners: [],
  admins: [],
  stores: [],
  campaigns: [],
  passes: [],
  notifications: [],
  seeded: false,
};

declare global {
  // eslint-disable-next-line no-var
  var __catchpass_db: DBShape | undefined;
}

function loadFromDisk(): DBShape | null {
  try {
    if (fs.existsSync(SNAPSHOT_PATH)) {
      const raw = fs.readFileSync(SNAPSHOT_PATH, "utf-8");
      return JSON.parse(raw) as DBShape;
    }
  } catch {}
  return null;
}

function persist(db: DBShape) {
  try {
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(db), "utf-8");
  } catch {}
}

// 시드 스키마/내용이 변경될 때마다 bump → 기존 DB를 무시하고 재시드.
// 운영 환경에서 KV/디스크에 남아있던 옛 시드를 자동 정리.
// 스토리보드 브랜치(design/storyboard-schema)는 시드 내용이 다르므로 별도 버전(1000+).
// 데모 계정 상생 리뷰어 지정(winWinBadge — 2026-08-07)을 반영하여 1029로 bump.
const SEED_VERSION = 1030;

function ensureSeeded(db: DBShape) {
  // [realtest 2000계열 — 비파괴 원칙 (2026-08-07 사고의 교훈)] 실사용 데이터가 담기는
  // 브랜치에서는 SEED_VERSION bump가 절대 기존 데이터를 지우지 않는다. 최초 부트스트랩
  // (미시드)에만 시드하고, 이후 버전 bump는 seedVersion 갱신만 한다 (시드 = 운영팀 계정뿐
  // 이라 보충할 것도 없음 — 계정이 사라진 비정상 상태만 보충).
  // (실사고: 2001 bump가 ensureSeeded 전체 wipe를 태워 realtest KV의 실사용 DB가 초기화됨)
  const isRealtestSeries = Math.floor(SEED_VERSION / 1000) === 2;
  if (isRealtestSeries && db.seeded) {
    if ((db.seedVersion ?? 0) < SEED_VERSION) {
      if (!db.admins || db.admins.length === 0) {
        // REALTEST 시드는 admins만 세팅하고 반환 — 기존 데이터 무접촉.
        // (runSeed는 db.seeded 가드로 즉시 반환하므로 일시 해제 후 호출)
        db.seeded = false;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { runSeed } = require("./seed-runner");
        runSeed(db);
      }
      db.seedVersion = SEED_VERSION;
    }
    return;
  }
  if (!db.seeded || (db.seedVersion ?? 0) < SEED_VERSION) {
    // 기존 상태 초기화 후 재시드 (데모 시드 계열 전용 — 실사용 계열은 위에서 반환)
    db.reviewers = [];
    db.owners = [];
    db.admins = [];
    db.stores = [];
    db.campaigns = [];
    db.passes = [];
    db.notifications = [];
    db.invites = [];
    db.rewards = [];
    db.viralCounter = undefined;
    db.interests = [];
    db.seeded = false;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { runSeed } = require("./seed-runner");
    runSeed(db);
    db.seedVersion = SEED_VERSION;
  }
}

// ─── 동기 API (로컬/단일 인스턴스 폴백) ───
export function getDB(): DBShape {
  if (!globalThis.__catchpass_db) {
    globalThis.__catchpass_db = loadFromDisk() || { ...empty };
  }
  const db = globalThis.__catchpass_db!;
  ensureSeeded(db);
  // 라이프사이클 스윕이 먼저 — 월 경계 직전 만료 건을 확정한 뒤 월간 재평가를 돌린다.
  // (|| 단락 평가로 재평가가 건너뛰어지지 않도록 각각 실행)
  const swept = sweepPassLifecycle(db);
  const regraded = sweepMonthlyRegrade(db);
  if (swept || regraded) persist(db);
  return db;
}

export function saveDB() {
  const db = getDB();
  persist(db);
}

// ─── 비동기 API (KV 통합) ───
// 항상 최신 KV 데이터를 가져오므로 멀티 인스턴스 환경에서 정합성 보장.
export async function getDBAsync(): Promise<DBShape> {
  if (kvAvailable()) {
    const fresh = await kvLoad<DBShape>();
    if (fresh) {
      globalThis.__catchpass_db = fresh;
      ensureSeeded(fresh);
      const swept = sweepPassLifecycle(fresh);
      const regraded = sweepMonthlyRegrade(fresh);
      const patched = await runDataPatches(fresh);
      if (swept || regraded || patched) {
        await kvSave(fresh);
        persist(fresh);
      }
      await maybeAutoRefresh(fresh);
      return fresh;
    } else {
      // KV(네임스페이스 키) 비어있음 — 레거시 공용 키에서 1회 승계 시도 후 부트스트랩.
      // 승계는 같은 시드 계열(천 단위 — 데모 1000대/realtest 2000대)일 때만: 다른 계열
      // 데이터를 승계하면 seedVersion이 더 높아 재시드가 막히고 이 배포의 시드가 사라진다
      // (2026-07-24 실사고의 재발 방지 — 계열 불일치면 무시하고 새로 시드).
      const legacy = await kvLoadLegacy<DBShape>();
      const sameSeries =
        !!legacy && Math.floor((legacy.seedVersion ?? 0) / 1000) === Math.floor(SEED_VERSION / 1000);
      const db: DBShape = sameSeries ? (legacy as DBShape) : { ...empty };
      ensureSeeded(db);
      sweepPassLifecycle(db);
      sweepMonthlyRegrade(db);
      await kvSave(db);
      persist(db);
      globalThis.__catchpass_db = db;
      await maybeAutoRefresh(db);
      return db;
    }
  }
  // KV 미설정 — sync 폴백 + best-effort refresh
  const db = getDB();
  if (await runDataPatches(db)) persist(db);
  await maybeAutoRefresh(db);
  return db;
}

// 자가 실행 데이터 패치 (2026-08-07 — src/lib/data-patches.ts) — 시드와 달리 비파괴
// 레코드 추가/보정만 수행. 실행 중 중복 방지 in-flight 가드 (요청마다 재진입 금지).
let patchInFlight = false;
async function runDataPatches(db: DBShape): Promise<boolean> {
  if (patchInFlight) return false;
  patchInFlight = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { applyDataPatches } = require("./data-patches");
    return (await applyDataPatches(db)) as boolean;
  } catch {
    return false;
  } finally {
    patchInFlight = false;
  }
}

// 첫 cold start 시 1회만 호출 (홈 페이지의 after()에서).
// sandbox에선 naver.com 차단되지만 Vercel(icn1)에선 정상 작동 → 자동 갱신됨.
let refreshInFlight = false;
async function maybeAutoRefresh(_db: DBShape) {
  // no-op — 명시적 호출은 persistNaverRefresh()
}

export async function persistNaverRefresh(): Promise<{ updated: number; skipped: boolean }> {
  const db = globalThis.__catchpass_db || getDB();
  if (db.naverDataFetched) return { updated: 0, skipped: true };
  if (refreshInFlight) return { updated: 0, skipped: true };
  refreshInFlight = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { refreshAllStores } = require("./naver-refresh");
    const updated: number = await refreshAllStores(db);
    if (updated > 0) {
      db.naverDataFetched = Date.now();
      if (kvAvailable()) await kvSave(db);
      persist(db);
    }
    return { updated, skipped: false };
  } catch {
    return { updated: 0, skipped: false };
  } finally {
    refreshInFlight = false;
  }
}

export async function saveDBAsync() {
  const db = globalThis.__catchpass_db || getDB();
  if (kvAvailable()) {
    await kvSave(db);
  }
  persist(db);
}

export function resetDB() {
  globalThis.__catchpass_db = { ...empty };
  try {
    if (fs.existsSync(SNAPSHOT_PATH)) fs.unlinkSync(SNAPSHOT_PATH);
  } catch {}
}
