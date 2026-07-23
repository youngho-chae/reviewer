// 예약형 방문 — 희망 일시 선택·검증·표기 (2026-07-16 리뷰노트 벤치마크, 정본: 운영정책서 §15)
//
// 즉시 발급 구조 유지: 예약은 선정/승인 절차가 아니라 "발급과 동시에 시작되는 일정 조율"이다.
//  - 신청 시 희망 방문 일시 필수 선택 → 사장님이 [예약 확인]으로 확정 (거절 없음 — P1)
//  - 체험권 유효기간 = 예약일 당일 말(KST 23:59) — 72h 고정 기한의 명시적 예외
//  - 예약 변경(사용 전) 시 확인 대기로 복귀 + 유효기간 재계산
// 클라이언트(발급 시트)와 서버(/api/passes·/api/passes/reservation)가 이 모듈을 공유한다.

import type { Campaign, Pass, PassReservation, ReservationBlocks, ReservationEvent, ReservationSchedule } from "./types";

// 오늘부터 선택 가능한 최대 일수 (캠페인 종료일이 더 이르면 종료일까지)
export const RESERVATION_AHEAD_MAX_DAYS = 14;

// ── 시간 유틸 (30분 단위 "HH:mm" — "24:00"은 자정(익일 0시) 종료 표기로 허용) ──
export function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
export function minToTime(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

// 12시간제 표기 (2026-07-22 §7-2 — 전 서비스 통일: "오전 10시" / "오후 3시 30분", "15시" 금지)
export function fmtTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const meridiem = h < 12 || h === 24 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m > 0 ? `${meridiem} ${h12}시 ${m}분` : `${meridiem} ${h12}시`;
}

// 예약 운영 기본 스케줄 — reservationSchedule 미설정 구버전 캠페인 해석용
// (기존 공통 슬롯 11:00~20:30과 동일한 범위 · 전 요일 · 시간대당 1팀)
export const DEFAULT_RESERVATION_SCHEDULE: ReservationSchedule = {
  days: [0, 1, 2, 3, 4, 5, 6],
  open: "11:00",
  close: "21:00",
  slotCapacity: 1,
};

// 같은 시간대 동시 예약 가능 팀 수 한도 (§13 확정 필요 A 기본안 — 캠페인 설정 1~5, 기본 1팀)
export const SLOT_CAPACITY_MIN = 1;
export const SLOT_CAPACITY_MAX = 5;

type ScheduleSource = Pick<Campaign, "reservationSchedule" | "reservationBlocks">;

export function scheduleOf(c: ScheduleSource | undefined): ReservationSchedule {
  const s = c?.reservationSchedule;
  if (!s || !Array.isArray(s.days) || s.days.length === 0 || !s.open || !s.close) {
    return DEFAULT_RESERVATION_SCHEDULE;
  }
  return s;
}

export function slotCapacityOf(c: ScheduleSource | undefined): number {
  const cap = scheduleOf(c).slotCapacity ?? 1;
  return Math.min(SLOT_CAPACITY_MAX, Math.max(SLOT_CAPACITY_MIN, Math.floor(cap)));
}

// 캠페인 운영시간 내 30분 단위 슬롯 (2026-07-22 §2-2 — 브레이크 타임 구간 포함, 표시는 비활성 처리)
export function campaignTimeSlots(schedule: ReservationSchedule): string[] {
  const open = timeToMin(schedule.open);
  const close = timeToMin(schedule.close);
  const out: string[] = [];
  for (let m = open; m < close; m += 30) out.push(minToTime(m));
  return out;
}

// 브레이크 타임 포함 여부 — [breakStart, breakEnd) 구간의 슬롯은 예약 불가·비활성 표시 (2-4)
export function inBreakTime(schedule: ReservationSchedule, time: string): boolean {
  if (!schedule.breakStart || !schedule.breakEnd) return false;
  const t = timeToMin(time);
  return t >= timeToMin(schedule.breakStart) && t < timeToMin(schedule.breakEnd);
}

// 요일 허용 여부 — 선택하지 않은 요일에는 예약 신청 불가 (2-3)
export function isDayAllowed(schedule: ReservationSchedule, date: string): boolean {
  const [y, m, d] = date.split("-").map(Number);
  return schedule.days.includes(new Date(Date.UTC(y, m - 1, d)).getUTCDay());
}

