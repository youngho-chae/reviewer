// 등급 월간 재평가 스윕 — DB 로드 시마다 실행되는 지연(lazy) 배치 (2026-07-08 설계).
// 별도 크론 없이 매월 말(KST)이 지나면 직전 월 활동을 평가해 채널별 등급을 갱신한다.
//
//   GS_ch = 0.70·I_ch(지수점수) + 0.20·F(성실 이행) + 0.10·W(상생지수) − P(패널티)
//
//   I: 캐치랭크 지수 평가 모델 v1 (grade.ts indexScoreV1 — 채널 영향력 밴드 정규화)
//   F: 당월 완료율 = completed / (completed + 노쇼만료 + 리뷰기한초과 + 반려종착) ×100
//   W: 상생지수 — 완료 건별 초과 결제율 r=(paid−support)/max(support,1)의 min(r,1) 평균 ×100.
//      절대 금액은 어디에도 쓰지 않는다(비율·건별 캡 1.0·완료 전제·가중 10% — 등급 구매 모순 차단).
//   P: 노쇼 만료 −10/건 · 리뷰 기한 초과 −7/건 · 반려 종착(1회 재제출 후 추가 반려) −5/건,
//      월 상한 −30. 직전 월에도 P>0이면 당월 ×1.5 (누적 가중). 취소는 무패널티(12h 쿨다운이 담당).
//   리뷰 품질은 주관 평가 배제 원칙으로 점수 요소에서 제외 — 반려 종착만 P로 반영.
//
// 안정 장치: 등급 컷 S90/A70/B50/C30 · S는 자동 부여 금지(sCandidate 기록만) · 월 변동 ±1등급 ·
// 표본 부족(당월 이벤트 <2건)이면 F/W 중립(GS = I − P, 밴드가 컷과 일치해 지수 단독 산정과 동치) ·
// 이벤트 0건이면 스킵(등급 유지). 소급 없음 — 직전 1개월만 평가.
//
// [P1] 재평가·패널티·뱃지는 등급(=지원금 배율, 혜택 크기)에만 영향을 준다.
// 참여 가드(/api/passes)·노출(campaign-visibility)에는 어떤 조건도 추가하지 않는다.

import { DBShape, Grade, GradeHistoryEntry, Reviewer, SnsKind } from "./types";
import { indexScoreV1, bestGrade, gradeRank, gradeOrder } from "./grade";
import { REVIEW_DEADLINE_MS } from "./pass-lifecycle";
import { rid } from "./ids";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 가중치·컷·패널티 상수 (운영정책서 §등급 월간 재평가와 원문 일치)
export const REGRADE_WEIGHTS = { I: 0.7, F: 0.2, W: 0.1 } as const;
export const GRADE_CUTS: Array<{ grade: Grade; min: number }> = [
  { grade: "S", min: 90 },
  { grade: "A", min: 70 },
  { grade: "B", min: 50 },
  { grade: "C", min: 30 },
  { grade: "N", min: 0 },
];
export const PENALTY = { noShow: 10, overdue: 7, rejectedFinal: 5, monthlyCap: 30, repeatFactor: 1.5 } as const;
// 상생 리뷰어 뱃지 기준 — W ≥ 60 & 당월 완료 3건 이상. 유예 1개월(2개월 연속 미달 시 회수).
export const WINWIN_BADGE = { minW: 60, minCompleted: 3 } as const;
// S 후보 기준 — 부여는 운영팀 수동 (자동 승급 없음)
export const S_CANDIDATE = { minGS: 90, minCompleted: 5 } as const;
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
// 월 귀속 기준: 완료=검수 승인(completedAt) · 노쇼=expiresAt · 기한 초과=usedAt+7d ·
// 반려 종착=rejectedAt. 기한 초과 후 뒤늦게 완료된 패스는 각 월에 각각 집계된다.
export interface MonthlyActivity {
  completed: number;
  noShow: number;
  overdue: number;
  rejectedFinal: number; // 1회 재제출 후 추가 반려 (품질 문제의 유일한 반영 경로)
  wRatios: number[]; // 완료 건별 min(초과 결제율, 1.0)
}

