import { NextRequest, NextResponse } from "next/server";
import { getDBAsync } from "@/lib/db";
import { normalizePhone, issueOtp, smsConfigured, sendSmsViaSolapi, OTP_TTL_MIN } from "@/lib/phone-verify";

export const runtime = "nodejs";

// 가입 인증번호 발송 (2026-07-23) — 휴대폰 번호 = 체험자 PK.
// 이미 가입된 번호는 발송 전에 알려 재가입 시도를 로그인으로 유도한다.
// SMS 키 미설정 시 데모 모드 — 응답에 코드를 포함해 화면 배너로 노출(실발송 없음 명시).
export async function POST(req: NextRequest) {
  const { phone: raw } = await req.json();
  const phone = normalizePhone(raw);
  if (!phone) return NextResponse.json({ error: "휴대폰 번호를 확인해주세요 (01로 시작하는 10~11자리)" }, { status: 400 });

  const db = await getDBAsync();
  if (db.reviewers.some((r) => r.phone === phone)) {
    return NextResponse.json({ error: "이미 가입된 휴대폰 번호예요 — 로그인해주세요" }, { status: 409 });
  }

  const code = await issueOtp(phone);
  if (smsConfigured()) {
    try {
      await sendSmsViaSolapi(phone, `[CATCHPASS] 인증번호 ${code}를 입력해주세요. (${OTP_TTL_MIN}분 이내)`);
    } catch (e) {
      return NextResponse.json({ error: `인증번호 발송에 실패했어요 — 잠시 후 다시 시도해주세요 (${(e as Error).message})` }, { status: 502 });
    }
    return NextResponse.json({ ok: true, ttlMin: OTP_TTL_MIN });
  }
  // 데모 모드 — 실발송 없이 코드 노출 (지도·오픈뱅킹·SNS 검증과 동일 관례)
  return NextResponse.json({ ok: true, ttlMin: OTP_TTL_MIN, demo: true, code });
}