// 사장님 차단 판정 (§6) — 날짜 차단 / 당일 일시중지(pausedDate=오늘일 때만 유효 → 자정 자연 해제)
export function isDateBlocked(blocks: ReservationBlocks | undefined, date: string, now: number = Date.now()): boolean {
  if (!blocks) return false;
  if (blocks.dates?.includes(date)) return true;
  if (blocks.pausedDate && blocks.pausedDate === date && blocks.pausedDate === kstTodayStr(now)) return true;
  return false;
}

export function isSlotBlocked(blocks: ReservationBlocks | undefined, date: string, time: string): boolean {
  return !!blocks?.slots?.some((s) => s.date === date && s.time === time);
}

// 시간대 점유 팀 수 — 살아있는(사용 전) 예약 패스만 집계.
// 취소·거절·만료되면 집계에서 빠져 정원이 자동 복구된다 (§13-A — 별도 원장 없음).
export function reservationTakenCount(passes: Pass[], campaignId: string, date: string, time: string, excludePassId?: string): number {
  return passes.filter(
    (p) =>
      p.campaignId === campaignId &&
      p.id !== excludePassId &&
      p.status === "active" &&
      p.reservation &&
      p.reservation.date === date &&
      p.reservation.time === time,
  ).length;
}

// 예약 가능 시작일 (2-5 · 2026-07-23 정정) — 신청 시도 가능 시점이 아니라 **방문 날짜의 하한**이다.
// 예: 캠페인 오픈 7/23·예약 시작일 7/25 → 지금 바로 신청할 수 있고, 날짜 피커에서 23·24일만 비활성.
// 반환: 하한 날짜 문자열("YYYY-MM-DD") 또는 null(제한 없음).
export function reservationOpenDate(c: ScheduleSource): string | null {
  const opensAt = c.reservationSchedule?.opensAt;
  return opensAt ? kstTodayStr(opensAt) : null;
}

export interface ReservationDateOption {
  date: string;
  label: string; // "7월 18일 (토)"
  disabled: boolean;
  reason?: "day_off" | "blocked" | "not_open";
}

// 캠페인 스케줄 기준 날짜 선택지 — 오늘부터 min(14일, 종료일)까지.
// 휴무 요일·차단 날짜·오픈 전 날짜(opensAt 이전 — not_open)는 비활성 표시.
// opensAt이 미래면 14일 윈도우의 기준점을 오픈일로 옮겨, 오픈일부터 14일까지 선택할 수 있게 한다.
export function campaignDateOptions(
  c: Pick<Campaign, "endAt" | "reservationSchedule" | "reservationBlocks">,
  now: number = Date.now(),
): ReservationDateOption[] {
  const schedule = scheduleOf(c);
  const openDate = reservationOpenDate(c);
  const anchor = openDate && Date.parse(`${openDate}T00:00:00+09:00`) > now ? Date.parse(`${openDate}T00:00:00+09:00`) : now;
  const out: ReservationDateOption[] = [];
  for (let i = 0; i < 60; i++) {
    const d = new Date(now + 9 * 60 * 60 * 1000 + i * 24 * 60 * 60 * 1000);
    const date = d.toISOString().slice(0, 10);
    const dayStart = Date.parse(`${date}T00:00:00+09:00`);
    if (dayStart > c.endAt) break;
    if (dayStart - anchor > RESERVATION_AHEAD_MAX_DAYS * 24 * 60 * 60 * 1000) break;
    if (openDate && date < openDate) {
      out.push({ date, label: fmtReservationDateLabel(date), disabled: true, reason: "not_open" });
    } else if (!isDayAllowed(schedule, date)) {
      out.push({ date, label: fmtReservationDateLabel(date), disabled: true, reason: "day_off" });
    } else if (isDateBlocked(c.reservationBlocks, date, now)) {
      out.push({ date, label: fmtReservationDateLabel(date), disabled: true, reason: "blocked" });
    } else {
      out.push({ date, label: fmtReservationDateLabel(date), disabled: false });
    }
  }
  return out;
}

export interface ReservationSlotStatus {
  time: string;
  label: string; // 12시간제 "오후 3시 30분"
  disabled: boolean;
  reason?: "past" | "break" | "blocked" | "full";
}

