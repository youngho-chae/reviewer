// 비밀번호 정책 — 역할별 정본 (규칙 변경은 여기서만).
//  · 체험자 (2026-08-18 확정): 영문·숫자·특수문자를 각 1자 이상 필수 포함, 6자 이상.
//    체험자 가입 폼·회원 정보 수정·signup API 체험자 분기가 공유.
//  · 사장님 (2026-09-03 확정): 영문 대문자·소문자·숫자를 각 1자 이상 필수 포함, 8~16자
//    (특수문자는 허용하되 비필수). 사장님 가입 폼·signup API owner 분기가 공유.
export const PASSWORD_RULE_TEXT = "영문·숫자·특수문자를 모두 포함, 6자 이상";

export function validatePassword(pw: string): string | null {
  if (pw.length < 6) return "비밀번호는 6자 이상이어야 해요";
  if (!/[A-Za-z]/.test(pw)) return "비밀번호에 영문을 포함해주세요";
  if (!/\d/.test(pw)) return "비밀번호에 숫자를 포함해주세요";
  if (!/[^A-Za-z0-9\s]/.test(pw)) return "비밀번호에 특수문자를 포함해주세요";
  return null;
}

export const OWNER_PASSWORD_RULE_TEXT = "영문 대·소문자와 숫자를 모두 포함, 8~16자";

export function validateOwnerPassword(pw: string): string | null {
  if (pw.length < 8 || pw.length > 16) return "비밀번호는 8~16자여야 해요";
  if (!/[A-Z]/.test(pw)) return "비밀번호에 영문 대문자를 포함해주세요";
  if (!/[a-z]/.test(pw)) return "비밀번호에 영문 소문자를 포함해주세요";
  if (!/\d/.test(pw)) return "비밀번호에 숫자를 포함해주세요";
  return null;
}
