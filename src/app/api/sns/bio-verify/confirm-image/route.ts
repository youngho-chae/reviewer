import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { applySnsConnect } from "@/lib/sns-oauth";
import { writeSnsState } from "@/lib/sns-cookie";
import type { Grade } from "@/lib/types";
import { readBioCode, clearBioCode, parseSnsAccount, analyzeSnsIndex } from "@/lib/sns-bio-verify";
import { ocrExtractText, ocrConfigured } from "@/lib/ncp-ocr";

export const runtime = "nodejs";
export const maxDuration = 60;

// [업로드] — 인스타그램 캡처 이미지 OCR 인증 (2026-07-28 인증방식 변경).
// 인스타는 서버 크롤로 bio 접근이 불가(데이터센터 IP 차단 확정) → 유저가 소개(bio)에
// 코드를 넣고 그 화면 캡처를 업로드하면 CLOVA OCR로 텍스트를 추출해
// "입력한 SNS 계정 ID + 발급 코드"가 함께 있는지 확인 후 점유 인증을 완료한다.
// 등급 산정(insta-index)·코드 소각·쿠키 규율은 기존 [인증완료]와 동일.
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "reviewer") {
    return NextResponse.json({ error: "체험자 로그인 필요" }, { status: 401 });
  }
  const { kind, url, image } = await req.json().catch(() => ({}));
  if (kind !== "instagram") {
    return NextResponse.json({ error: "이미지 인증은 인스타그램 전용입니다" }, { status: 400 });
  }
  if (!ocrConfigured()) {
    return NextResponse.json(
      { error: "이미지 인증이 아직 설정되지 않았어요 — 운영팀에 문의해주세요. (NCP_OCR_INVOKE_URL / NCP_OCR_SECRET)" },
      { status: 503 },
    );
  }

  const code = await readBioCode("instagram");
  if (!code) {
    return NextResponse.json(
      { error: "인증 시간이 만료되었어요 — [복사]를 다시 눌러 진행해주세요", expired: true },
      { status: 400 },
    );
  }
  const parsed = parseSnsAccount("instagram", String(url ?? ""));
  if (!parsed) {
    return NextResponse.json({ error: "채널 주소를 확인해주세요" }, { status: 400 });
  }

  // dataURL → base64 (포맷 추출). 클라이언트가 1280px로 리사이즈해 보내지만 상한 방어(≈6MB)
  const m = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/.exec(String(image ?? ""));
  if (!m) return NextResponse.json({ error: "캡처 이미지를 선택해주세요" }, { status: 400 });
  if (m[2].length > 8_000_000) {
    return NextResponse.json({ error: "이미지가 너무 커요 — 다시 시도해주세요" }, { status: 400 });
  }
  const format = m[1] === "png" ? "png" : "jpg";

  const ocr = await ocrExtractText(m[2], format);
  if (!ocr.ok) {
    return NextResponse.json(
      { error: "이미지 인식에 실패했어요 — 잠시 후 다시 업로드해주세요.", retry: true },
      { status: 502 },
    );
  }

  // 검증 — OCR 텍스트에 ① 계정 인증코드 ② 입력한 SNS 계정 ID가 함께 있어야 한다.
  // OCR 특성 보정: 공백 제거 병합본 기준, 코드는 대소문자 완전 일치 우선 → 소문자 비교 폴백
  // (8자리 난수라 케이스 무시 우연 일치는 무시 가능), ID는 소문자 비교.
  const compact = ocr.text.replace(/\s+/g, "");
  const codeFound = compact.includes(code) || compact.toLowerCase().includes(code.toLowerCase());
  const idFound = compact.toLowerCase().includes(parsed.id.toLowerCase());
  if (!codeFound || !idFound) {
    const trace = [
      `OCR 인식 ${ocr.text.length.toLocaleString()}자`,
      `계정 인증코드: ${codeFound ? "검출" : "미검출"}`,
      `계정 ID(@${parsed.id}): ${idFound ? "검출" : "미검출"}`,
    ];
    console.log(`[sns-bio] instagram @${parsed.id} OCR 검증 실패`, trace, `— 텍스트: ${ocr.text.slice(0, 200)}`);
    return NextResponse.json(
      {
        error: !codeFound
          ? "캡처에서 계정 인증 코드를 확인할 수 없습니다."
          : "캡처에서 입력한 SNS 계정을 확인할 수 없어요 — 계정 아이디가 보이게 캡처해주세요.",
        retry: true, // 쿠키 유지 — 유효 시간 내 재업로드 가능
        trace,
      },
      { status: 422 },
    );
  }

  // 등급 산정 — 기존 인증완료와 동일 (insta-index, 장애 시 소프트 실패)
  let analyzed = false;
  let apiGrade: Grade | undefined;
  let inf = 0;
  const analysis = await analyzeSnsIndex("instagram", parsed.id);
  if (analysis) {
    analyzed = true;
    apiGrade = analysis.grade ?? undefined;
    inf = analysis.followers;
  }

  const db = await getDBAsync();
  const applied = applySnsConnect(db, s.userId, {
    kind: "instagram",
    url: parsed.canonicalUrl,
    influence: inf,
    verified: true,
    verifiedAt: Date.now(),
    verifiedVia: "bio", // 소개글 점유 인증 — 검증 수단만 OCR로 변경 (표식 동일)
    providerAccountId: parsed.id,
    accountName: parsed.id,
    ...(apiGrade ? { apiGrade } : {}),
  });
  if (!applied.ok) return NextResponse.json({ error: applied.error }, { status: 400 });
  await saveDBAsync();
  await clearBioCode(); // 1회성 — 성공 시 즉시 소각

  const me = db.reviewers.find((r) => r.id === s.userId)!;
  await writeSnsState(me.id, me.sns);
  return NextResponse.json({
    ok: true,
    grade: me.channelGrades?.instagram ?? me.grade,
    influence: inf,
    analyzed,
  });
}