// 특정 날짜의 시간 슬롯 상태 (§7-1) — 비활성 사유: 지난 시간 / 브레이크 타임 / 차단 / 정원 마감.
// takenByTime: 시간별 점유 팀 수 (서버에서 reservationTakenCount로 집계해 전달)
export function campaignSlotStatuses(
  c: Pick<Campaign, "reservationSchedule" | "reservationBlocks">,
  date: string,
  takenByTime: Record<string, number>,
  now: number = Date.now(),
): ReservationSlotStatus[] {
  const schedule = scheduleOf(c);
  const capacity = slotCapacityOf(c);
  return campaignTimeSlots(schedule).map((time) => {
    const label = fmtTime12(time);
    if (reservationEpoch(date, time) <= now) return { time, label, disabled: true, reason: "past" as const };
    if (inBreakTime(schedule, time)) return { time, label, disabled: true, reason: "break" as const };
    if (isSlotBlocked(c.reservationBlocks, date, time)) return { time, label, disabled: true, reason: "blocked" as const };
    if ((takenByTime[time] ?? 0) >= capacity) return { time, label, disabled: true, reason: "full" as const };
    return { time, label, disabled: false };
  });
}

// 서버 종합 검증 (3-2) — 발급·변경·재제안·사장님 제안이 공유한다. 통과 시 null.
export function validateReservationForCampaign(
  c: Pick<Campaign, "endAt" | "reservationSchedule" | "reservationBlocks">,
  passes: Pass[],
  campaignId: string,
  date: string,
  time: string,
  opts: { now?: number; excludePassId?: string; skipCapacity?: boolean } = {},
): string | null {
  const now = opts.now ?? Date.now();
  // 오픈일이 미래면 14일 윈도우 기준점도 오픈일로 (campaignDateOptions와 동일 앵커)
  const openDate = reservationOpenDate(c);
  const windowAnchor =
    openDate && Date.parse(`${openDate}T00:00:00+09:00`) > now ? Date.parse(`${openDate}T00:00:00+09:00`) : now;
  const base = validateReservation(date, time, c.endAt, now, scheduleOf(c), windowAnchor);
  if (base) return base;
  // 예약 가능 시작일 = 방문 날짜 하한 (2026-07-23 정정 — 신청 시도는 즉시 가능)
  if (openDate && date < openDate) {
    return `${fmtReservationDateLabel(openDate)}부터 방문 예약을 받아요 — 날짜를 다시 선택해주세요`;
  }
  const schedule = scheduleOf(c);
  if (!isDayAllowed(schedule, date)) return "예약을 받지 않는 요일이에요 — 다른 날짜를 선택해주세요";
  if (isDateBlocked(c.reservationBlocks, date, now)) return "매장 사정으로 예약이 마감된 날이에요 — 다른 날짜를 선택해주세요";
  if (inBreakTime(schedule, time)) return "브레이크 타임이에요 — 다른 시간을 선택해주세요";
  if (isSlotBlocked(c.reservationBlocks, date, time)) return "예약이 마감된 시간이에요 — 다른 시간을 선택해주세요";
  if (!opts.skipCapacity) {
    const taken = reservationTakenCount(passes, campaignId, date, time, opts.excludePassId);
    if (taken >= slotCapacityOf(c)) return "해당 시간대 예약이 마감되었어요 — 다른 시간을 선택해주세요";
  }
  return null;
}

// [호환] 공통 방문 시간 슬롯 — 스케줄 미설정 캠페인(기본 스케줄)의 슬롯.
// 스케줄이 있는 캠페인은 campaignTimeSlots(scheduleOf(c))를 사용할 것.
export const RESERVATION_TIME_SLOTS: string[] = campaignTimeSlots(DEFAULT_RESERVATION_SCHEDULE);

// ── 날짜/시간 선택지 (클라이언트 전달용) — 서버가 스케줄·차단·정원을 계산해 직렬화 ──
export interface ReservationPicker {
  dates: Array<{ date: string; label: string; disabled: boolean; reason?: ReservationDateOption["reason"] }>;
  slotsByDate: Record<string, Array<{ time: string; label: string; disabled: boolean; reason?: ReservationSlotStatus["reason"] }>>;
}

