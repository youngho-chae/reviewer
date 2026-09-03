// 등급 월간 재평가 스윕 — DB 로드 시마다 실행되는 지연(lazy) 배치 (2026-07-08 설계).
// 별도 크론 없이 매월 말(KST)이 지나면 직전 월 활동을 평가해 채널별 등급을 갱신한다.
//
//   GS_ch = 0.70·I_ch(지수점수) + 0.20·F(성실 이행) + 0.10·W(상생지수) − P(패널티)
//
//   I: 캐치랭크 지수 평가 모델 v1 (grade.ts indexScoreV1 — 채널 영향력 밴드 정규화)
//   F (2026-08-05 D1): 완료율 60% + 기한 준수 40%
//      완료율 = completed / (completed + 노쇼만료 + 리뷰기한초과 + 반려종착 + 반려방치)
//      기한 준수 = 완료 건별 (마감까지 남긴 시간 / 전체 기한)의 0~1 평균 — 즉시 제출 ≈1, 마감 직전 ≈0.
//      기한 표본이 없으면(완료 0건 등) F = 완료율 단독. "반려 방치" = 1차 반려 후 재제출 기한(7일)
//      경과까지 미재제출 — 분모에만 포함(무감점), 방치 사각 봉합.
//   W (2026-08-05 D2·D3): 상생지수 — 완료·결제기록 건별 초과 결제율 r=(paid−support)/support의
//      min(r,1) 평균 × 표본 신뢰 가중 min(1, 표본/3) ×100. 적용 지원금 1,000원 미만 건은 표본 제외
//      (1원 결제 만점 어뷰징 차단). 표본 0건(배송형 전용 등)이면 **상생 중립** —
//      GS = (0.70·I + 0.20·F) / 0.90 − P 재정규화(W=0 구조 손실 방지).
//      절대 금액은 어디에도 쓰지 않는다(비율·건별 캡 1.0·완료 전제·가중 10% — 등급 구매 모순 차단).
//   P (2026-08-05 D4): 노쇼 만료 −10/건 · 리뷰 기한 초과 −7/건 · 반려 종착(1회 재제출 후 추가 반려)
//      −5/건. 직전 월에도 P>0이면 ×1.5 (누적 가중) **후** 월 상한 −30 적용 — 어떤 달도 −30 초과 불가.
//      취소는 무패널티(12h 쿨다운이 담당). 반려 방치는 F 분모에만 반영(감점 없음 — D5).
//   리뷰 품질은 주관 평가 배제 원칙으로 점수 요소에서 제외 — 반려 종착만 P로 반영.
//
// 안정 장치 (2026-08-06 6단계 개편): 등급 컷 S90/A70/B50/C(연동 바닥) — N은 미연동 전용 ·
// S까지 자동 평가(구 "S 수동 부여" 폐기) · S+ = 계정 표기 등급 레이어(채널 최고 S + F 만점 +
// W 만점(중립 불가) + P 0 — 매월 재판정, 미충족 시 S로) · 월 변동 ±1등급 ·
// 표본 부족(당월 이벤트 <2건)이면 F/W 중립(GS = I − P, 밴드가 컷과 일치해 지수 단독 산정과 동치) ·
// 이벤트 0건이면 스킵(등급 유지). 소급 없음 — 직전 1개월만 평가.
//
// [P1] 재평가·패널티·뱃지는 등급(=지원금 배율, 혜택 크기)에만 영향을 준다.
// 참여 가드(/api/passes)·노출(campaign-visibility)에는 어떤 조건도 추가하지 않는다.

