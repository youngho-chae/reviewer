import { NextRequest, NextResponse } from "next/server";
import { normalizePhone, verifyOtp } from "@/lib/phone-verify";

export const runtime = "nodejs";

// 인증번호 확인 (2026-07-23) — 일치 시 증빙 쿠키(15분) 발급 → 가입 API가 재검증한다.
export async function POST(req: NextRequest) {
  const { phone: raw, code } = await req.json();
  const phone = normalizePhone(raw);
  if (!phone) return NextResponse.json({ error: "휴대폰 번호를 확인해주세요" }, { status: 400 });
  if (!/^\d{6}$/.test(String(code ?? "").trim())) {
    return NextResponse.json({ error: "인증번호 6자리를 입력해주세요" }, { status: 400 });
  }
  const err = await verifyOtp(phone, String(code).trim());
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  return NextResponse.json({ ok: true });
}