// 발급 시트·예약 변경·재제안이 공유하는 선택지 빌더 (§3-2, §7-1).
// excludePassId: 본인 패스는 정원 집계에서 제외 (변경 시 현재 슬롯 유지 가능)
export function buildReservationPicker(
  c: Pick<Campaign, "id" | "endAt" | "reservationSchedule" | "reservationBlocks">,
  passes: Pass[],
  excludePassId?: string,
  now: number = Date.now(),
): ReservationPicker {
  const dates = campaignDateOptions(c, now).map((d) => ({
    date: d.date,
    label: d.label,
    disabled: d.disabled,
    ...(d.reason ? { reason: d.reason } : {}),
  }));
  const slotsByDate: ReservationPicker["slotsByDate"] = {};
  for (const d of dates) {
    if (d.disabled) continue;
    const taken: Record<string, number> = {};
    for (const p of passes) {
      if (p.campaignId === c.id && p.id !== excludePassId && p.status === "active" && p.reservation?.date === d.date) {
        taken[p.reservation.time] = (taken[p.reservation.time] ?? 0) + 1;
      }
    }
    slotsByDate[d.date] = campaignSlotStatuses(c, d.date, taken, now).map((s) => ({
      time: s.time,
      label: s.label,
      disabled: s.disabled,
      ...(s.reason ? { reason: s.reason } : {}),
    }));
  }
  return { dates, slotsByDate };
}

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

// 예약형 체험권 expiresAt — 방문 희망일 **+1일** 말(KST 23:59:59)까지 QR 유지 (2026-07-17 회의).
// 방문 당일을 넘겨도 다음날까지는 사용 처리(QR)가 가능하다.
export function reservationDayEnd(date: string): number {
  return Date.parse(`${date}T23:59:59+09:00`) + 24 * 60 * 60 * 1000;
}

// 방문 인원수 (2026-07-17 회의 — 신청 시 필수)
export const RESERVATION_PARTY_MIN = 1;
export const RESERVATION_PARTY_MAX = 10;

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

// 기본 유효성 검증 — 통과 시 null, 실패 시 사용자 표시용 오류 메시지.
// 스케줄·차단·정원까지 포함한 종합 검증은 validateReservationForCampaign 사용.
export function validateReservation(
  date: string,
  time: string,
  endAt: number,
  now: number = Date.now(),
  schedule: ReservationSchedule = DEFAULT_RESERVATION_SCHEDULE,
  windowAnchor: number = now, // 14일 윈도우 기준점 — 예약 오픈일이 미래면 오픈일 (2026-07-23)
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !campaignTimeSlots(schedule).includes(time)) {
    return "방문 예정 일시를 선택해주세요";
  }
  const epoch = reservationEpoch(date, time);
  if (!Number.isFinite(epoch)) return "방문 예정 일시를 선택해주세요";
  if (epoch <= now) return "지난 시간이에요 — 방문 예정 일시를 다시 선택해주세요";
  if (epoch > endAt) return "캠페인 종료일 이후로는 예약할 수 없어요";
  if (reservationEpoch(date, "00:00") - windowAnchor > RESERVATION_AHEAD_MAX_DAYS * 24 * 60 * 60 * 1000) {
    return `방문 예약은 ${RESERVATION_AHEAD_MAX_DAYS}일 이내로 선택할 수 있어요`;
  }
  return null;
}

// "7월 18일 (토) 오후 2시" — 12시간제 통일 (§7-2). TZ 무관 순수 문자열 조합
// (스토리보드 모드에서는 SBUI.dateTime 마스크와 병용)
export function fmtReservationLabel(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = KO_WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}월 ${d}일 (${weekday}) ${fmtTime12(time)}`;
}

// 날짜 select 라벨 — "7월 18일 (토)"
export function fmtReservationDateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = KO_WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}월 ${d}일 (${weekday})`;
}

export const RESERVATION_STATUS_LABEL: Record<PassReservation["status"], string> = {
  requested: "예약 대기",
  proposed: "일정 제안 확인 필요",
  confirmed: "예약 확정",
};

// 사용자 예약 상태 라벨 (§15-1) — 재제안 이후의 requested는 "일정 재요청"으로 구분 표기
export function reservationStatusLabel(rsv: PassReservation): string {
  if (rsv.status === "requested" && reviewerCounterUsed(rsv)) return "일정 재요청";
  return RESERVATION_STATUS_LABEL[rsv.status];
}

