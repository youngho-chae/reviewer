// 네이버 클라우드 플랫폼 CLOVA OCR (General) 클라이언트 (2026-07-28 — 인스타 캡처 인증).
//
// 인스타그램은 데이터센터 IP의 서버 크롤이 전면 차단(로그인 벽/429)이라 소개(bio)
// 접근이 불가 → 유저가 소개 수정 화면 캡처를 업로드하면 OCR로 "입력한 SNS 계정 ID +
// 발급된 계정 인증코드"가 이미지에 있는지 검증한다 (점유 인증).
//
// [설정] NCP 콘솔에서 발급한 값 2개를 환경변수로 입력하면 즉시 구동:
//   NCP_OCR_INVOKE_URL = API Gateway Invoke URL (CLOVA OCR 도메인 연동 주소 — .../general 전체 경로)
//   NCP_OCR_SECRET     = CLOVA OCR Secret Key (X-OCR-SECRET 헤더)
// 로컬은 .env.local, 배포는 Vercel 환경변수. 미설정 시 이 기능은 503으로 안내된다.
// 샌드박스 검증은 스텁(scripts/sns-bio-stub.mjs /ocr)으로 — 기존 크롤 스텁과 동일 관례.

import crypto from "node:crypto";

const INVOKE_URL = process.env.NCP_OCR_INVOKE_URL || "";
const SECRET = process.env.NCP_OCR_SECRET || "";

export function ocrConfigured(): boolean {
  return INVOKE_URL.length > 0 && SECRET.length > 0;
}

export type OcrResult =
  | { ok: true; text: string }
  | { ok: false; reason: "unconfigured" | "http" | "parse"; detail?: string };

// 이미지(base64, data: 접두 제거분)를 CLOVA OCR General에 보내 전체 텍스트를 추출.
// 응답의 images[0].fields[].inferText를 공백으로 이어 붙여 돌려준다.
export async function ocrExtractText(imageBase64: string, format: string): Promise<OcrResult> {
  if (!ocrConfigured()) return { ok: false, reason: "unconfigured" };
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 20_000);
    const r = await fetch(INVOKE_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "X-OCR-SECRET": SECRET },
      body: JSON.stringify({
        version: "V2",
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
        images: [{ format, name: "sns-bio", data: imageBase64 }],
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!r.ok) {
      const body = (await r.text().catch(() => "")).slice(0, 300);
      console.log(`[sns-bio] CLOVA OCR HTTP ${r.status} — ${body}`);
      return { ok: false, reason: "http", detail: `HTTP ${r.status} ${body.slice(0, 120)}` };
    }
    const j = (await r.json()) as {
      images?: Array<{ inferResult?: string; message?: string; fields?: Array<{ inferText?: string }> }>;
    };
    const img = j.images?.[0];
    if (!img || (img.inferResult && img.inferResult !== "SUCCESS")) {
      // NCP가 알려주는 실패 사유(message)까지 로그·detail로 — 도메인 타입(General/Template)·
      // 포맷 문제 등 콘솔 설정 이슈를 원문으로 특정할 수 있게 한다 (2026-07-30 QA)
      console.log(
        `[sns-bio] CLOVA OCR inferResult=${img?.inferResult ?? "없음"} — 응답: ${JSON.stringify(j).slice(0, 400)}`,
      );
      return {
        ok: false,
        reason: "parse",
        detail: `inferResult=${img?.inferResult ?? "없음"}${img?.message ? ` · ${img.message}` : ""}`,
      };
    }
    const text = (img.fields ?? [])
      .map((f) => String(f.inferText ?? ""))
      .filter(Boolean)
      .join(" ");
    return { ok: true, text };
  } catch (e) {
    console.log(`[sns-bio] CLOVA OCR 호출 실패: ${e instanceof Error ? e.name : "unknown"}`);
    return { ok: false, reason: "http" };
  }
}
