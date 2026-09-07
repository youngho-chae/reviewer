// 비밀번호 정책 (2026-09-03 전 역할 통일) — 영문 대문자·소문자·숫자를 각 1자 이상 필수 포함,
// 8~16자 (특수문자는 허용하되 비필수). 체험자·사장님 가입 폼, 체험자 비밀번호 변경(회원 정보
// 수정·/api/reviewer/account), signup API가 공유하는 단일 정본 — 규칙 변경은 여기서만.
// 구 체험자 규칙(영문·숫자·특수문자 6자+, 2026-08-18)은 폐기 — 기존 계정 해시는 로그인에
// 재검증이 없어 무영향(새 규칙은 신규 가입·비밀번호 변경에만 적용).
export const PASSWORD_RULE_TEXT = "영문 대·소문자와 숫자를 모두 포함, 8~16자";

export function validatePassword(pw: string): string | null {
  if (pw.length < 8 || pw.length > 16) return "비밀번호는 8~16자여야 해요";
  if (!/[A-Z]/.test(pw)) return "비밀번호에 영문 대문자를 포함해주세요";
  if (!/[a-z]/.test(pw)) return "비밀번호에 영문 소문자를 포함해주세요";
  if (!/\d/.test(pw)) return "비밀번호에 숫자를 포함해주세요";
  return null;
}