// 취소 상태 서브 문구 (§15-3) — 상태명은 '취소'로 통일하고 주체·원인은 서브 문구로 구분.
// key: Pass.cancelledVia (undefined = 체험자 직접 취소)
export function cancelledCopy(via: Pass["cancelledVia"], cancelReason?: string): string {
  switch (via) {
    case "proposal_declined":
      return "제안된 시간이 맞지 않아 취소했어요. 재신청 제한은 없어요.";
    case "owner_declined":
      // 2026-07-23 시안 — 원인(시간 조율 실패)을 구체적으로 안내 (무응답 자동 취소도 동일 경위·동일 문구)
      return "예약 가능한 시간이 없어 사장님이 요청을 취소했어요.";
    case "owner_cancelled":
      return cancelReason
        ? `매장 사정으로 확정된 예약이 취소됐어요. (사유: ${cancelReason})`
        : "매장 사정으로 확정된 예약이 취소됐어요.";
    case "admin_cancelled":
      return "운영 정책에 따라 예약이 취소됐어요.";
    default:
      return "예약을 취소했어요. 같은 캠페인은 12시간 후 다시 신청할 수 있어요.";
  }
}

// 체험자 취소 가능 여부 (§13 확정 필요 C 기본안) — 예약 대기 중엔 언제든,
// 확정 후엔 방문 전날 23:59(KST)까지. 방문 당일엔 앱 취소 대신 매장 문의 안내.
export function reviewerCancelBlockedReason(rsv: PassReservation | undefined, now: number = Date.now()): string | null {
  if (!rsv || rsv.status !== "confirmed") return null;
  if (kstTodayStr(now) >= rsv.date) {
    return "방문 당일에는 앱에서 취소할 수 없어요 — 방문이 어려우면 매장에 직접 연락해주세요.";
  }
  return null;
}

// 사장님 응답 리마인드 기준 (§13 확정 필요 B 기본안) — 신청 24시간 무응답 시 사장님 알림,
// 방문 희망 시각 도래까지 무응답이면 자동 취소(매장 사정 — 패널티·재신청 제한 없음).
export const OWNER_RESPONSE_REMIND_MS = 24 * 60 * 60 * 1000;

// 사장님 대안 제안 한도 (2026-07-16 v2) — 슬롯 최대 3개 + 수기 안내사항 최대 200자.
// 선택지가 3개보다 많거나 추가 안내가 필요하면 안내사항에 직접 작성해 체험자에게 노출한다.
export const PROPOSAL_MAX_SLOTS = 3;
export const PROPOSAL_NOTE_MAX = 200;

// 예약 사용 가능 여부 — QR·코드 사용 처리는 예약 확정 후에만 (확정 전 QR 미노출과 동일 기준)
export function reservationUsable(reservation: PassReservation | undefined): boolean {
  return !reservation || reservation.status === "confirmed";
}

// ── 협상 히스토리 (2026-07-16 v3) — 서로 각 1회씩만 제안 가능 ──
// history가 판정의 정본. 구버전 데이터(히스토리 없음)는 현재 희망 일시를 최초 요청으로 간주.

export function reservationHistory(rsv: PassReservation): ReservationEvent[] {
  if (rsv.history && rsv.history.length > 0) return rsv.history;
  return [{ at: rsv.requestedAt, by: "reviewer", kind: "request", date: rsv.date, time: rsv.time }];
}

// 사장님 대안 제안 사용 여부 — 1회 소진 후에는 [예약 확인]/[거절]만 가능
export function ownerProposalUsed(rsv: PassReservation): boolean {
  return reservationHistory(rsv).some((ev) => ev.kind === "propose");
}

// 체험자 재제안(기타 직접 입력) 사용 여부 — 1회 소진 후에는 수락/거절만 가능
export function reviewerCounterUsed(rsv: PassReservation): boolean {
  return reservationHistory(rsv).some((ev) => ev.kind === "counter");
}

// 히스토리 표시용 라인 — prefix(주체·행위)와 timeLabel(일시)을 분리해
// 스토리보드 모드에서 일시만 마스킹(sbNum(SBUI.dateTime, timeLabel))할 수 있게 한다.
export interface ReservationHistoryLine {
  at: number;
  kind: ReservationEvent["kind"]; // 체험자 화면 필터용 (9-2 — propose 선택지는 누적 노출하지 않음)
  prefix: string; // 예: "체험자 희망" · "사장님 제안" · "체험자 재제안" · "사장님 거절"
  timeLabel: string; // "7월 18일 (토) 오후 2시" (+" 외 2개") — 없으면 빈 문자열
  note?: string; // propose 안내사항
}

