// 사장님 멤버십 플랜 정책.
//
// 모든 플랜은 전 등급(S~C, N 포함)을 모집할 수 있으며, 플랜 간 차이는
// **월간 모집 가능 팀 수(monthlyTeamLimit)** 하나뿐이다 — 캠페인 총 모집 인원의 월간 합산 상한.
// "팀 수" = 캠페인 개수가 아니라 실제 체험자를 부를 수 있는 인원 수 (확정 정책 4).
//
// [확정 정책 8-3] 등급 우선 모집/우선 노출(부스팅)은 1차 모델에 도입하지 않는다 —
// 기존 priorityGrade(A/S 우선 배분)는 제거됨. 부스팅은 추후 비즈니스 모델로 별도 검토.
//
// 플랜별 한도: Premium 무제한 · Standard 50팀 · Basic 15팀 · Free 5팀(기본).

import { CampaignGradeQuota, Owner } from "./types";

export type PlanKey = Owner["plan"];

export interface PlanGradePolicy {
  plan: PlanKey;
  grades: Array<"S" | "A" | "B" | "C">;
  monthlyTeamLimit: number | null; // null = 무제한
  description: string;
}

export const PLAN_POLICY: Record<PlanKey, PlanGradePolicy> = {
  Premium: {
    plan: "Premium",
    grades: ["S", "A", "B", "C"],
    monthlyTeamLimit: null,
    description: "월간 무제한 모집",
  },
  Standard: {
    plan: "Standard",
    grades: ["S", "A", "B", "C"],
    monthlyTeamLimit: 50,
    description: "월 50팀까지 모집",
  },
  Basic: {
    plan: "Basic",
    grades: ["S", "A", "B", "C"],
    monthlyTeamLimit: 15,
    description: "월 15팀까지 모집",
  },
  Free: {
    plan: "Free",
    grades: ["S", "A", "B", "C"],
    monthlyTeamLimit: 5,
    description: "월 5팀까지 모집 (멤버십 미가입)",
  },
};

// 총 모집 인원을 등급별 quota로 균등 분배 (남는 인원은 첫 등급부터 채움).
// [P1] quota 버킷은 참여 자격이 아닌 내부 배분·집계 기록이다.
// [확정 정책 8-3] 플랜별 우선 등급 배분(부스팅)은 제거 — 전 플랜 균등.
export function distributeQuota(plan: PlanKey, total: number): CampaignGradeQuota {
  const policy = PLAN_POLICY[plan];
  const q: CampaignGradeQuota = { S: 0, A: 0, B: 0, C: 0 };
  const t = Math.max(0, Math.floor(total));
  if (t === 0) return q;

  const per = Math.floor(t / policy.grades.length);
  let remainder = t - per * policy.grades.length;
  for (const g of policy.grades) {
    q[g] = per + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
  }
  return q;
}

// 이번 달(현재 캘린더 월) 시작 시각.
export function currentMonthStart(now: number = Date.now()): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}