import { DBShape, Grade, GradeHistoryEntry, Reviewer, SnsKind } from "./types";
import { indexScoreV1, bestGrade, gradeRank, gradeOrder } from "./grade";
import { REVIEW_DEADLINE_MS, reviewDeadline } from "./pass-lifecycle";
import { rid } from "./ids";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 가중치·컷·패널티 상수 (운영정책서 §등급 월간 재평가와 원문 일치)
export const REGRADE_WEIGHTS = { I: 0.7, F: 0.2, W: 0.1 } as const;
// 6단계 개편 (2026-08-06): N 컷 폐지 — N은 채널 미연동 전용 상태. 연동 채널의 바닥 = C.
// S+는 점수 컷이 아니라 조건 판정(sweep의 isSPlusQualified — 채널 S + F/W 만점 + P 0).
export const GRADE_CUTS: Array<{ grade: Grade; min: number }> = [
  { grade: "S", min: 90 },
  { grade: "A", min: 70 },
  { grade: "B", min: 50 },
  { grade: "C", min: 0 },
];
export const PENALTY = { noShow: 10, overdue: 7, rejectedFinal: 5, monthlyCap: 30, repeatFactor: 1.5 } as const;
// 성실 이행 F 구성 (2026-08-05 D1) — 완료율 60% + 리뷰 제출 기한 준수 40%
export const F_WEIGHTS = { completion: 0.6, punctuality: 0.4 } as const;
// 상생 W 방어·가중 (2026-08-05 D2) — 적용 지원금이 이 값 미만인 건은 표본 제외(1원 결제 만점 차단),
// 표본 n건이면 평균에 min(1, n/W_FULL_SAMPLE) 신뢰 가중(1건 만점 방지 — 뱃지 완료 3건 기준과 일치)
export const W_MIN_SUPPORT = 1000;
export const W_FULL_SAMPLE = 3;
// 상생 리뷰어 뱃지 기준 — W ≥ 60 & 당월 완료 3건 이상. 유예 1개월(2개월 연속 미달 시 회수).
export const WINWIN_BADGE = { minW: 60, minCompleted: 3 } as const;
// 표본 부족 기준 — 당월 이벤트(완료+패널티 사건)가 이 값 미만이면 F/W 중립
const MIN_SAMPLE = 2;

// ── KST 월 유틸 ──────────────────────────────────────────────
export function kstMonthKey(ts: number): string {
  return new Date(ts + KST_OFFSET_MS).toISOString().slice(0, 7); // "YYYY-MM"
}

function monthParts(month: string): { y: number; m: number } {
  const [y, m] = month.split("-").map(Number);
  return { y, m };
}

// 해당 KST 월 시작 epoch (00:00:00 KST)
export function kstMonthStart(month: string): number {
  const { y, m } = monthParts(month);
  return Date.UTC(y, m - 1, 1) - KST_OFFSET_MS;
}

// 해당 KST 월 말일 23:59:59.999 — /r/grade "다음 재평가일" 표시에도 사용
export function kstMonthEnd(month: string): number {
  const { y, m } = monthParts(month);
  return Date.UTC(y, m, 1) - KST_OFFSET_MS - 1;
}

