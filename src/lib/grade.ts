import { Grade, SnsAccount, SnsKind } from "./types";

// ─── 캐치랭크 지수 평가 모델 v1 ───────────────────────────────
// 채널 영향력(가중치: naver_blog ×1.2, 그 외 ×1)을 등급 밴드로 매핑하는 임계값.
// gradeFromSns(최초 연동 등급)와 indexScoreV1(월간 재평가 지수점수)이 이 상수를
// 공유해 두 산정의 드리프트를 막는다. 실모델 API 도입 시 indexScoreV1만 교체.
export const INDEX_BANDS = [
  { grade: "A" as Grade, lo: 50000, hi: 500000, slo: 70, shi: 89 },
  { grade: "B" as Grade, lo: 10000, hi: 50000, slo: 50, shi: 69 },
  { grade: "C" as Grade, lo: 1000, hi: 10000, slo: 30, shi: 49 },
  { grade: "N" as Grade, lo: 1, hi: 1000, slo: 10, shi: 29 },
] as const;

export function channelWeight(kind: SnsKind): number {
  return kind === "naver_blog" ? 1.2 : 1;
}

// SNS 영향력 수치 기반 초기 등급 산정 (PRD 6.1.1)
// 합산 가중치: instagram·tiktok 1 : naver_blog 1.2
export function gradeFromSns(sns: SnsAccount[]): Grade {
  if (sns.length === 0) return "N";
  const sum = sns.reduce((acc, s) => acc + s.influence * channelWeight(s.kind), 0);
  for (const b of INDEX_BANDS) {
    if (b.grade !== "N" && sum >= b.lo) return b.grade;
  }
  return "N";
}

// 지수점수 I (0~100) — 캐치랭크 지수 평가 모델 v1.
// 가중 영향력을 등급 밴드 내 로그 보간으로 정규화한다.
//   A [50k,500k)→70~89 · B [10k,50k)→50~69 · C [1k,10k)→30~49 · N [1,1k)→10~29
// 90~100은 S 전용 예약 구간 — v1은 산출하지 않는다(S는 운영팀 부여 원칙과 일치).
// 밴드 경계가 등급 컷(A≥70/B≥50/C≥30)과 일치하므로 I 단독 매핑 = 현행 임계값 산정과 동치.
export function indexScoreV1(kind: SnsKind, influence: number): number {
  const x = Math.max(0, influence) * channelWeight(kind);
  if (x < 1) return 10;
  for (const b of INDEX_BANDS) {
    if (x >= b.lo) {
      const clamped = Math.min(x, b.hi);
      const t = Math.log(clamped / b.lo) / Math.log(b.hi / b.lo);
      return Math.round(b.slo + (b.shi - b.slo) * t);
    }
  }
  return 10;
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

// 여러 채널 등급 중 가장 높은 등급 — 마이페이지 등 단일 표기용 대표 값.
// '종합 등급'이라는 별도 평가 기준은 없다(채널별 독립 평가, 2026-07-10 정정). 비어 있으면 N.
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
  connected: boolean; // 채널 연동 여부 — 참여 가능 조건 (등급은 참여 자격이 아님)
  support: number; // 이 채널로 참여 시 받는 지원금 (등급은 혜택 크기만 결정)
}

// 캠페인의 필수 채널 각각에 대해, 내 채널 등급으로 받을 수 있는 혜택을 계산.
// [정책 원칙 P1] 모든 등급은 모든 캠페인에 참여할 수 있다 — 등급은 지원금 배율(혜택)만 결정한다.
export function channelOffers(
  required: SnsKind[],
  channelGrades: Partial<Record<SnsKind, Grade>> | undefined,
  base: number,
): ChannelOffer[] {
  const cg = channelGrades ?? {};
  return required.map((channel) => {
    const connected = !!cg[channel];
    const grade: Grade = cg[channel] ?? "N";
    return { channel, grade, connected, support: supportForGrade(base, grade) };
  });
}

// 내가 받을 수 있는 가장 큰 혜택(연동된 채널 중 최댓값). 연동 채널이 없으면 0.
export function bestEligibleSupport(offers: ChannelOffer[]): number {
  return offers.filter((o) => o.connected).reduce((m, o) => Math.max(m, o.support), 0);
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
// [정책 원칙 P1] "최소 참여 등급" 개념은 존재하지 않는다 — 등급 게이트 함수(gradeMeets)는
// 정책 위반이라 제거됨. 등급은 SUPPORT_MULTIPLIER를 통한 혜택 차등에만 쓰인다.
