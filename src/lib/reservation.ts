// 예약형 방문 — 희망 일시 선택·검증·표기 (2026-07-16 리뷰노트 벤치마크, 정본: 운영정책서 §15)
//
// 즉시 발급 구조 유지: 예약은 선정/승인 절차가 아니라 "발급과 동시에 시작되는 일정 조율"이다.
//  - 신청 시 희망 방문 일시 필수 선택 → 사장님이 [예약 확인]으로 확정 (거절 없음 — P1)
//  - 체험권 유효기간 = 예약일 당일 말(KST 23:59) — 72h 고정 기한의 명시적 예외
//  - 예약 변경(사용 전) 시 확인 대기로 복귀 + 유효기간 재계산
// 클라이언트(발급 시트)와 서버(/api/passes·/api/passes/reservation)가 이 모듈을 공유한다.

import type { PassReservation } from "./types";

// 오늘부터 선택 가능한 최대 일수 (캠페인 종료일이 더 이르면 종료일까지)
export const RESERVATION_AHEAD_MAX_DAYS = 14;

// 공통 방문 시간 슬롯 (30분 단위) — 매장별 영업시간 슬롯·시간대 정원은 §13 후속 제안
export const RESERVATION_TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let h = 11; h <= 20; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 21) slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots; // 11:00 ~ 20:30
})();

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const KO_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

// 오늘 날짜(KST) — "YYYY-MM-DD"
export function kstTodayStr(now: number = Date.now()): string {
  return new Date(now + KST_OFFSET_MS).toISOString().slice(0, 10);
}

// 예약 일시 → epoch ms (KST 고정 해석 — 서버 TZ와 무관)
export function reservationEpoch(date: string, time: string): number {
  return Date.parse(`${date}T${time}:00+09:00`);
}

// 예약일 당일 말(KST 23:59:59) — 예약형 체험권의 expiresAt
export function reservationDayEnd(date: string): number {
  return Date.parse(`${date}T23:59:59+09:00`);
}

// 선택 가능한 날짜 목록 — 오늘(KST)부터 min(14일, 캠페인 종료일)까지
export function reservationDateOptions(endAt: number, now: number = Date.now()): string[] {
  const out: string[] = [];
  const startMs = now;
  for (let i = 0; i < RESERVATION_AHEAD_MAX_DAYS; i++) {
    const d = new Date(startMs + KST_OFFSET_MS + i * 24 * 60 * 60 * 1000);
    const date = d.toISOString().slice(0, 10);
    // 해당 날짜에 캠페인이 이미 끝나 있으면 제외 (당일 시작 시점 기준)
    if (Date.parse(`${date}T00:00:00+09:00`) > endAt) break;
    out.push(date);
  }
  return out;
}

// 유효성 검증 — 통과 시 null, 실패 시 사용자 표시용 오류 메시지
export function validateReservation(
  date: string,
  time: string,
  endAt: number,
  now: number = Date.now(),
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !RESERVATION_TIME_SLOTS.includes(time)) {
    return "방문 예정 일시를 선택해주세요";
  }
  const epoch = reservationEpoch(date, time);
  if (!Number.isFinite(epoch)) return "방문 예정 일시를 선택해주세요";
  if (epoch <= now) return "지난 시간이에요 — 방문 예정 일시를 다시 선택해주세요";
  if (epoch > endAt) return "캠페인 종료일 이후로는 예약할 수 없어요";
  if (reservationEpoch(date, "00:00") - now > RESERVATION_AHEAD_MAX_DAYS * 24 * 60 * 60 * 1000) {
    return `방문 예약은 ${RESERVATION_AHEAD_MAX_DAYS}일 이내로 선택할 수 있어요`;
  }
  return null;
}

// "7월 18일 (토) 14:00" — TZ 무관 순수 문자열 조합 (스토리보드 모드에서는 SBUI.dateTime 마스크와 병용)
export function fmtReservationLabel(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = KO_WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}월 ${d}일 (${weekday}) ${time}`;
}

// 날짜 select 라벨 — "7월 18일 (토)"
export function fmtReservationDateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = KO_WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}월 ${d}일 (${weekday})`;
}

export const RESERVATION_STATUS_LABEL: Record<PassReservation["status"], string> = {
  requested: "예약 확인 대기",
  confirmed: "예약 확정",
};