export function reservationHistoryLines(rsv: PassReservation): ReservationHistoryLine[] {
  return reservationHistory(rsv).map((ev) => {
    const who = ev.by === "owner" ? "사장님" : "체험자";
    const t = ev.date && ev.time ? fmtReservationLabel(ev.date, ev.time) : "";
    switch (ev.kind) {
      case "request":
        return { at: ev.at, kind: ev.kind, prefix: `${who} 희망`, timeLabel: t };
      case "propose": {
        const first = ev.slots?.[0];
        const extra = (ev.slots?.length ?? 0) > 1 ? ` 외 ${ev.slots!.length - 1}개` : "";
        return {
          at: ev.at,
          kind: ev.kind,
          prefix: `${who} 제안`,
          timeLabel: first ? `${fmtReservationLabel(first.date, first.time)}${extra}` : "",
          note: ev.note,
        };
      }
      case "counter":
        return { at: ev.at, kind: ev.kind, prefix: `${who} 재제안`, timeLabel: t };
      case "confirm":
        return { at: ev.at, kind: ev.kind, prefix: `${who} 예약 확인`, timeLabel: t };
      case "accept":
        return { at: ev.at, kind: ev.kind, prefix: `${who} 수락 · 확정`, timeLabel: t };
      case "decline":
        return { at: ev.at, kind: ev.kind, prefix: `${who} 거절 · 신청 취소`, timeLabel: "" };
    }
  });
}

// 체험자 화면 이력 (9-2) — 사장님이 제안한 선택지 전체를 누적 노출하지 않는다.
// 제안 내용은 응답 UI(ReservationRespond)에서 볼 수 있고, 확정 후에는 선택한 일정(accept)만 남는다.
export function reservationHistoryLinesForReviewer(rsv: PassReservation): ReservationHistoryLine[] {
  return reservationHistoryLines(rsv).filter((l) => l.kind !== "propose");
}

// 유효기간 카드 표기 (2026-07-23 시안) — 예약형은 날짜만("0월 00일 (0)" — 방문일 +1일 말이라
// 시각 생략), 그 외 "0월 00일 (0) 오후 0시 00분" 12시간제 (§7-2)
export function fmtExpiryLabel(expiresAt: number, hasReservation: boolean): string {
  const dateStr = kstTodayStr(expiresAt);
  const base = fmtReservationDateLabel(dateStr);
  if (hasReservation) return base;
  const d = new Date(expiresAt + 9 * 60 * 60 * 1000);
  const hhmm = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return `${base} ${fmtTime12(hhmm)}`;
}

// ── 예약 내역 카드 (2026-07-23 시안 — 체험권 상세 하단 "예약 내역" 섹션) ──
// "체험자가 예약 신청했어요" 형태: actor(퍼플 강조) + 문장 + 일정 행(제안은 슬롯 전부).
export interface ReservationHistoryCard {
  actor: "체험자" | "사장님";
  title: string; // actor 뒤에 이어지는 문장 — "가 예약 신청했어요" 등
  rows: Array<{ label: string; value: string }>; // 신청 일정 / 제안 일정 등 (제안 2번째부터 label 공백)
}

export function reservationHistoryCards(rsv: PassReservation): ReservationHistoryCard[] {
  return reservationHistory(rsv).map((ev): ReservationHistoryCard => {
    const actor = ev.by === "owner" ? "사장님" : "체험자";
    const t = ev.date && ev.time ? fmtReservationLabel(ev.date, ev.time) : "";
    switch (ev.kind) {
      case "request":
        return { actor, title: "가 예약 신청했어요", rows: t ? [{ label: "신청 일정", value: t }] : [] };
      case "counter":
        return { actor, title: "가 다른 방문 시간을 요청했어요", rows: t ? [{ label: "요청 일정", value: t }] : [] };
      case "propose":
        return {
          actor,
          title: "이 다른 방문 시간을 제안했어요",
          rows: (ev.slots ?? []).map((sl, i) => ({
            label: i === 0 ? "제안 일정" : "",
            value: fmtReservationLabel(sl.date, sl.time),
          })),
        };
      case "confirm":
        return { actor, title: "이 예약을 확정했어요", rows: t ? [{ label: "확정 일정", value: t }] : [] };
      case "accept":
        return { actor, title: "가 제안된 시간을 수락했어요", rows: t ? [{ label: "확정 일정", value: t }] : [] };
      case "decline":
        return {
          actor,
          title: actor === "사장님" ? "이 예약 요청을 취소했어요" : "가 예약을 취소했어요",
          rows: [],
        };
    }
  });
}
