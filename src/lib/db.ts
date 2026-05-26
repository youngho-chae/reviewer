import fs from "node:fs";
import path from "node:path";
import { DBShape } from "./types";
import { kvAvailable, kvLoad, kvSave } from "./kv";

// 3-단 영속성 계층:
//   1) Vercel KV (Upstash Redis REST API) — 환경변수 있으면 우선 사용 → 멀티 인스턴스 공유 가능
//   2) /tmp JSON 스냅샷 — 단일 인스턴스 내 follow-up 요청 가속용
//   3) 모듈 전역 변수 — 같은 워밍 인스턴스 안에서 가장 빠른 액세스

const SNAPSHOT_PATH = process.env.CATCHPASS_DB_PATH || path.join("/tmp", "catchpass-db.json");

const empty: DBShape = {
  reviewers: [],
  owners: [],
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

function ensureSeeded(db: DBShape) {
  if (!db.seeded) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { runSeed } = require("./seed-runner");
    runSeed(db);
  }
}

// ─── 동기 API (로컬/단일 인스턴스 폴백) ───
export function getDB(): DBShape {
  if (!globalThis.__catchpass_db) {
    globalThis.__catchpass_db = loadFromDisk() || { ...empty };
  }
  const db = globalThis.__catchpass_db!;
  ensureSeeded(db);
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
      // 시드가 새로 들어갔다면 즉시 KV 반영
      if (fresh.seeded && fresh.reviewers.length > 0) {
        // already-seeded data — no-op
      }
      return fresh;
    } else {
      // KV 비어있음 — 부트스트랩
      const db: DBShape = { ...empty };
      ensureSeeded(db);
      await kvSave(db);
      globalThis.__catchpass_db = db;
      return db;
    }
  }
  // KV 미설정 — sync 폴백
  return getDB();
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
