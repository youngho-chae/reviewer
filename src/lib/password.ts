// 비밀번호 정책 (2026-08-18 확정) — 영문·숫자·특수문자를 각 1자 이상 필수 포함, 6자 이상.
// 가입 폼(체험자·사장님)과 signup API가 공유하는 단일 정본 — 규칙 변경은 여기서만.
export const PASSWORD_RULE_TEXT = "영문·숫자·특수문자를 모두 포함, 6자 이상";

export function validatePassword(pw: string): string | null {
  if (pw.length < 6) return "비밀번호는 6자 이상이어야 해요";
  if (!/[A-Za-z]/.test(pw)) return "비밀번호에 영문을 포함해주세요";
  if (!/\d/.test(pw)) return "비밀번호에 숫자를 포함해주세요";
  if (!/[^A-Za-z0-9\s]/.test(pw)) return "비밀번호에 특수문자를 포함해주세요";
  return null;
}