export function prevMonthKey(month: string): string {
  const { y, m } = monthParts(month);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

// ── 월간 활동 집계 (passes 타임스탬프 파생 — 별도 이벤트 로그 없음) ──
// 월 귀속 기준: 완료=검수 승인(completedAt) · 노쇼=expiresAt · 기한 초과=reviewDeadline(예약형은
// 확정 방문일 기준 — 판정 기준과 동일, 2026-08-05 D7 통일) · 반려 종착=rejectedAt ·
// 반려 방치=rejectedAt+7d(재제출 기한 만료일).
export interface MonthlyActivity {
  completed: number;
  noShow: number;
  overdue: number;
  rejectedFinal: number; // 1회 재제출 후 추가 반려 (품질 문제의 유일한 반영 경로)
  rejectedAbandoned: number; // 1차 반려 후 재제출 기한(7일) 경과까지 미재제출 — F 분모만 (D5)
  wRatios: number[]; // 완료 건별 min(초과 결제율, 1.0) — 적용 지원금 W_MIN_SUPPORT 미만 건 제외
  leadScores: number[]; // 완료 건별 기한 준수 0~1 (마감까지 남긴 시간 / 전체 기한 — D1)
}

export function collectMonthlyActivity(db: DBShape, reviewerId: string, month: string): MonthlyActivity {
  const act: MonthlyActivity = {
    completed: 0,
    noShow: 0,
    overdue: 0,
    rejectedFinal: 0,
    rejectedAbandoned: 0,
    wRatios: [],
    leadScores: [],
  };
  for (const p of db.passes) {
    if (p.reviewerId !== reviewerId) continue;

    if (p.status === "completed") {
      const at = p.completedAt ?? p.reviewSubmittedAt ?? p.usedAt; // 구버전 폴백
      if (at && kstMonthKey(at) === month) {
        act.completed += 1;
        // 상생 집계는 결제 기록이 있는 방문형 건만 — 배송형 등 결제 개념이 없는 완료 건은
        // W 표본에 넣지 않는다 (0으로 끌어내리면 비율 원칙 훼손). F(성실 이행)에는 포함.
        // 적용 지원금 1,000원 미만(지원금 0원 캠페인 등)은 제외 — 소액 결제 만점 어뷰징 차단 (D2)
        // 영수증 리뷰(2026-08-07)도 제외 — 할인액이 결제액의 10%로 파생되어 초과 결제율
        // r=(paid−support)/support가 항상 9(캡 1.0 만점)로 왜곡된다. F에는 포함.
        // use-by-code 미입력 폴백(paid=support) 건은 over=0 표본으로 포함 — 리포트 §12 상생
        // 매출과 동일한 하한 취급(초과분 0으로 과대 반영 불가, 2026-09-02 명문화).
        if (!p.receiptReview && p.paidAmount != null && p.supportApplied != null && p.supportApplied >= W_MIN_SUPPORT) {
          const over = Math.max(0, p.paidAmount - p.supportApplied) / p.supportApplied;
          act.wRatios.push(Math.min(over, 1));
        }
        // 기한 준수 (D1) — 마감까지 남긴 시간 비율. 제출 시각은 최종 제출(재제출 포함) 기준,
        // 구버전(제출 시각 없음)은 귀속 시각 폴백. 기한 산출 불가 건은 표본 제외.
        const deadline = reviewDeadline(p);
        if (deadline != null && p.usedAt && deadline > p.usedAt) {
          const submitted = p.reviewSubmittedAt ?? at;
          act.leadScores.push(Math.max(0, Math.min(1, (deadline - submitted) / (deadline - p.usedAt))));
        }
      }
    }
    if (p.status === "expired" && kstMonthKey(p.expiresAt) === month) {
      act.noShow += 1;
    }
    // 기한 초과 — 귀속 월도 판정 기준(reviewDeadline)과 동일 (구: usedAt+7d — 예약형에서
    // 판정 월과 귀속 월이 어긋나던 문제 정정, D7)
    if (p.overdueHandled && p.usedAt) {
      const deadline = reviewDeadline(p);
      if (deadline != null && kstMonthKey(deadline) === month) act.overdue += 1;
    }
    if (p.status === "rejected" && p.rejectedAt) {
      if ((p.resubmitCount ?? 0) >= 1 && kstMonthKey(p.rejectedAt) === month) {
        act.rejectedFinal += 1;
      }
      // 반려 방치 (D5) — 1차 반려 후 재제출 기한(반려 후 7일 — /api/passes/review와 동일 창)
      // 경과까지 미재제출. 기한 내 재제출하면 status가 바뀌어 여기 잡히지 않는다 (중복 없음).
      if ((p.resubmitCount ?? 0) === 0 && kstMonthKey(p.rejectedAt + REVIEW_DEADLINE_MS) === month) {
        act.rejectedAbandoned += 1;
      }
    }
  }
  return act;
}

// ── 점수 계산 ────────────────────────────────────────────────
export interface ScoreBreakdown {
  I: number;
  F: number;
  W: number;
  P: number;
  GS: number;
  neutralized: boolean;
  wNeutral: boolean; // 당월 결제 표본 0건 — W 제외·재정규화 (D3)
}

// 당월 이벤트 총합 — F 분모이자 표본 부족(중립)·스킵 판정의 정본 (반려 방치 포함, D5)
export function activityEvents(act: MonthlyActivity): number {
  return act.completed + act.noShow + act.overdue + act.rejectedFinal + act.rejectedAbandoned;
}

export function computeChannelScore(
  indexScore: number,
  act: MonthlyActivity,
  prevMonthHadPenalty: boolean,
): ScoreBreakdown {
  const events = activityEvents(act);
  // 패널티 (D4) — 누적 가중(×1.5)을 먼저 적용한 뒤 월 상한 −30: 어떤 달도 −30을 넘지 않는다
  const rawP = act.noShow * PENALTY.noShow + act.overdue * PENALTY.overdue + act.rejectedFinal * PENALTY.rejectedFinal;
  const P = Math.min(
    PENALTY.monthlyCap,
    Math.round(rawP * (prevMonthHadPenalty && rawP > 0 ? PENALTY.repeatFactor : 1)),
  );

  if (events < MIN_SAMPLE) {
    // 표본 부족 — F/W 중립: 지수 단독 유지 (패널티는 항상 반영)
    const GS = Math.max(0, Math.min(100, Math.round(indexScore - P)));
    return { I: indexScore, F: 0, W: 0, P, GS, neutralized: true, wNeutral: false };
  }

  // F (D1) — 완료율 60% + 기한 준수 40%. 기한 표본이 없으면(완료 0건 등) 완료율 단독.
  const completion = act.completed / events;
  const punctuality = act.leadScores.length
    ? act.leadScores.reduce((a, b) => a + b, 0) / act.leadScores.length
    : null;
  const F = Math.round(
    (punctuality == null ? completion : F_WEIGHTS.completion * completion + F_WEIGHTS.punctuality * punctuality) * 100,
  );

  // W (D2·D3) — 평균 × 표본 신뢰 가중 min(1, n/3). 표본 0건이면 상생 중립(재정규화).
  const wCount = act.wRatios.length;
  const wNeutral = wCount === 0;
  const W = wNeutral
    ? 0
    : Math.round(
        (act.wRatios.reduce((a, b) => a + b, 0) / wCount) * Math.min(1, wCount / W_FULL_SAMPLE) * 100,
      );

  const base = wNeutral
    ? (REGRADE_WEIGHTS.I * indexScore + REGRADE_WEIGHTS.F * F) / (REGRADE_WEIGHTS.I + REGRADE_WEIGHTS.F)
    : REGRADE_WEIGHTS.I * indexScore + REGRADE_WEIGHTS.F * F + REGRADE_WEIGHTS.W * W;
  const GS = Math.max(0, Math.min(100, Math.round(base - P)));
  return { I: indexScore, F, W, P, GS, neutralized: false, wNeutral };
}

// GS → 채널 등급 (2026-08-06 6단계 — S까지 자동 평가, 구 "S 수동 부여" 캡 폐기).
// 채널 등급 상한 = S — S+는 계정 표기 레이어에서 sweep이 별도 판정한다.
// 바닥 = C (연동 채널 — N은 미연동 전용). 현재 등급 대비 ±1 클램프 유지.
export function gradeFromScore(gs: number, current: Grade): Grade {
  let raw: Grade = "C";
  for (const c of GRADE_CUTS) {
    if (gs >= c.min) {
      raw = c.grade;
      break;
    }
  }
  // ±1등급 클램프 (gradeOrder 랭크: S+=0 · S=1 … N=5, 숫자가 작을수록 상위).
  // current가 구버전 N이거나 방어적 S+여도 채널 등급 범위(S~C)로 정규화해 계산한다.
  const cur = Math.min(Math.max(gradeRank(current), gradeRank("S")), gradeRank("C"));
  const rank = Math.max(cur - 1, Math.min(cur + 1, gradeRank(raw)));
  return gradeOrder[rank];
}

// ── 월말 재평가 스윕 ─────────────────────────────────────────
export function sweepMonthlyRegrade(db: DBShape, now: number = Date.now()): boolean {
  const target = prevMonthKey(kstMonthKey(now)); // 평가 대상 = 직전 KST 월
  if (db.lastRegradeMonth && db.lastRegradeMonth >= target) return false;

  for (const rv of db.reviewers) {
    // 평가월 중(이후) 가입자는 스킵 — 한 달을 온전히 지나지 않은 활동은 평가하지 않는다
    if (kstMonthKey(rv.createdAt) >= target) continue;
    // 멱등 2차 방어 — 같은 평가월 이력이 이미 있으면 스킵 (멀티 인스턴스 레이스 대비)
    if (rv.gradeHistory?.some((h) => h.month === target)) continue;

    const act = collectMonthlyActivity(db, rv.id, target);
    const events = activityEvents(act);
    const history: GradeHistoryEntry[] = rv.gradeHistory ?? [];

    if (events === 0) {
      // 활동 없음 — 등급 유지, 이력만 기록. 단 S+는 "당월 활동 만점"이 유지 조건이라
      // 무활동 월에도 S로 내려간다(중립·스킵 월 = S+ 불가 — 채널 등급은 그대로, 표기 레이어만).
      const to: Grade = rv.grade === "S+" ? "S" : rv.grade;
      history.push({
        month: target,
        from: rv.grade,
        to,
        breakdown: { I: 0, F: 0, W: 0, P: 0, GS: 0 },
        skipped: true,
        at: now,
      });
      rv.grade = to;
      rv.gradeHistory = history;
      rv.lastRegradeAt = now;
      updateWinWinBadge(db, rv, target, false, now);
      continue;
    }

    const prevHadPenalty =
      history.some((h) => h.month === prevMonthKey(target) && !h.skipped && h.breakdown.P > 0);
    const oldGrade = rv.grade;
    const cg = { ...(rv.channelGrades ?? {}) };
    let summary: ScoreBreakdown | null = null;

    // URL 유무로 걸러내지 않는다 (2026-08-05 D7 정정 — OAuth 연동 채널은 url이 없을 수 있음,
    // grade.ts channelGradesFromSns와 동일 원칙. 지수는 influence 기준으로 동일하게 산정)
    for (const s of rv.sns) {
      const kind: SnsKind = s.kind;
      const bd = computeChannelScore(indexScoreV1(kind, s.influence), act, prevHadPenalty);
      // 신규(이력 없는) 연동 채널 폴백 = C — 연동 채널의 바닥 등급 (2026-08-06, 구 "N" 폴백 폐기)
      const current = cg[kind] ?? "C";
      const next = gradeFromScore(bd.GS, current);
      cg[kind] = next;
      history.push({
        month: target,
        channel: kind,
        from: current,
        to: next,
        breakdown: { I: bd.I, F: bd.F, W: bd.W, P: bd.P, GS: bd.GS },
        neutralized: bd.neutralized || undefined,
        wNeutral: bd.wNeutral || undefined,
        at: now,
      });
      // 표기 등급 요약(연동 채널 중 최고)에는 최고 GS 채널의 분해를 사용
      if (!summary || bd.GS > summary.GS) summary = bd;
    }

    rv.channelGrades = cg;
    // S+ 판정 (2026-08-06 6단계) — 채널 최고 등급 S + 성실 이행 만점 + 상생 만점(중립 월 불가) +
    // 패널티 0. 매월 재판정 — 미충족 시 S로 내려간다(계정 표기 등급 레이어, 채널 등급 상한은 S).
    // 전월 표기 등급도 S 이상이어야 한다 — 당월 A→S 승급과 동시에 S+가 되는 2단 점프 방지(±1 정합):
    // "S 등급인 상태로 만점 한 달"이 조건이므로, 갓 S가 된 달의 만점은 다음 달 S+로 이어진다.
    const best = bestGrade(Object.values(cg));
    const isSPlus =
      best === "S" &&
      (oldGrade === "S" || oldGrade === "S+") &&
      !!summary &&
      !summary.neutralized &&
      !summary.wNeutral &&
      summary.F === 100 &&
      summary.W === 100 &&
      summary.P === 0;
    rv.grade = isSPlus ? "S+" : best;

    // 상생 리뷰어 뱃지 판정 (플랫폼 공통 — W·완료 건수 기준)
    const winWinQualified =
      !!summary && !summary.neutralized && summary.W >= WINWIN_BADGE.minW && act.completed >= WINWIN_BADGE.minCompleted;
    updateWinWinBadge(db, rv, target, winWinQualified, now);

    // 표기 등급 요약 이력 (channel 미지정 = /r/grade 변동 이력 UI가 읽는 행 — 연동 채널 중 최고 등급 기준)
    history.push({
      month: target,
      from: oldGrade,
      to: rv.grade,
      breakdown: summary
        ? { I: summary.I, F: summary.F, W: summary.W, P: summary.P, GS: summary.GS }
        : { I: 0, F: 0, W: 0, P: 0, GS: 0 },
      neutralized: summary?.neutralized || undefined,
      wNeutral: summary?.wNeutral || undefined,
      winWinQualified: winWinQualified || undefined,
      at: now,
    });
    rv.gradeHistory = history;
    rv.lastRegradeAt = now;

    if (rv.grade !== oldGrade) {
      const up = gradeRank(rv.grade) < gradeRank(oldGrade);
      db.notifications.push({
        id: rid("nt"),
        userId: rv.id,
        role: "reviewer",
        title: rv.grade === "S+" ? "S+ 등급을 달성했어요 👑" : up ? "등급이 올랐어요 🎉" : "등급이 조정되었어요",
        body:
          rv.grade === "S+"
            ? "한 달 동안 성실 이행·상생 만점에 감점 없이 S 등급을 유지한 체험자에게 드리는 최고 등급이에요. 포인트 적립 보너스와 프로모션 최우선 혜택이 적용됩니다."
            : up
              ? `월간 재평가 결과 ${oldGrade}등급 → ${rv.grade}등급으로 상승했습니다. 지원금 혜택이 커졌어요.`
              : `월간 재평가 결과 ${oldGrade}등급 → ${rv.grade}등급으로 조정되었습니다. 다음 달 성실한 체험으로 다시 올릴 수 있어요.`,
        createdAt: now,
        read: false,
        link: "/r/grade",
      });
    }
  }

  db.lastRegradeMonth = target;
  return true;
}

// 뱃지 부여/유지/회수 — 유예 1개월: 직전 평가월에 충족했으면 미달 1회는 유지.
function updateWinWinBadge(db: DBShape, rv: Reviewer, month: string, qualified: boolean, now: number): void {
  if (qualified) {
    const isNew = !rv.winWinBadge;
    rv.winWinBadge = { since: rv.winWinBadge?.since ?? now, lastQualifiedMonth: month };
    if (isNew) {
      db.notifications.push({
        id: rid("nt"),
        userId: rv.id,
        role: "reviewer",
        title: "상생 리뷰어가 되었어요 🤝",
        body: "매장과의 상생에 기여한 체험자에게 드리는 뱃지예요. 프로모션이 있을 때 우선 지급 대상이 됩니다.",
        createdAt: now,
        read: false,
        link: "/r/grade",
      });
    }
    return;
  }
  if (rv.winWinBadge && rv.winWinBadge.lastQualifiedMonth < prevMonthKey(month)) {
    // 2개월 연속 미달 — 회수
    rv.winWinBadge = undefined;
    db.notifications.push({
      id: rid("nt"),
      userId: rv.id,
      role: "reviewer",
      title: "상생 리뷰어 뱃지가 해제되었어요",
      body: "최근 두 달 동안 상생 기준을 충족하지 못했어요. 다시 충족하면 뱃지가 복원됩니다.",
      createdAt: now,
      read: false,
      link: "/r/grade",
    });
  }
}
