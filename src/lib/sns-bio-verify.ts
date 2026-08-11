// SNS 소개글(bio) 인증코드 검증 (2026-07-25 연결 프로세스 개편).
//
// 흐름: [연결하기] 시트 오픈 → 8자리 1회성 계정 인증코드 발급(영대·영소·숫자) →
// [복사] = 코드 복사 + 서명 쿠키(30분) 무장 + SNS 주소 입력 활성화 (2026-07-28:
// [인증하기] 버튼을 [복사]에 흡수 — 무장 중 재클릭은 복사만) → 유저가 채널 소개글
// 맨 앞에 코드 삽입 → 주소 입력 후 [인증완료] → 서버가 채널 프로필을 즉시 크롤링해
// 소개글에 코드가 있는지 확인 → 있으면 인증 완료, 없으면 "계정 인증 코드를 확인할 수
// 없습니다." + [재시도].
//
// [저장 최소화] 코드·만료를 서버 DB에 저장하지 않는다 — AUTH_SECRET 서명(JWT) 쿠키로만
// 왕복한다 (phone-verify·KFTC 증빙과 동일 규율). 코드는 소유 증명용 난수라 클라이언트에
// 노출되어도 무해 — 소개글을 편집할 수 있는 본인만 통과할 수 있다.
//
// [네이버 블로그 한정 등급 산정] 인증 완료 시 자체 등급평가 API
// (BLOG_ANALYZER_BASE /api/analyze?url={블로그ID})를 호출해 grade와 **일 방문자**
// (blog.visitor_trend.current — 2026-07-28 확정)를 반영한다.
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

// 인증 무장 — 코드를 서명 쿠키로 저장 (여기서부터 30분 카운팅, UI 트리거는 [복사])
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
//              ③ 프로필 HTML ④ insta-index 분석 응답 원문 ⑤ 브라우저 렌더(최후·고비용)
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
    // 지수 분석 응답 스캔 — 저비용이라 브라우저 층보다 먼저 (insta-index가 biography를
    // 응답에 포함하면 여기서 즉시 검출된다)
    if (inspect("지수 분석 응답", await fetchSnsIndexRaw(kind, id), true)) return { ok: true };
  }
  if (kind === "instagram") {
    // 브라우저 렌더 층 (2026-07-28 QA) — 실브라우저에선 로그인 모달 뒤에 bio가
    // 렌더되므로 headless Chromium으로 열어 (모달 닫고) DOM에서 검출한다.
    // 주의: 데이터센터 IP는 로그인 페이지로 리다이렉트될 수 있음 (트래픽 차단 — 실 QA).
    const { crawlBioViaBrowser } = await import("./sns-bio-browser");
    const b = await crawlBioViaBrowser(profileUrls(kind, id)[0], code);
    if (b?.found) return { ok: true };
    if (b) {
      reached = true;
      trace.push(`브라우저 렌더: ${b.note}`);
    } else {
      trace.push("브라우저 렌더: 실행 실패");
    }
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
  dailyVisitors: number; // 일 방문자 (blog.visitor_trend.current — 2026-07-28 확정)
}

export function normalizeGrade(v: unknown): Grade | null {
  const s = String(v ?? "").trim().toUpperCase();
  if (!s) return null;
  // "S+"는 채널 등급 상한(S)으로 명시 클램프 (2026-08-06 6단계 — S+는 계정 표기 레이어 전용.
  // 외부 분석 API가 S+를 반환해도 조용히 흡수되지 않고 여기서 의도적으로 S 처리)
  if (s.startsWith("S+")) return "S";
  // "N"도 클램프 — N은 **미연동 전용 상태**라 연동(분석)된 채널의 등급이 될 수 없다
  // (2026-08-10 정정: 6단계 개편 때 gradeFromScore는 최저 C로 고쳤으나 블로그 분석기의
  //  텍스트 등급 파서는 N을 통과시켜 "연동했는데 N" 버그 발생 — realtest 실사용 리포트)
  const first = s.charAt(0);
  if (first === "N") return "C";
  if ("SABC".includes(first)) return first as Grade; // "C" · "C등급" · "b+"
  const m = s.match(/[SABCN](?![A-Z])/); // 장식 섞인 값("일반(C)")에서 단독 등급 문자
  if (!m) return null;
  return m[0] === "N" ? "C" : (m[0] as Grade);
}

