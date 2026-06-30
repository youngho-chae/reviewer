import { Grade, SnsAccount, SnsKind } from "./types";

// SNS 영향력 수치 기반 초기 등급 산정 (PRD 6.1.1)
// 합산 가중치: instagram·tiktok 1 : naver_blog 1.2
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

// 채널별 등급 — 각 채널의 영향력을 독립적으로 평가 (v2.16).
export function gradeForChannel(kind: SnsKind, influence: number): Grade {
  return gradeFromSns([{ kind, url: "x", influence }]);
}

// 연동된 SNS 배열 → 채널별 등급 맵.
export function channelGradesFromSns(sns: SnsAccount[]): Partial<Record<SnsKind, Grade>> {
  const out: Partial<Record<SnsKind, Grade>> = {};
  for (const s of sns) {
    if (!s.url) continue;
    out[s.kind] = gradeForChannel(s.kind, s.influence);
  }
  return out;
}

// 여러 등급 중 가장 높은(종합) 등급. 비어 있으면 N.
export function bestGrade(grades: Array<Grade | undefined>): Grade {
  let best: Grade = "N";
  for (const g of grades) {
    if (g && gradeRank(g) < gradeRank(best)) best = g;
  }
  return best;
}

// 등급별 지원금 배율 (등급 탭 혜택 사다리와 일치).
//   S 100% · A 80% · B 60% · C 40% · N 10%
export const SUPPORT_MULTIPLIER: Record<Grade, number> = {
  S: 1,
  A: 0.8,
  B: 0.6,
  C: 0.4,
  N: 0.1,
};

// 기준 지원금(=캠페인 supportAmount, S 등급 기준 최대치)에서
// 해당 등급이 실제로 받는 지원금. 100원 단위 반올림.
export function supportForGrade(base: number, g: Grade): number {
  const raw = (base || 0) * SUPPORT_MULTIPLIER[g];
  return Math.round(raw / 100) * 100;
}

export interface ChannelOffer {
  channel: SnsKind;
  grade: Grade; // 해당 채널에서의 내 등급 (미연동 시 N)
  connected: boolean; // 채널 연동 여부
  eligible: boolean; // 캠페인 최소 등급 충족 여부
  support: number; // 이 채널로 참여 시 받는 지원금
}

// 캠페인의 필수 채널 각각에 대해, 내 채널 등급으로 받을 수 있는 혜택을 계산.
export function channelOffers(
  required: SnsKind[],
  channelGrades: Partial<Record<SnsKind, Grade>> | undefined,
  minGrade: Grade,
  base: number,
): ChannelOffer[] {
  const cg = channelGrades ?? {};
  return required.map((channel) => {
    const connected = !!cg[channel];
    const grade: Grade = cg[channel] ?? "N";
    const eligible = connected && gradeMeets(grade, minGrade);
    return { channel, grade, connected, eligible, support: supportForGrade(base, grade) };
  });
}

// 내가 받을 수 있는 가장 큰 혜택(eligible 채널 중 최댓값). 없으면 0.
export function bestEligibleSupport(offers: ChannelOffer[]): number {
  return offers.filter((o) => o.eligible).reduce((m, o) => Math.max(m, o.support), 0);
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
