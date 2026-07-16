import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * KFTC 오픈뱅킹 Callback URL (2026-07-12)
 *
 * 오픈뱅킹 개발자 콘솔(developers.kftc.or.kr)의 앱 정보에 등록하는 주소:
 *   로컬 테스트:  http://localhost:3000/api/openbanking/callback
 *   배포 환경:    https://{배포 도메인}/api/openbanking/callback
 *
 * 현행 출금 계좌 인증은 2-legged 계좌실명조회(무리다이렉트)라 이 콜백이 런타임에 호출되지
 * 않지만, 콘솔의 Callback URL은 필수 등록값이며 향후 3-legged 사용자 인증(계좌 등록·잔액/
 * 거래내역 조회 — /oauth/2.0/authorize) 확장 시 인가 코드(code)가 이 주소로 리다이렉트된다.
 * 지금은 파라미터를 안전하게 수신·정리하고 포인트 화면으로 복귀시키는 안착 지점만 제공한다.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDesc = url.searchParams.get("error_description");

  const dest = new URL("/r/me/points", url.origin);
  if (error) {
    // 사용자 거부·오류 — 원문은 노출하지 않고 상태만 전달 (로그로 원인 확인)
    console.warn(`[openbanking] callback error: ${error} ${errorDesc ?? ""}`);
    dest.searchParams.set("ob", "error");
  } else if (code) {
    // 3-legged 토큰 교환은 사용자 인증 플로우 도입 시 구현 — 인가 코드는 저장하지 않는다.
    dest.searchParams.set("ob", "callback");
  }
  return NextResponse.redirect(dest);
}