// score → 등급 밴드 (2026-07-25 스펙): S 88+ · A 78+ · B 66+ · 미만 C.
// 2026-08-06 6단계 개편: N은 미연동 전용 상태 — 연동(분석)된 채널은 최하라도 C.
// (스펙의 "D: 38+"도 동일하게 C로 흡수)
export function gradeFromScore(score: number): Grade {
  if (score >= 88) return "S";
  if (score >= 78) return "A";
  if (score >= 66) return "B";
  return "C";
}

export interface SnsIndexAnalysis {
  grade: Grade | null; // score 밴드 등급 — score 미검출 시 null(팔로워 공식 폴백)
  followers: number;
  score: number | null;
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

// 인스타그램·틱톡 지수 분석 — POST {INSTA_INDEX_BASE}/api/analyze | /api/tiktok.
// 실 응답이 평평한 {followers, score}가 아닐 수 있어(블로그 4차 QA와 동일 패턴 —
// 틱톡 팔로워 0 반영) 확정 키 우선 + 딥 서치 폴백으로 추출하고, 둘 다 실패하면
// 응답 원문을 로그로 남긴다. following 계열 키는 팔로워로 오인하지 않도록 배제.
export async function analyzeSnsIndex(
  kind: "instagram" | "tiktok",
  username: string,
): Promise<SnsIndexAnalysis | null> {
  const out = await fetchSnsIndexRaw(kind, username);
  if (!out || out.status !== 200 || !out.text) {
    console.log(`[sns-bio] insta-index(${kind}) @${username} ${out ? `HTTP ${out.status}` : "응답 없음"}`);
    return null;
  }
  try {
    const j: unknown = JSON.parse(out.text);
    const flat = j as { followers?: unknown; score?: unknown };
    const followers =
      parseCount(flat.followers) ?? findNumberDeep(j, /follower/i, /following/i);
    const score = parseNum(flat.score) ?? findNumberDeep(j, /score$/i, null, false);
    if (followers === null && score === null) {
      console.log(
        `[sns-bio] insta-index(${kind}) @${username} followers·score 추출 실패 — 응답: ${out.text.slice(0, 400)}`,
      );
      return null;
    }
    if (followers === null) {
      console.log(`[sns-bio] insta-index(${kind}) @${username} followers 미검출 — 응답: ${out.text.slice(0, 400)}`);
    }
    return {
      // score 미검출 시 grade 없음 — apiGrade 대신 팔로워 영향력 공식(INDEX_BANDS)이 적용된다
      grade: score !== null ? gradeFromScore(score) : null,
      followers: followers ?? 0,
      score,
    };
  } catch {
    console.log(`[sns-bio] insta-index(${kind}) @${username} JSON 파싱 실패 — 응답: ${out.text.slice(0, 400)}`);
    return null;
  }
}

// ── 블로그 분석 응답 견고 파싱 (2026-07-27 3차 QA · 2026-07-28 일 방문자 정정) ──
// 등급 산정 기준 지표는 **일 방문자** — 정본 경로는 `blog.visitor_trend.current`
// (2026-07-28 회의 확정: 총 방문자 아님. INDEX_BANDS·월간 재평가 지수도 일 방문자
// 규모 기준이라 이 선택이 등급 체계와 정합). 확정 경로 우선, 스키마 변경 대비
// 딥 서치 폴백(visitor_trend.current → daily_visitors 계열 키) 유지.

// 수치 파싱 — "12,345" · "12345명" 등 형식 문자열 수용, 실수 유지 (score용)
function parseNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v : null;
  if (typeof v === "string") {
    const n = Number(v.replace(/[,\s명회]/g, ""));
    return Number.isFinite(n) && n >= 0 && v.trim() !== "" ? n : null;
  }
  return null;
}

// 개수 파싱 — parseNum + 내림 (방문자·팔로워 자연수)
function parseCount(v: unknown): number | null {
  const n = parseNum(v);
  return n === null ? null : Math.floor(n);
}

