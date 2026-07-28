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
// 인스타 모바일 앱 API 호스트 — www보다 데이터센터 IP에 관대한 것으로 알려진 경로 (2026-07-27 2차 QA)
const IG_APP_API_BASE = process.env.INSTAGRAM_APP_API_BASE || "https://i.instagram.com";
const IG_APP_UA =
  "Instagram 275.0.0.27.98 (iPhone13,2; iOS 16_3; ko_KR; ko-KR; scale=3.00; 1170x2532; 458229237) AppleWebKit/420+";

function profileUrls(kind: SnsKind, id: string): string[] {
  if (kind === "naver_blog") {
    // 모바일 홈이 소개글 포함 SSR — 실패 시 PC 프롤로그 폴백
    return [`${CRAWL_BASE.naver_blog}/${id}`, `https://blog.naver.com/${id}`];
  }
  if (kind === "instagram") return [`${CRAWL_BASE.instagram}/${id}/`];
  return [`${CRAWL_BASE.tiktok}/@${id}`];
}

interface FetchedText {
  status: number;
  text: string; // 200일 때만 본문 (그 외 "")
}

async function fetchText(url: string, headers: Record<string, string>): Promise<FetchedText | null> {
  try {
    const controller = new AbortController();
    // 인스타는 층이 4개까지 순차 시도되므로 층당 8초 — 라우트 전체 예산(60초) 내 유지
    const t = setTimeout(() => controller.abort(), 8_000);
    const r = await fetch(url, {
      headers,
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(t);
    return { status: r.status, text: r.ok ? await r.text() : "" };
  } catch {
    return null; // 차단·타임아웃·네트워크 오류
  }
}

const HTML_HEADERS = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "ko-KR,ko;q=0.9",
};

export type BioCrawlResult =
  | { ok: true }
  | { ok: false; reason: "unreachable" | "code_not_found"; trace: string[] };

// 소개글 코드 검출 — 다층 크롤 (2026-07-27 실 QA: 인스타그램은 비로그인 서버 크롤에
// 로그인 벽 HTML을 반환해 프로필 페이지에 소개글이 없다 → 층을 나눠 순서대로 검사한다).
//  인스타그램: ① 앱 API 호스트 web_profile_info ② 웹 호스트 web_profile_info
//              ③ 프로필 HTML ④ insta-index 분석 응답 원문
//  틱톡: ① 프로필 HTML(SSR에 소개글 포함) ② insta-index 분석 응답 원문
//  네이버 블로그: 모바일 홈 → PC 프롤로그 HTML
// 실패 시 층별 진단(trace)을 함께 돌려준다 — 내부 QA가 어느 층이 어떻게 막혔는지
// 화면·로그에서 바로 확인할 수 있도록 (2차 QA: 인스타만 계속 미검출).
export async function crawlBioHasCode(kind: SnsKind, id: string, code: string): Promise<BioCrawlResult> {
  let reached = false;
  const trace: string[] = [];
  // 층 하나 검사 — 검출이면 true, 아니면 trace에 진단 한 줄 남기고 false
  const inspect = (label: string, out: FetchedText | null, jsonApi = false): boolean => {
    if (!out) {
      trace.push(`${label}: 응답 없음 (차단·타임아웃)`);
      return false;
    }
    if (out.status !== 200 || !out.text) {
      trace.push(`${label}: HTTP ${out.status}`);
      return false;
    }
    reached = true;
    if (out.text.includes(code)) return true;
    const note = jsonApi
      ? out.text.includes('"biography"')
        ? "소개글 수신 — 코드 미검출"
        : "응답에 소개글 필드 없음"
      : `본문 ${out.text.length.toLocaleString()}자 — 코드 미검출`;
    trace.push(`${label}: ${note}`);
    return false;
  };

  if (kind === "instagram") {
    const q = `/api/v1/users/web_profile_info/?username=${encodeURIComponent(id)}`;
    const appOut = await fetchText(`${IG_APP_API_BASE}${q}`, {
      "User-Agent": IG_APP_UA,
      "x-ig-app-id": IG_APP_ID,
      Accept: "application/json",
    });
    if (inspect("앱 프로필 API", appOut, true)) return { ok: true };
    const webOut = await fetchText(`${CRAWL_BASE.instagram}${q}`, {
      "User-Agent": DESKTOP_UA,
      "x-ig-app-id": IG_APP_ID,
      Accept: "application/json",
    });
    if (inspect("웹 프로필 API", webOut, true)) return { ok: true };
  }
  for (const url of profileUrls(kind, id)) {
    if (inspect("프로필 페이지", await fetchText(url, HTML_HEADERS))) return { ok: true };
  }
  if (kind === "instagram" || kind === "tiktok") {
    if (inspect("지수 분석 응답", await fetchSnsIndexRaw(kind, id), true)) return { ok: true };
  }
  return { ok: false, reason: reached ? "code_not_found" : "unreachable", trace };
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
  const s = String(v ?? "").trim().toUpperCase();
  if (!s) return null;
  const first = s.charAt(0);
  if ("SABCN".includes(first)) return first as Grade; // "C" · "C등급" · "b+"
  const m = s.match(/[SABCN](?![A-Z])/); // 장식 섞인 값("일반(C)")에서 단독 등급 문자
  return m ? (m[0] as Grade) : null;
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
async function fetchSnsIndexRaw(
  kind: "instagram" | "tiktok",
  username: string,
): Promise<FetchedText | null> {
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
    return { status: r.status, text: r.ok ? await r.text() : "" };
  } catch {
    return null;
  }
}

// 인스타그램·틱톡 지수 분석 — POST {INSTA_INDEX_BASE}/api/analyze | /api/tiktok
export async function analyzeSnsIndex(
  kind: "instagram" | "tiktok",
  username: string,
): Promise<SnsIndexAnalysis | null> {
  const out = await fetchSnsIndexRaw(kind, username);
  if (!out || out.status !== 200 || !out.text) return null;
  try {
    const j = JSON.parse(out.text) as { followers?: unknown; score?: unknown };
    const followers = Number(j.followers);
    const score = Number(j.score);
    if (!Number.isFinite(followers) || followers < 0 || !Number.isFinite(score)) return null;
    return { grade: gradeFromScore(score), followers: Math.floor(followers), score };
  } catch {
    return null;
  }
}

// ── 블로그 분석 응답 견고 파싱 (2026-07-27 3차 QA) ─────────────────────────
// 실 API에서 C등급 블로그가 N·방문자 0으로 떨어진 문제 — 응답이 우리가 가정한
// 평평한 {grade, total_visitors}와 다르면(중첩 래퍼·"C등급" 장식·"12,345" 쉼표
// 문자열) 파싱 전체가 소프트 실패해 등급 N/영향력 0이 됐다.
// → 응답을 딥 서치해 grade와 **총 방문자(total)** 값을 추출한다.
//   일 방문자(daily/today/average) 키는 명시적으로 배제 — 총 방문자만 채택.

// "12,345" · "12345명" · 공백 섞임 등 형식 문자열 수용
function parseCount(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
  if (typeof v === "string") {
    const n = Number(v.replace(/[,\s명회]/g, ""));
    return Number.isFinite(n) && n >= 0 && v.trim() !== "" ? Math.floor(n) : null;
  }
  return null;
}

const GRADE_KEY_RE = /grade|등급/i;
const TOTAL_VISIT_KEY_RE = /total.*(visit|방문)|(visit|방문).*total|총.?방문/i;
const DAILY_KEY_RE = /daily|today|yesterday|avg|average|per_?day/i; // 일 방문자류 — 배제

function findGradeDeep(v: unknown, depth = 0): Grade | null {
  if (!v || typeof v !== "object" || depth > 4) return null;
  const entries = Object.entries(v as Record<string, unknown>);
  for (const [k, val] of entries) {
    if (GRADE_KEY_RE.test(k)) {
      const g = normalizeGrade(val);
      if (g) return g;
    }
  }
  for (const [, val] of entries) {
    const g = findGradeDeep(val, depth + 1);
    if (g) return g;
  }
  return null;
}

function findTotalVisitorsDeep(v: unknown, depth = 0): number | null {
  if (!v || typeof v !== "object" || depth > 4) return null;
  const entries = Object.entries(v as Record<string, unknown>);
  for (const [k, val] of entries) {
    if (TOTAL_VISIT_KEY_RE.test(k) && !DAILY_KEY_RE.test(k)) {
      const n = parseCount(val);
      if (n !== null) return n;
    }
  }
  for (const [, val] of entries) {
    const n = findTotalVisitorsDeep(val, depth + 1);
    if (n !== null) return n;
  }
  return null;
}

export async function analyzeNaverBlog(blogId: string): Promise<BlogAnalysis | null> {
  let raw = "";
  try {
    const controller = new AbortController();
    // 분석 서버가 네이버를 실시간 크롤링해 15초를 넘길 수 있음 — 여유 확보 (confirm 예산 60초 내)
    const t = setTimeout(() => controller.abort(), 30_000);
    const r = await fetch(`${ANALYZER_BASE}/api/analyze?url=${encodeURIComponent(blogId)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!r.ok) {
      console.log(`[sns-bio] blog-analyzer @${blogId} HTTP ${r.status}`);
      return null;
    }
    raw = await r.text();
    const j: unknown = JSON.parse(raw);
    // 실 스키마 확정 (2026-07-28 실호출): grade = influence.grade · 총 방문자 =
    // blog.profile.total_visitors. 확정 경로를 먼저 읽고, 스키마가 또 바뀌면 딥 서치 폴백.
    // (주의 값: mate.grade="메이트 근접"(등급 아님) · profile.today_visitors=일 방문자 ·
    //  metrics.daily_visitors_est · influence.subscores 내 total_visitors는 점수(98.7))
    const known = j as {
      influence?: { grade?: unknown };
      blog?: { profile?: { total_visitors?: unknown } };
    };
    const grade = normalizeGrade(known.influence?.grade) ?? findGradeDeep(j);
    if (!grade) {
      // 스키마 불일치 진단 — 실제 응답 형태를 로그로 남겨 파서를 정확히 맞출 수 있게
      console.log(`[sns-bio] blog-analyzer @${blogId} grade 추출 실패 — 응답: ${raw.slice(0, 400)}`);
      return null;
    }
    const totalVisitors = parseCount(known.blog?.profile?.total_visitors) ?? findTotalVisitorsDeep(j);
    if (totalVisitors === null) {
      console.log(`[sns-bio] blog-analyzer @${blogId} total_visitors 추출 실패 — 응답: ${raw.slice(0, 400)}`);
    }
    return { grade, totalVisitors: totalVisitors ?? 0 };
  } catch (e) {
    console.log(
      `[sns-bio] blog-analyzer @${blogId} 호출 실패(${e instanceof Error ? e.name : "unknown"})` +
        (raw ? ` — 응답: ${raw.slice(0, 400)}` : ""),
    );
    return null;
  }
}
