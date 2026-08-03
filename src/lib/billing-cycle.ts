// 결제 주기 정본 (2026-08-03 확정) — 모집 한도의 유효 기간.
//
// 한도는 캘린더 월("이번 달")이 아니라 **결제 주기** 단위로 부여·소진된다:
//  - 멤버십(유료) 회원: **결제(플랜 시작/변경) 시점**에 한도가 부여되고 다음 재결제 전까지 유지
//    — anchor = Owner.planStartedAt (플랜 변경 시 갱신, 구버전 미기록은 가입일 폴백)
//  - Free 회원: **가입 시점** 기준 익월 동일한 날 −1일까지 — anchor = Owner.createdAt
//    예) 07.25 가입 → 07.25 ~ 08.24 유효, 08.25 재갱신
//  - anchor 일자가 그 달에 없으면(31일 → 2월 등) 말일로 클램프
//
// 캠페인 생성 검증(quota 합산)·owner/me·사장님 홈 '모집 현황'이 모두 이 주기를 공유하고,
// 리필권 가산분도 "사용한 주기까지만" 유효 판정에 이 윈도우를 쓴다.
// 화면 표기: 홈 카드 타이틀 "모집 현황" + 우측 기간 라벨(cycleLabel — "07.25 ~ 08.24").

import type { Owner } from "./types";

const KST = 9 * 3600000;

// epoch → KST 달력 성분 읽기용 (UTC getter = KST 값)
const kst = (t: number) => new Date(t + KST);

// 해당 (년,월)의 anchor일 자정(KST) epoch — 월 길이에 맞춰 일자 클램프
function anniversaryAt(year: number, monthIdx: number, day: number): number {
  const lastDay = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
  return Date.UTC(year, monthIdx, Math.min(day, lastDay)) - KST;
}

// 주기 anchor 시각 — 유료 = 최근 결제(플랜 시작), Free/구버전 = 가입일
export function cycleAnchorAt(owner: Pick<Owner, "planStartedAt" | "createdAt">): number {
  return owner.planStartedAt ?? owner.createdAt;
}

export interface BillingCycle {
  start: number; // 최근 갱신일 자정(KST)
  end: number; // 다음 갱신일 자정(KST) − 1ms
}

export function billingCycle(owner: Pick<Owner, "planStartedAt" | "createdAt">, now: number = Date.now()): BillingCycle {
  const anchorDay = kst(cycleAnchorAt(owner)).getUTCDate();
  const n = kst(now);
  let y = n.getUTCFullYear();
  let m = n.getUTCMonth();
  let start = anniversaryAt(y, m, anchorDay);
  if (start > now) {
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    start = anniversaryAt(y, m, anchorDay);
  }
  let ny = y;
  let nm = m + 1;
  if (nm > 11) {
    nm = 0;
    ny += 1;
  }
  return { start, end: anniversaryAt(ny, nm, anchorDay) - 1 };
}

// "07.25 ~ 08.24" — 홈 모집 현황 우측 기간 표기
export function cycleLabel(c: BillingCycle): string {
  const f = (t: number) => {
    const d = kst(t);
    return `${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}`;
  };
  return `${f(c.start)} ~ ${f(c.end)}`;
}
