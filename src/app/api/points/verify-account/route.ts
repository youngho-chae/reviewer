import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import {
  ACCT_VERIFY_COOKIE,
  ACCT_VERIFY_TTL_MS,
  bankCodeOf,
  inquireRealName,
  openbankingConfigured,
  signAccountProof,
} from "@/lib/openbanking";

export const runtime = "nodejs";

// 출금 계좌 본인 인증 (2026-07-12 출금 고도화) — KFTC 오픈뱅킹 계좌실명조회.
// 입력한 예금주와 조회된 실제 예금주가 일치해야 인증 성공. 성공 시 HMAC 서명 증빙을
// httpOnly 쿠키(10분)로 내려주고, 출금 신청 API가 동일 계좌 정보인지 대조한다.
// KFTC 키(env) 미설정 시 데모 인증 모드(via:"demo") — 화면 플로우는 동일하게 동작.
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "reviewer") return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const body = await req.json();
  const bank = String(body.bank || "").trim();
  const account = String(body.account || "").replace(/[^0-9]/g, "");
  const holder = String(body.holder || "").trim();
  const birthday = String(body.birthday || "").replace(/[^0-9]/g, "");

  if (!bank || !account || !holder) {
    return NextResponse.json({ error: "은행·계좌번호·예금주를 모두 입력해주세요" }, { status: 400 });
  }
  if (account.length < 8) {
    return NextResponse.json({ error: "계좌번호를 확인해주세요" }, { status: 400 });
  }

  let via: "openbanking" | "demo";
  let holderName = holder;

  if (openbankingConfigured()) {
    const bankCodeStd = bankCodeOf(bank);
    if (!bankCodeStd) return NextResponse.json({ error: "지원하지 않는 은행입니다" }, { status: 400 });
    if (!/^\d{6}$/.test(birthday)) {
      return NextResponse.json({ error: "생년월일 6자리를 입력해주세요 (계좌 실명 확인용)" }, { status: 400 });
    }
    let result;
    try {
      result = await inquireRealName({ bankCodeStd, accountNum: account, birthday });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "오픈뱅킹 연동 오류" }, { status: 502 });
    }
    if (!result.ok) {
      return NextResponse.json(
        { error: result.message || "계좌 정보를 확인할 수 없습니다", rspCode: result.rspCode },
        { status: 400 },
      );
    }
    // 예금주 대조 — 공백 제거 후 완전 일치 (조회 성명은 저장하지 않고 대조에만 사용)
    const norm = (v: string) => v.replace(/\s+/g, "");
    if (!result.holderName || norm(result.holderName) !== norm(holder)) {
      return NextResponse.json(
        { error: "예금주가 계좌 정보와 일치하지 않습니다. 본인 명의 계좌인지 확인해주세요." },
        { status: 400 },
      );
    }
    via = "openbanking";
    holderName = result.holderName;
  } else {
    // 데모 인증 — 키 미설정 환경 시연용 (실키 설정 시 자동으로 실 조회로 전환)
    via = "demo";
  }

  const proof = signAccountProof({ reviewerId: s.userId, bank, account, holder, via, at: Date.now() });
  const res = NextResponse.json({ verified: true, via, holderName });
  res.cookies.set(ACCT_VERIFY_COOKIE, proof, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.floor(ACCT_VERIFY_TTL_MS / 1000),
    path: "/",
  });
  return res;
}