// 키 패턴 매칭 수치 딥 서치 — includeRe에 맞고 excludeRe에 안 걸리는 첫 수치.
// floor=true면 자연수(팔로워), false면 실수 유지(score).
function findNumberDeep(
  v: unknown,
  includeRe: RegExp,
  excludeRe: RegExp | null,
  floor = true,
  depth = 0,
): number | null {
  if (!v || typeof v !== "object" || depth > 4) return null;
  const entries = Object.entries(v as Record<string, unknown>);
  for (const [k, val] of entries) {
    if (includeRe.test(k) && !(excludeRe && excludeRe.test(k))) {
      const n = floor ? parseCount(val) : parseNum(val);
      if (n !== null) return n;
    }
  }
  for (const [, val] of entries) {
    const n = findNumberDeep(val, includeRe, excludeRe, floor, depth + 1);
    if (n !== null) return n;
  }
  return null;
}

const GRADE_KEY_RE = /grade|등급/i;
const DAILY_VISIT_KEY_RE = /daily.*visit|visit.*daily|today.*visit|visit.*today|일.?방문/i;

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

// visitor_trend.current — 정본 경로의 딥 폴백 (래퍼가 바뀌어도 visitor_trend 객체를 탐색)
function findVisitorTrendCurrentDeep(v: unknown, depth = 0): number | null {
  if (!v || typeof v !== "object" || depth > 4) return null;
  const entries = Object.entries(v as Record<string, unknown>);
  for (const [k, val] of entries) {
    if (/visitor.?trend/i.test(k) && val && typeof val === "object") {
      const n = parseCount((val as Record<string, unknown>).current);
      if (n !== null) return n;
    }
  }
  for (const [, val] of entries) {
    const n = findVisitorTrendCurrentDeep(val, depth + 1);
    if (n !== null) return n;
  }
  return null;
}

// daily_visitors 계열 키 — visitor_trend가 아예 없을 때의 최후 폴백
function findDailyVisitorsDeep(v: unknown, depth = 0): number | null {
  if (!v || typeof v !== "object" || depth > 4) return null;
  const entries = Object.entries(v as Record<string, unknown>);
  for (const [k, val] of entries) {
    if (DAILY_VISIT_KEY_RE.test(k)) {
      const n = parseCount(val);
      if (n !== null) return n;
    }
  }
  for (const [, val] of entries) {
    const n = findDailyVisitorsDeep(val, depth + 1);
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
    // 실 스키마 (2026-07-28 실호출 + 회의 확정): grade = influence.grade ·
    // **일 방문자 = blog.visitor_trend.current** (폴백: metrics.daily_visitors_est).
    // 확정 경로를 먼저 읽고, 스키마가 또 바뀌면 딥 서치 폴백.
    // (배제 값: blog.profile.total_visitors=총 방문자(지표 아님) · mate.grade="메이트 근접" ·
    //  influence.subscores 내 total_visitors/daily는 점수)
    const known = j as {
      influence?: { grade?: unknown };
      blog?: { visitor_trend?: { current?: unknown } };
      metrics?: { daily_visitors_est?: unknown };
    };
    const grade = normalizeGrade(known.influence?.grade) ?? findGradeDeep(j);
    if (!grade) {
      // 스키마 불일치 진단 — 실제 응답 형태를 로그로 남겨 파서를 정확히 맞출 수 있게
      console.log(`[sns-bio] blog-analyzer @${blogId} grade 추출 실패 — 응답: ${raw.slice(0, 400)}`);
      return null;
    }
    const dailyVisitors =
      parseCount(known.blog?.visitor_trend?.current) ??
      findVisitorTrendCurrentDeep(j) ??
      parseCount(known.metrics?.daily_visitors_est) ??
      findDailyVisitorsDeep(j);
    if (dailyVisitors === null) {
      console.log(`[sns-bio] blog-analyzer @${blogId} 일 방문자 추출 실패 — 응답: ${raw.slice(0, 400)}`);
    }
    return { grade, dailyVisitors: dailyVisitors ?? 0 };
  } catch (e) {
    console.log(
      `[sns-bio] blog-analyzer @${blogId} 호출 실패(${e instanceof Error ? e.name : "unknown"})` +
        (raw ? ` — 응답: ${raw.slice(0, 400)}` : ""),
    );
    return null;
  }
}
