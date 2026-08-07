import { Grade, SnsAccount, SnsKind } from "./types";

// ─── 캐치랭크 지수 평가 모델 v1 ───────────────────────────────
// 채널 영향력(가중치: naver_blog ×1.2, 그 외 ×1)을 등급 밴드로 매핑하는 임계값.
// gradeFromSns(최초 연동 등급)와 indexScoreV1(월간 재평가 지수점수)이 이 상수를
// 공유해 두 산정의 드리프트를 막는다. 실모델 API 도입 시 indexScoreV1만 교체.
export const INDEX_BANDS = [
  // 6단계 개편 (2026-08-06): S 밴드 신설 — 지수 단독으로도 S 컷(90) 도달 가능(자동 S 평가).
  // N 밴드 폐지 — N은 채널 미연동 전용 상태, 연동 채널은 최저 C (C 밴드 lo=1로 확장).
  { grade: "S" as Grade, lo: 500000, hi: 5000000, slo: 90, shi: 100 },
  { grade: "A" as Grade, lo: 50000, hi: 500000, slo: 70, shi: 89 },
  { grade: "B" as Grade, lo: 10000, hi: 50000, slo: 50, shi: 69 },
  { grade: "C" as Grade, lo: 1, hi: 10000, slo: 30, shi: 49 },
] as const;

export function channelWeight(kind: SnsKind): number {
  return kind === "naver_blog" ? 1.2 : 1;
}

// SNS 영향력 수치 기반 초기 등급 산정 (PRD 6.1.1)
// 합산 가중치: instagram·tiktok 1 : naver_blog 1.2
export function gradeFromSns(sns: SnsAccount[]): Grade {
  if (sns.length === 0) return "N"; // N = 채널 미연동 전용 (2026-08-06)
  const sum = sns.reduce((acc, s) => acc + s.influence * channelWeight(s.kind), 0);
  for (const b of INDEX_BANDS) {
    if (sum >= b.lo) return b.grade;
  }
  return "C"; // 연동했으면 최하라도 C (영향력 0 포함)
}

// 지수점수 I (30~100) — 캐치랭크 지수 평가 모델 v1 (2026-08-06 6단계 개편).
//   S [500k,5M)→90~100 · A [50k,500k)→70~89 · B [10k,50k)→50~69 · C [1,10k)→30~49
// 연동 채널의 바닥 점수 = 30(C 컷) — N은 미연동 전용 상태라 지수 밴드가 없다.
// 밴드 경계가 등급 컷(S≥90/A≥70/B≥50/C 바닥)과 일치하므로 I 단독 매핑 = 임계값 산정과 동치.
export function indexScoreV1(kind: SnsKind, influence: number): number {
  const x = Math.max(0, influence) * channelWeight(kind);
  if (x < 1) return 30; // 연동 채널 바닥 = C
  for (const b of INDEX_BANDS) {
    if (x >= b.lo) {
      const clamped = Math.min(x, b.hi);
      const t = Math.log(clamped / b.lo) / Math.log(b.hi / b.lo);
      return Math.round(b.slo + (b.shi - b.slo) * t);
    }
  }
  return 30;
}

// 채널별 등급 — 각 채널의 영향력을 독립적으로 평가 (v2.16).
export function gradeForChannel(kind: SnsKind, influence: number): Grade {
  return gradeFromSns([{ kind, url: "x", influence }]);
}

// 연동된 SNS 배열 → 채널별 등급 맵.
// sns[]에 있다 = 연동된 채널이다 — URL 유무로 걸러내지 않는다 (2026-07-10 정정:
// OAuth/데모 검증 연동은 URL이 비어 있을 수 있는데, 기존 url 필터가 이런 채널을
// 등급 산정에서 제외해 '연동됨으로 보이지만 참여 불가'가 되던 버그. 가입 폼의
// 미기입 채널은 signup 라우트가 이미 url 있는 항목만 걸러 전달하므로 영향 없음.)
export function channelGradesFromSns(sns: SnsAccount[]): Partial<Record<SnsKind, Grade>> {
  const out: Partial<Record<SnsKind, Grade>> = {};
  for (const s of sns) {
    // apiGrade = 자체 등급평가 API 산정 등급 (네이버 블로그 소개글 인증, 2026-07-25) —
    // 있으면 영향력 공식 대신 사용. 월간 재평가(§10)는 기존 로직대로 이후 등급을 관리한다.
    out[s.kind] = s.apiGrade ?? gradeForChannel(s.kind, s.influence);
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
//   S+ 100% · S 100% · A 80% · B 60% · C 40% · N 10%
// S+ 배율은 S와 동일 — 기준 지원금(=S 100%)이 절대 상한(P2 매장 직접 할인·boostedLimit 전제)이라
// 100% 초과 배율은 구조적으로 불가. S+ 추가 혜택은 배율 외(포인트 보너스·배지·프로모션 우선 — §10.6).
// N 배율(0.1)은 "기준 지원금의 10% 정액"이 아니라 구 패스 스냅샷 호환용 — 영수증 리뷰(N) 참여의
// 실제 혜택은 **결제 금액의 10% 할인**(receiptSupportFor, 2026-08-07 정정)이며 표기도 "10% 할인"뿐.
export const SUPPORT_MULTIPLIER: Record<Grade, number> = {
  "S+": 1,
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

// 영수증 리뷰(N) 할인 — 정액이 아니라 "직접 결제한 금액의 10% 할인" (2026-08-07 정정).
// 표기는 금액이 아닌 "10% 할인"으로 통일하고, 실제 할인액은 사용 처리 시점에 결제액으로 산정.
// 상한 = 기준 지원금(P2 — 기준 지원금은 어떤 경우에도 절대 상한). 100원 단위 반올림.
export const RECEIPT_DISCOUNT_RATE = 0.1;
export const RECEIPT_DISCOUNT_LABEL = "10% 할인";
export function receiptSupportFor(paid: number, base: number): number {
  const raw = Math.max(0, paid) * RECEIPT_DISCOUNT_RATE;
  return Math.min(Math.round(raw / 100) * 100, Math.max(0, base || 0));
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

// 등급 서열 정본 (2026-08-06 6단계) — S+가 최상위. 채널 등급의 상한은 S이며
// S+는 계정(표기) 등급 레이어에서만 부여된다 (grade-regrade sweep의 S+ 판정).
export const gradeOrder: Grade[] = ["S+", "S", "A", "B", "C", "N"];
export function gradeRank(g: Grade): number {
  return gradeOrder.indexOf(g);
}
// [정책 원칙 P1] "최소 참여 등급" 개념은 존재하지 않는다 — 등급 게이트 함수(gradeMeets)는
// 정책 위반이라 제거됨. 등급은 SUPPORT_MULTIPLIER를 통한 혜택 차등에만 쓰인다.
