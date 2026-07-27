// SNS 소개글(bio) 인증코드 검증 (2026-07-25 연결 프로세스 개편).
//
// 흐름: [연결하기] 시트 오픈 → 8자리 1회성 계정 인증코드 발급(영대·영소·숫자) →
// [인증하기] = 코드 서명 쿠키(30분) 무장 + SNS 주소 입력 활성화 → 유저가 채널 소개글
// 맨 앞에 코드 삽입 → 주소 입력 후 [인증완료] → 서버가 채널 프로필을 즉시 크롤링해
// 소개글에 코드가 있는지 확인 → 있으면 인증 완료, 없으면 "계정 인증 코드를 확인할 수
// 없습니다." + [재시도].
//
// [저장 최소화] 코드·만료를 서버 DB에 저장하지 않는다 — AUTH_SECRET 서명(JWT) 쿠키로만
// 왕복한다 (phone-verify·KFTC 증빙과 동일 규율). 코드는 소유 증명용 난수라 클라이언트에
// 노출되어도 무해 — 소개글을 편집할 수 있는 본인만 통과할 수 있다.
//
// [네이버 블로그 한정 등급 산정] 인증 완료 시 자체 등급평가 API
// (BLOG_ANALYZER_BASE /api/analyze?url={블로그ID})를 호출해 grade·total_visitors를
// 반영한다. 인스타그램·틱톡은 미반영(기존 팔로워 수 기반 공식 유지).
//
// 샌드박스는 외부 도메인이 차단되므로 크롤·분석 베이스를 env로 오버라이드해 스텁
// (scripts/sns-bio-stub.mjs)으로 검증한다 — KFTC/플레이스 스텁과 동일 관례.

import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { authSecret } from "./auth";
import type { Grade, SnsKind } from "./types";

const BIO_COOKIE = "cp_sns_bio_v1";
// 인증코드 유효 30분 (스모크에서만 초 단위 오버라이드)
export const BIO_CODE_TTL_SECONDS = Number(process.env.BIO_CODE_TTL_SECONDS || 30 * 60);

const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const BIO_CODE_RE = /^[A-Za-z0-9]{8}$/;

// 영문 대·소문자 + 숫자 조합 8자리 1회성 난수
export function newBioCode(): string {
  const buf = crypto.randomBytes(8);
  return Array.from(buf, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

// [인증하기] — 코드를 서명 쿠키로 무장 (여기서부터 30분 카운팅)
export async function armBioCode(kind: SnsKind, code: string): Promise<number> {
  const expiresAt = Date.now() + BIO_CODE_TTL_SECONDS * 1000;
  const token = await new SignJWT({ kind, code })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Math.floor(expiresAt / 1000))
    .sign(authSecret());
  const jar = await cookies();
  jar.set({
    name: BIO_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: BIO_CODE_TTL_SECONDS,
  });
  return expiresAt;
}

export async function readBioCode(kind: SnsKind): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(BIO_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret());
    if (payload.kind !== kind || typeof payload.code !== "string") return null;
    return payload.code;
  } catch {
    return null; // 만료·위조
  }
}

export async function clearBioCode(): Promise<void> {
  const jar = await cookies();
  jar.delete(BIO_COOKIE);
}

// ── 채널 주소 → 계정 ID 정규화 ──────────────────────────────────────────────
// 전체 URL·@아이디·아이디 단독 입력을 모두 수용하고 정본 URL을 만든다.
export interface ParsedSnsAccount {
  id: string;
  canonicalUrl: string;
}

