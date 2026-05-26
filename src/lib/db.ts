import fs from "node:fs";
import path from "node:path";
import { DBShape } from "./types";

// 1) In-memory module singleton (persists across requests within a warm instance)
// 2) /tmp JSON snapshot for soft persistence within the same serverless instance
// NOTE: For multi-instance production durability, swap to Vercel Postgres/KV.

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
  } catch {
    // ignore
  }
  return null;
}

function persist(db: DBShape) {
  try {
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(db), "utf-8");
  } catch {
    // ignore — /tmp might be RO in some envs
  }
}

export function getDB(): DBShape {
  if (!globalThis.__catchpass_db) {
    globalThis.__catchpass_db = loadFromDisk() || { ...empty };
  }
  return globalThis.__catchpass_db!;
}

export function saveDB() {
  const db = getDB();
  persist(db);
}

export function resetDB() {
  globalThis.__catchpass_db = { ...empty };
  try {
    if (fs.existsSync(SNAPSHOT_PATH)) fs.unlinkSync(SNAPSHOT_PATH);
  } catch {}
}
