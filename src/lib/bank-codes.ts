// 은행명 → 표준 은행코드(bank_code_std) — 클라이언트(출금 폼 셀렉트)와 서버(계좌실명조회)가
// 공유하는 단일 정본. 서버 전용 로직은 openbanking.ts (이 파일은 클라이언트 안전).

export const BANK_CODES: Array<{ code: string; name: string }> = [
  { code: "004", name: "KB국민은행" },
  { code: "088", name: "신한은행" },
  { code: "020", name: "우리은행" },
  { code: "081", name: "하나은행" },
  { code: "011", name: "NH농협은행" },
  { code: "003", name: "IBK기업은행" },
  { code: "090", name: "카카오뱅크" },
  { code: "089", name: "케이뱅크" },
  { code: "092", name: "토스뱅크" },
  { code: "023", name: "SC제일은행" },
  { code: "027", name: "씨티은행" },
  { code: "002", name: "KDB산업은행" },
  { code: "007", name: "Sh수협은행" },
  { code: "031", name: "대구은행" },
  { code: "032", name: "부산은행" },
  { code: "034", name: "광주은행" },
  { code: "035", name: "제주은행" },
  { code: "037", name: "전북은행" },
  { code: "039", name: "경남은행" },
  { code: "045", name: "새마을금고" },
  { code: "048", name: "신협" },
  { code: "071", name: "우체국" },
];

export function bankCodeOf(bankName: string): string | null {
  return BANK_CODES.find((b) => b.name === bankName)?.code ?? null;
}
