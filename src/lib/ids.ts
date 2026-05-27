export function rid(prefix: string = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

// 체험권 단축 코드 — QR 스캔 실패 시 사장님이 수기로 입력 가능한 8자 영문/숫자.
// 헷갈리기 쉬운 문자(O, 0, I, 1, L) 제외해 가독성 확보.
const PASS_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31자
export function passCode(): string {
  const buf = new Uint32Array(8);
  if (typeof crypto !== "undefined" && (crypto as any).getRandomValues) {
    (crypto as any).getRandomValues(buf);
  } else {
    for (let i = 0; i < 8; i++) buf[i] = Math.floor(Math.random() * 0xffffffff);
  }
  let s = "";
  for (let i = 0; i < 8; i++) s += PASS_ALPHABET[buf[i] % PASS_ALPHABET.length];
  return s;
}

// 시각용 — 8자 코드를 4-4로 끊어 표시 (XK7H 3M9P)
export function formatPassCode(code: string): string {
  if (code.length !== 8) return code;
  return `${code.slice(0, 4)} ${code.slice(4)}`;
}

// 사장님 입력 정규화 — 공백/대시 제거 + 대문자
export function normalizePassCode(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}
