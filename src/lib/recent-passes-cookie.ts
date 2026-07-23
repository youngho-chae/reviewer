// 멀티 인스턴스 + KV 미연결 환경에서 발급 직후 reviewer 본인 시점의 목록 반영을
// 보장하기 위한 stopgap. POST /api/passes 응답과 함께 쿠키에 최근 발급 패스를
// 적재해 후속 페이지(/r/passes 등)가 같은 세션 동안 인식한다.
//
// 한계: owner 측 스캔/사용 처리는 이 쿠키로 해결되지 않음 (다른 세션·다른 인스턴스).
//        진짜 cross-actor 동기화는 Vercel KV 연결 시에만 동작.

import { cookies } from "next/headers";
import type { Pass, Campaign, Store } from "./types";

const COOKIE_NAME = "cp_recent_passes_v1";
const MAX_RECENT = 5;
const MAX_AGE_SEC = 60 * 60; // 1시간

// 쿠키 사이즈 절약을 위해 카드 렌더링/QR 표시에 필요한 필드만 직렬화
type RecentCampaign = Pick<
  Campaign,
  "id" | "title" | "kind" | "supportAmount" | "requiredChannels" | "description"
>;
type RecentStore = Pick<
  Store,
  "id" | "name" | "area" | "category" | "coverEmoji" | "lat" | "lng" | "naverPlaceId" | "address" | "hours" | "rating" | "reviewCount" | "ownerId"
>;

export interface RecentPassEntry {
  pass: Pass;
  campaign: RecentCampaign;
  store: RecentStore;
}

export async function readRecentPasses(): Promise<RecentPassEntry[]> {
  try {
    const jar = await cookies();
    const c = jar.get(COOKIE_NAME);
    if (!c) return [];
    const decoded = Buffer.from(c.value, "base64").toString("utf-8");
    const arr = JSON.parse(decoded);
    if (!Array.isArray(arr)) return [];
    return arr as RecentPassEntry[];
  } catch {
    return [];
  }
}

export async function appendRecentPass(entry: RecentPassEntry): Promise<void> {
  const existing = await readRecentPasses();
  // 같은 passId 중복 제거 + 최신 맨 앞 + 최대 N개 유지
  const filtered = existing.filter((e) => e.pass.id !== entry.pass.id);
  const next = [entry, ...filtered].slice(0, MAX_RECENT);
  const encoded = Buffer.from(JSON.stringify(next), "utf-8").toString("base64");
  const jar = await cookies();
  jar.set({
    name: COOKIE_NAME,
    value: encoded,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}