export function collectMonthlyActivity(db: DBShape, reviewerId: string, month: string): MonthlyActivity {
  const act: MonthlyActivity = { completed: 0, noShow: 0, overdue: 0, rejectedFinal: 0, wRatios: [] };
  for (const p of db.passes) {
    if (p.reviewerId !== reviewerId) continue;

    if (p.status === "completed") {
      const at = p.completedAt ?? p.reviewSubmittedAt ?? p.usedAt; // 구버전 폴백
      if (at && kstMonthKey(at) === month) {
        act.completed += 1;
        // 상생 집계는 결제 기록이 있는 방문형 건만 — 배송형 등 결제 개념이 없는 완료 건은
        // W 분모에 넣지 않는다 (0으로 끌어내리면 비율 원칙 훼손). F(성실 이행)에는 포함.
        if (p.paidAmount != null && p.supportApplied != null) {
          const over = Math.max(0, p.paidAmount - p.supportApplied) / Math.max(p.supportApplied, 1);
          act.wRatios.push(Math.min(over, 1));
        }
      }
    }
    if (p.status === "expired" && kstMonthKey(p.expiresAt) === month) {
      act.noShow += 1;
    }
    if (p.overdueHandled && p.usedAt && kstMonthKey(p.usedAt + REVIEW_DEADLINE_MS) === month) {
      act.overdue += 1;
    }
    if (p.status === "rejected" && (p.resubmitCount ?? 0) >= 1 && p.rejectedAt && kstMonthKey(p.rejectedAt) === month) {
      act.rejectedFinal += 1;
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
}

export function computeChannelScore(
  indexScore: number,
  act: MonthlyActivity,
  prevMonthHadPenalty: boolean,
): ScoreBreakdown {
  const events = act.completed + act.noShow + act.overdue + act.rejectedFinal;
  const rawP = Math.min(
    PENALTY.monthlyCap,
    act.noShow * PENALTY.noShow + act.overdue * PENALTY.overdue + act.rejectedFinal * PENALTY.rejectedFinal,
  );
  const P = Math.round(rawP * (prevMonthHadPenalty && rawP > 0 ? PENALTY.repeatFactor : 1));

  if (events < MIN_SAMPLE) {
    // 표본 부족 — F/W 중립: 지수 단독 유지 (패널티는 항상 반영)
    const GS = Math.max(0, Math.min(100, Math.round(indexScore - P)));
    return { I: indexScore, F: 0, W: 0, P, GS, neutralized: true };
  }

  const F = Math.round((act.completed / events) * 100);
  const W = act.wRatios.length
    ? Math.round((act.wRatios.reduce((a, b) => a + b, 0) / act.wRatios.length) * 100)
    : 0;
  const GS = Math.max(
    0,
    Math.min(100, Math.round(REGRADE_WEIGHTS.I * indexScore + REGRADE_WEIGHTS.F * F + REGRADE_WEIGHTS.W * W - P)),
  );
  return { I: indexScore, F, W, P, GS, neutralized: false };
}

// GS → 등급. S 컷 도달 시 A로 캡(sCandidate는 호출부에서 기록) + 현재 등급 대비 ±1 클램프.
// 이미 운영팀이 S를 부여한 사용자가 S컷 점수를 유지하면 강등하지 않는다.
export function gradeFromScore(gs: number, current: Grade): { next: Grade; hitSCut: boolean } {
  let raw: Grade = "N";
  for (const c of GRADE_CUTS) {
    if (gs >= c.min) {
      raw = c.grade;
      break;
    }
  }
  const hitSCut = raw === "S";
  if (hitSCut) raw = current === "S" ? "S" : "A"; // S는 운영팀 부여 — 자동 승급 금지

  // ±1등급 클램프 (gradeOrder 랭크: S=0 … N=4, 숫자가 작을수록 상위)
  const cur = gradeRank(current);
  const clampedRank = Math.max(cur - 1, Math.min(cur + 1, gradeRank(raw)));
  // 자동 승급이 S(rank 0)에 진입하지 않도록 방어 (현재 S 유지 케이스만 허용)
  const rank = clampedRank === 0 && current !== "S" ? 1 : clampedRank;
  return { next: gradeOrder[rank], hitSCut };
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
    const events = act.completed + act.noShow + act.overdue + act.rejectedFinal;
    const history: GradeHistoryEntry[] = rv.gradeHistory ?? [];

    if (events === 0) {
      // 활동 없음 — 등급 유지, 이력만 기록
      history.push({
        month: target,
        from: rv.grade,
        to: rv.grade,
        breakdown: { I: 0, F: 0, W: 0, P: 0, GS: 0 },
        skipped: true,
        at: now,
      });
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
    let anySCandidate = false;

    for (const s of rv.sns) {
      if (!s.url) continue;
      const kind: SnsKind = s.kind;
      const bd = computeChannelScore(indexScoreV1(kind, s.influence), act, prevHadPenalty);
      const current = cg[kind] ?? "N";
      const { next, hitSCut } = gradeFromScore(bd.GS, current);
      const sCandidate = hitSCut && act.noShow === 0 && act.completed >= S_CANDIDATE.minCompleted;
      anySCandidate = anySCandidate || sCandidate;
      cg[kind] = next;
      history.push({
        month: target,
        channel: kind,
        from: current,
        to: next,
        breakdown: { I: bd.I, F: bd.F, W: bd.W, P: bd.P, GS: bd.GS },
        neutralized: bd.neutralized || undefined,
        sCandidate: sCandidate || undefined,
        at: now,
      });
      // 표기 등급 요약(연동 채널 중 최고)에는 최고 GS 채널의 분해를 사용
      if (!summary || bd.GS > summary.GS) summary = bd;
    }

    rv.channelGrades = cg;
    rv.grade = bestGrade(Object.values(cg));

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
      sCandidate: anySCandidate || undefined,
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
        title: up ? "등급이 올랐어요 🎉" : "등급이 조정되었어요",
        body: up
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
