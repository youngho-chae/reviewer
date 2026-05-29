// 사장님 멤버십 플랜 정책.
//
// 모든 플랜은 S~C 등급을 모집할 수 있으며, 플랜에 따라 차이가 나는 것은
//   1) 우선 모집 등급 (priorityGrade)
//   2) 월간 모집 가능 팀 수 (monthlyTeamLimit) — 캠페인 총 모집 인원의 월간 합산 상한
//
// 플랜별 정책:
// - Premium  : S 우선 노출 · 월간 무제한
// - Standard : A 우선 노출 · 월간 50팀
// - Basic    : 랜덤 노출    · 월간 15팀
// - Free     : 랜덤 노출    · 월간 5팀 (멤버십 미가입 기본 상태)

import { CampaignGradeQuota, Owner } from "./types";

export type PlanKey = Owner["plan"];

export interface PlanGradePolicy {
  plan: PlanKey;
  grades: Array<"S" | "A" | "B" | "C">;
  priorityGrade: "S" | "A" | "B" | "C" | null; // null = 균등(랜덤)
  monthlyTeamLimit: number | null; // null = 무제한
  description: string;
}

export const PLAN_POLICY: Record<PlanKey, PlanGradePolicy> = {
  Premium: {
    plan: "Premium",
    grades: ["S", "A", "B", "C"],
    priorityGrade: "S",
    monthlyTeamLimit: null,
    description: "S등급 우선 노출 · 월간 무제한 모집",
  },
  Standard: {
    plan: "Standard",
    grades: ["S", "A", "B", "C"],
    priorityGrade: "A",
    monthlyTeamLimit: 50,
    description: "A등급 우선 노출 · 월 50팀까지 모집",
  },
  Basic: {
    plan: "Basic",
    grades: ["S", "A", "B", "C"],
    priorityGrade: null,
    monthlyTeamLimit: 15,
    description: "랜덤 노출 · 월 15팀까지 모집",
  },
  Free: {
    plan: "Free",
    grades: ["S", "A", "B", "C"],
    priorityGrade: null,
    monthlyTeamLimit: 5,
    description: "랜덤 노출 · 월 5팀까지 모집 (멤버십 미가입)",
  },
};

// 총 모집 인원을 정책에 맞춰 등급별 quota로 분배.
// - priorityGrade가 있으면: ceil(total/2)를 우선 등급에, 나머지를 나머지 등급에 균등 분배
// - priorityGrade가 null이면: 균등 분배 (남는 인원은 첫 등급부터 채움)
export function distributeQuota(plan: PlanKey, total: number): CampaignGradeQuota {
  const policy = PLAN_POLICY[plan];
  const q: CampaignGradeQuota = { S: 0, A: 0, B: 0, C: 0 };
  const t = Math.max(0, Math.floor(total));
  if (t === 0) return q;

  if (policy.priorityGrade) {
    const priShare = Math.ceil(t / 2);
    const rest = t - priShare;
    q[policy.priorityGrade] = priShare;
    const others = policy.grades.filter((g) => g !== policy.priorityGrade);
    const per = Math.floor(rest / others.length);
    let remainder = rest - per * others.length;
    for (const g of others) {
      q[g] = per + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
    }
  } else {
    const per = Math.floor(t / policy.grades.length);
    let remainder = t - per * policy.grades.length;
    for (const g of policy.grades) {
      q[g] = per + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
    }
  }
  return q;
}

// 이번 달(현재 캘린더 월) 시작 시각.
export function currentMonthStart(now: number = Date.now()): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}
