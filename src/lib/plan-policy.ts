// 사장님 멤버십 플랜에 따른 등급별 모집 quota 분배 정책.
// 사장님은 총 모집 인원만 결정하고, 플랜별로 우선 등급이 자동 배분됨.
//
// 정책 요약
// - Premium  : S·A·B·C — S 우선 (절반을 S에 배정 후 나머지 A·B·C에 분배)
// - Standard : A·B·C   — A 우선 (절반을 A에 배정 후 나머지 B·C에 분배)
// - Basic    : A·B·C   — 균등 분배 (랜덤 노출)

import { CampaignGradeQuota, Owner } from "./types";

export type PlanKey = Owner["plan"];

export interface PlanGradePolicy {
  plan: PlanKey;
  grades: Array<"S" | "A" | "B" | "C">;
  priorityGrade: "S" | "A" | "B" | "C" | null; // null = 균등(랜덤)
  description: string;
}

export const PLAN_POLICY: Record<PlanKey, PlanGradePolicy> = {
  Premium: {
    plan: "Premium",
    grades: ["S", "A", "B", "C"],
    priorityGrade: "S",
    description: "S~C등급 모집 · S등급 우선 노출",
  },
  Standard: {
    plan: "Standard",
    grades: ["A", "B", "C"],
    priorityGrade: "A",
    description: "A~C등급 모집 · A등급 우선 노출",
  },
  Basic: {
    plan: "Basic",
    grades: ["A", "B", "C"],
    priorityGrade: null,
    description: "A~C등급 모집 · 랜덤 노출",
  },
};

// 총 모집 인원을 정책에 맞춰 등급별 quota로 분배.
// - priorityGrade가 있으면: ceil(total/2)를 우선 등급에, 나머지를 나머지 등급에 균등 + 우선 등급에 잔여를 추가
// - priorityGrade가 null이면: 균등 분배 (남는 1~2명은 첫 등급부터 채움)
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
