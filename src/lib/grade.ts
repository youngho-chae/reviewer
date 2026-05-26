import { Grade, SnsAccount } from "./types";

// SNS 영향력 수치 기반 초기 등급 산정 (PRD 6.1.1)
// 합산 가중치: instagram·tiktok·youtube 1 : naver_blog 1.2
export function gradeFromSns(sns: SnsAccount[]): Grade {
  if (sns.length === 0) return "N";
  const sum = sns.reduce((acc, s) => {
    const w = s.kind === "naver_blog" ? 1.2 : 1;
    return acc + s.influence * w;
  }, 0);
  if (sum >= 50000) return "A";
  if (sum >= 10000) return "B";
  if (sum >= 1000) return "C";
  return "N";
}

export const gradeLabel: Record<Grade, string> = {
  S: "S",
  A: "A",
  B: "B",
  C: "C",
  N: "N",
};

export const gradeBg: Record<Grade, string> = {
  S: "bg-gradeS text-white",
  A: "bg-gradeA text-white",
  B: "bg-gradeB text-white",
  C: "bg-gradeC text-white",
  N: "bg-gradeN text-white",
};

export const gradeOrder: Grade[] = ["S", "A", "B", "C", "N"];
export function gradeRank(g: Grade): number {
  return gradeOrder.indexOf(g);
}
// returns true if reviewer grade qualifies for a campaign that requires `min`
export function gradeMeets(reviewer: Grade, min: Grade): boolean {
  // lower rank index = higher grade
  return gradeRank(reviewer) <= gradeRank(min);
}