export function parseSnsAccount(kind: SnsKind, raw: string): ParsedSnsAccount | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  if (kind === "naver_blog") {
    // blog.naver.com/{id} · m.blog.naver.com/{id} · 아이디 단독
    const m =
      v.match(/blog\.naver\.com\/([A-Za-z0-9_-]{2,30})/) ||
      v.match(/^@?([A-Za-z0-9_-]{2,30})$/);
    if (!m) return null;
    return { id: m[1], canonicalUrl: `https://blog.naver.com/${m[1]}` };
  }
  if (kind === "instagram") {
    const m =
      v.match(/instagram\.com\/([A-Za-z0-9._]{2,30})/) ||
      v.match(/^@?([A-Za-z0-9._]{2,30})$/);
    if (!m || m[1] === "p" || m[1] === "reel") return null;
    return { id: m[1], canonicalUrl: `https://www.instagram.com/${m[1]}` };
  }
  // tiktok
  const m = v.match(/tiktok\.com\/@([A-Za-z0-9._]{2,30})/) || v.match(/^@?([A-Za-z0-9._]{2,30})$/);
  if (!m) return null;
  return { id: m[1], canonicalUrl: `https://www.tiktok.com/@${m[1]}` };
}

// ── 프로필 크롤링 — 소개글의 인증코드 확인 ──────────────────────────────────
// 프로필 공개 페이지 HTML에 코드가 포함되어 있는지 검사한다 (소개글은 페이지에
// 서버 렌더/임베드 JSON으로 포함됨). 코드가 8자리 난수라 우연 일치 가능성은 무시 가능.
const CRAWL_BASE: Record<SnsKind, string> = {
  naver_blog: process.env.NAVER_BLOG_CRAWL_BASE || "https://m.blog.naver.com",
  instagram: process.env.INSTAGRAM_CRAWL_BASE || "https://www.instagram.com",
  tiktok: process.env.TIKTOK_CRAWL_BASE || "https://www.tiktok.com",
};

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
// 인스타그램 웹앱 공개 app id — 비로그인 프로필 JSON API(web_profile_info) 호출용
const IG_APP_ID = "936619743392459";

function profileUrls(kind: SnsKind, id: string): string[] {
  if (kind === "naver_blog") {
    // 모바일 홈이 소개글 포함 SSR — 실패 시 PC 프롤로그 폴백
    return [`${CRAWL_BASE.naver_blog}/${id}`, `https://blog.naver.com/${id}`];
  }
  if (kind === "instagram") return [`${CRAWL_BASE.instagram}/${id}/`];
  return [`${CRAWL_BASE.tiktok}/@${id}`];
}

