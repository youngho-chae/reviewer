// 한국어 날짜·시각 포맷 유틸 (2026-07-08 UI 개편).
// 발급 기한("7월 19일 (일) 오후 2:30까지 결제")·체험권 유효기간 표기에 공용.
// 스토리보드 모드에서는 SBUI.dateTime 마스크와 함께 sbNum으로 감싸 사용한다.

const KO_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

// "7월 12일 (일) 오후 2:00" — 요일 한글, 오전/오후 12시간제
export function fmtKoDateTime(ts: number): string {
  const d = new Date(ts);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = KO_WEEKDAYS[d.getDay()];
  const h24 = d.getHours();
  const meridiem = h24 < 12 ? "오전" : "오후";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${month}월 ${day}일 (${weekday}) ${meridiem} ${h12}:${mm}`;
}
