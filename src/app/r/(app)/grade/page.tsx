import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { SBUI, sbNum } from "@/lib/storyboard";
import { SUPPORT_MULTIPLIER } from "@/lib/grade";
import { GRADE_CUTS, WINWIN_BADGE, kstMonthKey, kstMonthEnd } from "@/lib/grade-regrade";
import { CHANNEL_ORDER, CHANNEL_LABEL, CHANNEL_SHORT, CHANNEL_BADGE_BG } from "@/lib/channels";
import GradeBadge from "@/components/GradeBadge";
import Icon from "@/components/Icon";
import type { Grade, SnsKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const TIER_COPY: Record<Grade, { label: string; desc: string }> = {
  S: { label: "S 등급", desc: "상위 5% 리뷰어" },
  A: { label: "A 등급", desc: "검증된 리뷰어" },
  B: { label: "B 등급", desc: "일반 리뷰어" },
  C: { label: "C 등급", desc: "성장 단계" },
  N: { label: "New", desc: "검증 전" },
};

// [P1] 모든 등급이 모든 캠페인에 참여할 수 있다 — 등급 차이는 지원금 배율(혜택 크기)뿐.
const BENEFITS: { g: Grade; d: string; amt: string }[] = [
  { g: "S", d: "모든 캠페인 참여 · 기준 지원금 전액", amt: "100% 지원금" },
  { g: "A", d: "모든 캠페인 참여 · 기준 지원금의 80%", amt: "80% 지원금" },
  { g: "B", d: "모든 캠페인 참여 · 기준 지원금의 60%", amt: "60% 지원금" },
  { g: "C", d: "모든 캠페인 참여 · 기준 지원금의 40%", amt: "40% 지원금" },
  { g: "N", d: "모든 캠페인 참여 · 기준 지원금의 10%", amt: "10% 지원금" },
];

// 진입 조건 = 월간 등급 점수(GS) 컷 (운영정책서 §등급 월간 재평가)
const TIER_REQUIRE: Record<Grade, string> = {
  S: "월간 등급 점수 90점 이상 + 운영팀 부여 (자동 승급 없음)",
  A: "월간 등급 점수 70점 이상",
  B: "월간 등급 점수 50점 이상",
  C: "월간 등급 점수 30점 이상",
  N: "SNS 1개 이상 연동 시 지수 평가로 시작",
};

// 점수 분해 행 정의 — 가중치는 유한 범주(정책 상수)라 원문 노출
const SCORE_ROWS: { key: "I" | "F" | "W"; name: string; weight: string; hint: string }[] = [
  { key: "I", name: "지수 점수", weight: "70%", hint: "캐치랭크 지수 평가 모델 — 채널 영향력 기반" },
  { key: "F", name: "성실 이행", weight: "20%", hint: "지난달 체험 완료율 (노쇼·기한 초과·최종 반려 제외)" },
  { key: "W", name: "상생지수", weight: "10%", hint: "추가 결제의 비율·빈도만 반영 (금액 아님)" },
];

function fmtKstDate(ts: number): string {
  const d = new Date(ts + 9 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}`;
}

function fmtMonth(month: string): string {
  return month.replace("-", ".");
}

export default async function ReviewerGrade() {
  const me = await getCurrentReviewer();
  const db = await getDBAsync();

  // 최신 월간 재평가 결과 (channel 미지정 = 종합 요약 행)
  const summaries = (me.gradeHistory ?? []).filter((h) => !h.channel);
  const latest = summaries.length > 0 ? summaries[summaries.length - 1] : null;
  const latestScored = latest && !latest.skipped ? latest : null;

  // 다음 재평가일 = 이번 달 말일 (KST)
  const nextRegradeAt = kstMonthEnd(kstMonthKey(Date.now()));

  // 다음 등급 컷까지 진행도 — 최신 GS 기준 (구조 표현이므로 실제 비율 유지)
  const cutOf = (g: Grade) => GRADE_CUTS.find((c) => c.grade === g)?.min ?? 0;
  const nextGradeOf: Partial<Record<Grade, Grade>> = { N: "C", C: "B", B: "A", A: "S" };
  const nextGrade = nextGradeOf[me.grade];
  const progress =
    latestScored && nextGrade
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round(
              ((latestScored.breakdown.GS - cutOf(me.grade)) / (cutOf(nextGrade) - cutOf(me.grade))) * 100,
            ),
          ),
        )
      : null;

  const unread = db.notifications.filter((n) => n.role === "reviewer" && n.userId === me.id && !n.read).length;

  return (
    <div className="pb-24 bg-canvas">
      {/* top-app-bar — 화이트 52px */}
      <div className="sticky top-0 z-30 bg-canvas">
        <div className="h-[52px] px-5 flex items-center justify-between">
          <h1 className="text-[18px] font-bold text-ink tracking-title">등급</h1>
          <Link
            href="/r/notifications"
            className="cp-action relative w-10 h-10 rounded-full flex items-center justify-center text-ink"
            aria-label="알림"
          >
            <Icon name="bell" variant={unread > 0 ? "bold" : "border"} size={22} />
            {unread > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand" />}
          </Link>
        </div>
      </div>

      {/* 내 등급 히어로 — 등급 배지 + (보유 시) 상생 리뷰어 뱃지 + 다음 컷 진행도 */}
      <section className="px-5 pt-6 pb-8 text-center">
        <div className="flex justify-center mb-4">
          <GradeBadge grade={me.grade} size="xl" />
        </div>
        <h1 className="text-[22px] font-bold text-ink tracking-title leading-[1.3]">
          {me.grade}등급
        </h1>
        <p className="mt-1.5 text-[14px] text-ink2 leading-[1.4]">{TIER_COPY[me.grade].desc}</p>
        {me.winWinBadge && (
          <div className="mt-3 flex justify-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-brandSoft text-brand text-[13px] font-semibold">
              🤝 상생 리뷰어
            </span>
          </div>
        )}

        {progress != null && nextGrade && (
          <div className="mt-6 max-w-[300px] mx-auto">
            <div className="flex justify-between text-[13px] text-muted mb-2">
              <span>다음 등급 컷({nextGrade})까지</span>
              <span className="text-ink font-semibold tabular-nums">{progress}%</span>
            </div>
            <div className="h-1 bg-brandTint rounded-pill overflow-hidden">
              <div className="h-full bg-brand rounded-pill transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 text-[12px] text-muted">
              다음 재평가일 {sbNum(SBUI.date, fmtKstDate(nextRegradeAt))} · 월 변동 폭 ±1등급
            </div>
          </div>
        )}
      </section>

      {/* 월간 등급 점수 분해 — 지난달 재평가 결과 (지수 70% · 성실 20% · 상생 10% − 패널티) */}
      <section className="px-5 mt-1">
        <h2 className="text-[18px] font-bold text-ink tracking-title mb-2">지난달 등급 점수</h2>
        <p className="text-[12px] text-muted mb-3 leading-[1.5]">
          매월 말 직전 한 달의 활동을 평가해요. 등급은 오를 수도, 내려갈 수도 있어요.
        </p>
        {latestScored ? (
          <div className="rounded-lg border border-hairline overflow-hidden">
            {SCORE_ROWS.map((row) => (
              <div key={row.key} className="px-4 py-3.5 border-b border-hairlineSoft">
                <div className="flex items-baseline justify-between">
                  <span className="text-[14px] font-medium text-ink">
                    {row.name} <span className="text-[11px] text-muted">({row.weight})</span>
                  </span>
                  <span className="text-[14px] font-semibold text-ink tabular-nums">
                    {latestScored.neutralized && row.key !== "I"
                      ? "중립"
                      : sbNum(SBUI.score, `${latestScored.breakdown[row.key]}점`)}
                  </span>
                </div>
                <div className="text-[11px] text-muted mt-0.5">{row.hint}</div>
              </div>
            ))}
            {latestScored.breakdown.P > 0 && (
              <div className="px-4 py-3.5 border-b border-hairlineSoft bg-errorSoft/40">
                <div className="flex items-baseline justify-between">
                  <span className="text-[14px] font-medium text-error">패널티 (차감)</span>
                  <span className="text-[14px] font-semibold text-error tabular-nums">
                    −{sbNum(SBUI.score, `${latestScored.breakdown.P}점`)}
                  </span>
                </div>
                <div className="text-[11px] text-muted mt-0.5">노쇼·리뷰 기한 초과·최종 반려 — 연속 발생 시 가중</div>
              </div>
            )}
            <div className="px-4 py-3.5 bg-sunken/60">
              <div className="flex items-baseline justify-between">
                <span className="text-[14px] font-bold text-ink">월간 등급 점수</span>
                <span className="text-[16px] font-bold text-brand tabular-nums">
                  {sbNum(SBUI.score, `${latestScored.breakdown.GS}점`)}
                </span>
              </div>
              {latestScored.neutralized && (
                <div className="text-[11px] text-muted mt-0.5">지난달 활동 표본이 적어 지수 중심으로 평가했어요.</div>
              )}
              {latestScored.sCandidate && (
                <div className="text-[11px] text-brand font-semibold mt-0.5">S 등급 후보 — 운영팀 확인 후 부여됩니다.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-hairline px-4 py-5 text-[13px] text-muted leading-[1.5]">
            아직 재평가 이력이 없어요. 첫 재평가는 가입 다음 달 말일({sbNum(SBUI.date, fmtKstDate(nextRegradeAt))})에 진행되며,
            그 전까지는 연동 시 산정된 지수 등급이 유지됩니다.
          </div>
        )}
      </section>

      {/* 상생지수 안내 — 모순 방지 원칙 카피 (운영정책서 원문주의) */}
      <section className="px-5 mt-5">
        <div className="rounded-md bg-brandSoft p-4">
          <div className="text-[14px] font-bold text-ink">🤝 상생지수와 상생 리뷰어</div>
          <p className="mt-1.5 text-[12px] text-ink2 leading-[1.6]">
            상생지수는 추가 결제의 <b>비율과 빈도</b>만 반영해요. 결제 금액 자체는 반영되지 않으며, 리뷰까지 완료한
            체험만 집계됩니다. 상생지수만으로는 등급이 오르지 않아요(가중치 10%).
          </p>
          <p className="mt-2 text-[12px] text-ink2 leading-[1.6]">
            한 달 상생지수 {WINWIN_BADGE.minW}점 이상 + 완료 {WINWIN_BADGE.minCompleted}건 이상이면{" "}
            <b>상생 리뷰어</b> 뱃지를 드려요. 프로모션이 있을 때 우선 지급 대상이 됩니다. 뱃지는 표시용이며 지원금
            비율·참여 조건은 달라지지 않아요.
          </p>
        </div>
      </section>

      {/* 등급 변동 이력 — 월간 재평가 기록 (최근 6개월) */}
      {summaries.length > 0 && (
        <section className="px-5 mt-8">
          <h2 className="text-[18px] font-bold text-ink tracking-title mb-3">등급 변동 이력</h2>
          <div className="rounded-lg border border-hairline overflow-hidden">
            {summaries
              .slice(-6)
              .reverse()
              .map((h, i, arr) => (
                <div
                  key={h.month}
                  className={`flex items-center gap-3 px-4 py-3.5 ${i < arr.length - 1 ? "border-b border-hairlineSoft" : ""}`}
                >
                  <span className="text-[12px] text-muted tabular-nums w-[56px] shrink-0">
                    {sbNum(SBUI.month, fmtMonth(h.month))}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <GradeBadge grade={h.from} size="sm" />
                    <span className="text-[12px] text-muted">→</span>
                    <GradeBadge grade={h.to} size="sm" />
                  </span>
                  <span className="flex-1 min-w-0 text-right text-[11px] text-muted">
                    {h.skipped
                      ? "활동 없음 · 등급 유지"
                      : h.neutralized
                        ? "표본 부족 · 지수 중심"
                        : sbNum(SBUI.score, `${h.breakdown.GS}점`)}
                    {h.winWinQualified && <span className="ml-1.5 text-brand font-semibold">🤝</span>}
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* 채널별 등급 — 연동 채널을 독립 평가 (v2.16) */}
      <section className="px-5 mt-8">
        <h2 className="text-[18px] font-bold text-ink tracking-title mb-2">채널별 등급</h2>
        <p className="text-[12px] text-muted mb-3 leading-[1.5]">
          연동한 채널마다 영향력을 따로 평가해요. 참여 시 선택한 채널의 등급에 맞춰 지원금이 정해집니다.
        </p>
        <div className="rounded-lg border border-hairline overflow-hidden">
          {CHANNEL_ORDER.map((ch: SnsKind, i) => {
            const g = me.channelGrades?.[ch];
            const connected = !!g;
            return (
              <div
                key={ch}
                className={`flex items-center gap-3 px-4 py-3.5 ${i < CHANNEL_ORDER.length - 1 ? "border-b border-hairlineSoft" : ""}`}
              >
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-[6px] text-[12px] font-bold ${CHANNEL_BADGE_BG[ch]}`}>
                  {CHANNEL_SHORT[ch]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] text-ink font-medium">{CHANNEL_LABEL[ch]}</div>
                  <div className="text-[11px] text-muted mt-0.5">
                    {connected ? `지원금 ${Math.round(SUPPORT_MULTIPLIER[g as Grade] * 100)}% 적용` : "미연동 · 고객센터로 추가 문의"}
                  </div>
                </div>
                {connected ? (
                  <GradeBadge grade={g as Grade} size="sm" />
                ) : (
                  <span className="text-[12px] text-muted">미연동</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 3-stat 카드 — 화이트 stat-strip (v2: 다크 타일 금지) */}
      <section className="px-5 mt-5">
        <div className="rounded-lg border border-hairline bg-canvas grid grid-cols-3">
          <div className="py-4 px-2 text-center">
            <div className="text-[12px] text-muted">진행 중인 체험</div>
            <div className="mt-1 text-[16px] font-bold text-ink tabular-nums">{SBUI.count}</div>
          </div>
          <div className="py-4 px-2 text-center border-l border-r border-hairlineSoft">
            <div className="text-[12px] text-muted">내 최대 지원금</div>
            <div className="mt-1 text-[16px] font-bold text-ink tabular-nums">{SBUI.support}</div>
          </div>
          <div className="py-4 px-2 text-center">
            <div className="text-[12px] text-brand font-semibold">🎫 사용 가능</div>
            <div className="mt-1 text-[16px] font-bold text-brand tabular-nums">{SBUI.count}</div>
          </div>
        </div>
      </section>

      {/* 내 체험권 entry — 기존 혜택 탭에서 이동 (v2.9) */}
      <section className="px-5 mt-3">
        <Link
          href="/r/passes"
          className="cp-action flex items-center gap-3 p-4 rounded-md border border-hairline bg-canvas"
        >
          <span className="w-10 h-10 rounded-md bg-brandTint text-brand flex items-center justify-center">
            <Icon name="ticket" variant="bold" size={20} />
          </span>
          <div className="flex-1">
            <div className="text-[14px] font-semibold text-ink">내 체험권</div>
            <div className="text-[11px] text-muted mt-0.5">사용 가능 {SBUI.count} · 작성 대기/완료 포함</div>
          </div>
          <Icon name="chevron-right" variant="border" size={14} className="text-muted" />
        </Link>
      </section>

      {/* 등급별 혜택 사다리 — 진입 조건(GS 컷) 통합 */}
      <section className="px-5 pt-10 pb-10">
        <h2 className="text-[18px] font-bold text-ink tracking-title mb-4">등급별 혜택</h2>
        <div className="space-y-2.5">
          {BENEFITS.map((b) => {
            const isMe = b.g === me.grade;
            return (
              <div
                key={b.g}
                className={`rounded-md p-4 flex items-start gap-3 bg-canvas ${isMe ? "border-[1.5px] border-brand" : "border border-hairline"}`}
              >
                <GradeBadge grade={b.g} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold text-ink">{TIER_COPY[b.g].label}</span>
                    {isMe && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-pill bg-brand text-white font-semibold">내 등급</span>
                    )}
                  </div>
                  <div className="text-[12px] text-muted mt-1 leading-[1.45]">{b.d}</div>
                  <div className="text-[11px] text-ink2 mt-1.5">진입 조건: {TIER_REQUIRE[b.g]}</div>
                </div>
                <div className="text-[13px] font-semibold text-ink shrink-0 pt-0.5 tabular-nums">{b.amt}</div>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-[11px] text-muted leading-[1.5] text-center">
          등급은 매월 말 지수 점수(70%)·성실 이행(20%)·상생지수(10%)와 패널티를 종합해 재평가됩니다. 변동 폭은 월
          ±1등급이며, 등급은 지원금 비율에만 영향을 주고 참여 자격을 제한하지 않아요.
        </p>
      </section>
    </div>
  );
}