async function fetchText(url: string, headers: Record<string, string>): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12_000);
    const r = await fetch(url, {
      headers,
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

const HTML_HEADERS = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "ko-KR,ko;q=0.9",
};

export type BioCrawlResult = { ok: true } | { ok: false; reason: "unreachable" | "code_not_found" };

// 소개글 코드 검출 — 다층 크롤 (2026-07-27 실 QA: 인스타그램은 비로그인 서버 크롤에
// 로그인 벽 HTML을 반환해 프로필 페이지에 소개글이 없다 → 층을 나눠 순서대로 검사한다).
//  인스타그램: ① 웹 프로필 JSON API(web_profile_info — 비로그인 공개, biography 포함)
//              ② 프로필 HTML ③ insta-index 분석 응답 원문
//  틱톡: ① 프로필 HTML(SSR에 소개글 포함) ② insta-index 분석 응답 원문
//  네이버 블로그: 모바일 홈 → PC 프롤로그 HTML
export async function crawlBioHasCode(kind: SnsKind, id: string, code: string): Promise<BioCrawlResult> {
  let reached = false;
  if (kind === "instagram") {
    const j = await fetchText(
      `${CRAWL_BASE.instagram}/api/v1/users/web_profile_info/?username=${encodeURIComponent(id)}`,
      { "User-Agent": DESKTOP_UA, "x-ig-app-id": IG_APP_ID, Accept: "application/json" },
    );
    if (j) {
      reached = true;
      if (j.includes(code)) return { ok: true };
    }
  }
  for (const url of profileUrls(kind, id)) {
    const html = await fetchText(url, HTML_HEADERS);
    if (!html) continue;
    reached = true;
    if (html.includes(code)) return { ok: true };
  }
  if (kind === "instagram" || kind === "tiktok") {
    const raw = await fetchSnsIndexRaw(kind, id);
    if (raw) {
      reached = true;
      if (raw.includes(code)) return { ok: true };
    }
  }
  return { ok: false, reason: reached ? "code_not_found" : "unreachable" };
}

// ── 네이버 블로그 등급평가 API (2026-07-25 §5~7) ────────────────────────────
// GET {BLOG_ANALYZER_BASE}/api/analyze?url={블로그ID} → { grade, total_visitors }
const ANALYZER_BASE = process.env.BLOG_ANALYZER_BASE || "https://blog-analyzer-ten.vercel.app";
// 인스타그램·틱톡 지수 API (2026-07-25 확장) — POST 전용, body { username } →
// { followers, score }. 별도 grade 평가가 없어 score 밴드로 등급을 매긴다.
const INSTA_INDEX_BASE = process.env.INSTA_INDEX_BASE || "https://insta-index.vercel.app";

export interface BlogAnalysis {
  grade: Grade;
  totalVisitors: number;
}

function normalizeGrade(v: unknown): Grade | null {
  const g = String(v ?? "").trim().toUpperCase().charAt(0);
  return g === "S" || g === "A" || g === "B" || g === "C" || g === "N" ? (g as Grade) : null;
}

// score → 등급 밴드 (2026-07-25 스펙): S 88+ · A 78+ · B 66+ · C 52+ · 미만 N.
// 스펙의 "D: 38+"는 서비스 등급 체계가 5단계(S/A/B/C/N — D 없음)라 N으로 흡수한다.
export function gradeFromScore(score: number): Grade {
  if (score >= 88) return "S";
  if (score >= 78) return "A";
  if (score >= 66) return "B";
  if (score >= 52) return "C";
  return "N";
}

export interface SnsIndexAnalysis {
  grade: Grade;
  followers: number;
  score: number;
}

// 지수 API 원문 호출 — POST {INSTA_INDEX_BASE}/api/analyze | /api/tiktok, body { username }.
// 응답 원문은 소개글 코드 폴백 스캔(crawlBioHasCode 최후 층)과 분석 파싱이 공유한다.
async function fetchSnsIndexRaw(kind: "instagram" | "tiktok", username: string): Promise<string | null> {
  try {
    const path = kind === "instagram" ? "/api/analyze" : "/api/tiktok";
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15_000);
    const r = await fetch(`${INSTA_INDEX_BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ username }),
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

// 인스타그램·틱톡 지수 분석 — POST {INSTA_INDEX_BASE}/api/analyze | /api/tiktok
export async function analyzeSnsIndex(
  kind: "instagram" | "tiktok",
  username: string,
): Promise<SnsIndexAnalysis | null> {
  const raw = await fetchSnsIndexRaw(kind, username);
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as { followers?: unknown; score?: unknown };
    const followers = Number(j.followers);
    const score = Number(j.score);
    if (!Number.isFinite(followers) || followers < 0 || !Number.isFinite(score)) return null;
    return { grade: gradeFromScore(score), followers: Math.floor(followers), score };
  } catch {
    return null;
  }
}

export async function analyzeNaverBlog(blogId: string): Promise<BlogAnalysis | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15_000);
    const r = await fetch(`${ANALYZER_BASE}/api/analyze?url=${encodeURIComponent(blogId)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = (await r.json()) as { grade?: unknown; total_visitors?: unknown };
    const grade = normalizeGrade(j.grade);
    const totalVisitors = Number(j.total_visitors);
    if (!grade || !Number.isFinite(totalVisitors) || totalVisitors < 0) return null;
    return { grade, totalVisitors: Math.floor(totalVisitors) };
  } catch {
    return null;
  }
}
