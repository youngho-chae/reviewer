// 결제(PG) 테스트 모듈 연결 (2026-08-30) — 다날 테스트 결제창 단일 정본.
// 모든 결제 관련 UI의 "최종 결제 버튼"(리필권 [구매하기]·플랜 [구독하기]·[연간으로 변경])이
// 클릭 시 이 창을 새 탭으로 연 뒤 기존 처리 플로우(쿠폰 발급·플랜 변경)를 계속한다.
//  - 실제 결제가 가능한 테스트 모듈 — 금액은 무관(고정 링크), 결과 콜백 없음(앱 상태와 미연동).
//  - 팝업 차단 회피: 반드시 클릭 핸들러에서 "await 이전에" 동기 호출할 것.
//  - 환급·해지(연간→월간 전환, 멤버십 해지)는 결제가 아니므로 열지 않는다.
// 실 PG 전환 시 이 파일의 URL·호출부만 교체하면 된다.
export const PAYMENT_TEST_URL =
  process.env.NEXT_PUBLIC_PAYMENT_TEST_URL || "https://nalda.danalpay.com/nalda/S/KSkJshITBkpYrkXLrMVZ";

export function openPaymentTestWindow() {
  if (typeof window === "undefined") return;
  window.open(PAYMENT_TEST_URL, "_blank", "noopener,noreferrer");
}
