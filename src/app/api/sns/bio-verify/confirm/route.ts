import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { isSnsKind, applySnsConnect } from "@/lib/sns-oauth";
import { writeSnsState } from "@/lib/sns-cookie";
import type { Grade } from "@/lib/types";
import {
  readBioCode,
  clearBioCode,
  parseSnsAccount,
  crawlBioHasCode,
  analyzeNaverBlog,
  analyzeSnsIndex,
} from "@/lib/sns-bio-verify";

export const runtime = "nodejs";

// [인증완료] (2026-07-25 연결 개편 §2~§7) — 입력된 채널 주소의 프로필을 즉시 크롤링해
// 소개글에 발급 코드가 있는지 확인하고, 있으면 연결을 완료한다.
//  - 실패(코드 미검출): "계정 인증 코드를 확인할 수 없습니다." — 쿠키는 유지해 [재시도] 허용
//  - 등급 산정 (전 채널 자동): 네이버 블로그 = blog-analyzer(grade·total_visitors),
//    인스타그램·틱톡 = insta-index(POST, followers·score → score 밴드 S88/A78/B66/C52/N).
//    분석 API 장애 시에도 인증 자체는 완료(연결 유지)하고 등급은 추후 [다시 인증]으로 갱신.
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "reviewer") {
    return NextResponse.json({ error: "체험자 로그인 필요" }, { status: 401 });
  }
  const { kind, url } = await req.json().catch(() => ({}));
  if (typeof kind !== "string" || !isSnsKind(kind)) {
    return NextResponse.json({ error: "지원하지 않는 채널입니다" }, { status: 400 });
  }

  const code = await readBioCode(kind);
  if (!code) {
    return NextResponse.json(
      { error: "인증 시간이 만료되었어요 — [인증하기]를 다시 눌러 진행해주세요", expired: true },
      { status: 400 },
    );
  }

  const parsed = parseSnsAccount(kind, String(url ?? ""));
  if (!parsed) {
    return NextResponse.json({ error: "채널 주소를 확인해주세요" }, { status: 400 });
  }

  // 즉시 크롤링 — 소개글에 인증코드가 있는지 확인 (§2·§3)
  const crawl = await crawlBioHasCode(kind, parsed.id, code);
  if (!crawl.ok) {
    return NextResponse.json(
      {
        error:
          crawl.reason === "unreachable"
            ? "채널 페이지를 불러오지 못했어요 — 주소가 정확한지, 계정이 전체 공개인지 확인해주세요"
            : "계정 인증 코드를 확인할 수 없습니다.",
        retry: true, // 쿠키 유지 — 유효 시간 내 [재시도] 가능
      },
      { status: 422 },
    );
  }

  // 등급 산정 — 채널별 분석 API 자동 반영 (수동 입력 없음)
  let analyzed = false;
  let apiGrade: Grade | undefined;
  let inf = 0;
  if (kind === "naver_blog") {
    const analysis = await analyzeNaverBlog(parsed.id);
    if (analysis) {
      analyzed = true;
      apiGrade = analysis.grade;
      inf = analysis.totalVisitors;
    }
  } else {
    const analysis = await analyzeSnsIndex(kind, parsed.id);
    if (analysis) {
      analyzed = true;
      apiGrade = analysis.grade;
      inf = analysis.followers;
    }
  }

  const db = await getDBAsync();
  const applied = applySnsConnect(db, s.userId, {
    kind,
    url: parsed.canonicalUrl,
    influence: inf,
    verified: true,
    verifiedAt: Date.now(),
    verifiedVia: "bio",
    providerAccountId: parsed.id,
    accountName: parsed.id,
    ...(apiGrade ? { apiGrade } : {}),
  });
  if (!applied.ok) return NextResponse.json({ error: applied.error }, { status: 400 });
  await saveDBAsync();
  await clearBioCode(); // 1회성 — 성공 시 즉시 소각

  const me = db.reviewers.find((r) => r.id === s.userId)!;
  // 인스턴스 불일치 스톱갭 — 본인 시점 즉시 반영 (sns-cookie.ts)
  await writeSnsState(me.id, me.sns);
  return NextResponse.json({
    ok: true,
    grade: me.channelGrades?.[kind] ?? me.grade,
    influence: inf,
    analyzed, // 네이버 블로그 등급평가 API 반영 여부
  });
}
