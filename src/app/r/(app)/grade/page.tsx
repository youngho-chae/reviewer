import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { effectiveChannelState } from "@/lib/sns-cookie";
import { SBUI, sbNum } from "@/lib/storyboard";
import { SUPPORT_MULTIPLIER, gradeRank } from "@/lib/grade";
import { WINWIN_BADGE, kstMonthKey, kstMonthEnd, prevMonthKey, collectMonthlyActivity } from "@/lib/grade-regrade";
import { CHANNEL_ORDER, CHANNEL_LABEL, CHANNEL_SHORT, CHANNEL_BADGE_BG } from "@/lib/channels";
import GradeBadge from "@/components/GradeBadge";
import Icon from "@/components/Icon";
import type { Grade, SnsKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const TIER_COPY: Record<Grade, { label: string; desc: string }> = {
  "S+": { label: "S+ 등급", desc: "최상위 0.1% 리뷰어" },
  S: { label: "S 등급", desc: "상위 5% 리뷰어" },
  A: { label: "A 등급", desc: "검증된 리뷰어" },
  B: { label: "B 등급", desc: "일반 리뷰어" },
  C: { label: "C 등급", desc: "성장 단계" },
  N: { label: "New", desc: "채널 연동 전" },
};

// [P1] 모든 등급이 모든 캠페인에 참여할 수 있다 — 등급 차이는 지원금 배율(혜택 크기)뿐.
// S+의 추가 혜택은 배율 외 영역(포인트 보너스·프로모션 최우선·전용 배지 — §10.6).
const BENEFITS: { g: Grade; d: string; amt: string }[] = [
  { g: "S+", d: "모든 캠페인 참여 · 기준 지원금 전액 + 포인트 적립 +10% · 프로모션 최우선", amt: "100% 지원금" },
  { g: "S", d: "모든 캠페인 참여 · 기준 지원금 전액", amt: "100% 지원금" },
  { g: "A", d: "모든 캠페인 참여 · 기준 지원금의 80%", amt: "80% 지원금" },
  { g: "B", d: "모든 캠페인 참여 · 기준 지원금의 60%", amt: "60% 지원금" },
  { g: "C", d: "모든 캠페인 참여 · 기준 지원금의 40%", amt: "40% 지원금" },
  { g: "N", d: "모든 캠페인 참여 · 기준 지원금의 10%", amt: "10% 지원금" },
];

// 진입 조건 — 정성 서술 (2026-08-06: 가중치·점수 등 산식 수치는 유저 화면 비노출,
// 상세 기준표는 운영팀 콘솔 /admin/grading 전용)
const TIER_REQUIRE: Record<Grade, string> = {
  "S+": "S 등급 + 한 달 동안 성실 이행·상생 활동 모두 만점, 감점 요인 0건",
  S: "최상위 채널 영향력 + 꾸준하고 성실한 체험 완료 (매월 자동 평가)",
  A: "높은 채널 영향력 + 꾸준하고 성실한 체험 완료",
  B: "안정적인 채널 영향력과 활동 유지",
  C: "채널을 연동하고 활동을 시작하는 단계",
  N: "SNS 1개 이상 연동 시 평가 시작 (연동하면 바로 C 등급부터)",
};

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
  // 인스턴스 불일치 스톱갭 — 연동/해제 직후 본인 시점 최신 채널·표기 등급 (sns-cookie.ts)
  const eff = await effectiveChannelState(me);

  // 등급 변동 이력 (channel 미지정 = 표기 등급 요약 행)
  const summaries = (me.gradeHistory ?? []).filter((h) => !h.channel);

  // 다음 재평가일 = 이번 달 말일 (KST)
  const nextRegradeAt = kstMonthEnd(kstMonthKey(Date.now()));

  // 지난달 감점 요인 (2026-08-06 — 점수·비율 대신 행동 피드백: 건수만 노출)
  const lastMonthAct = collectMonthlyActivity(db, me.id, prevMonthKey(kstMonthKey(Date.now())));
  const demeritItems: Array<{ label: string; count: number; tip: string }> = [
    { label: "노쇼(미사용 만료)", count: lastMonthAct.noShow, tip: "받은 체험권은 기한 안에 방문해 사용해 주세요" },
    { label: "리뷰 기한 초과", count: lastMonthAct.overdue, tip: "리뷰는 이용 후 7일 안에 올려 주세요" },
    {
      label: "리뷰 반려",
      count: lastMonthAct.rejectedFinal + lastMonthAct.rejectedAbandoned,
      tip: "반려되면 안내에 맞춰 기한 안에 수정·재제출해 주세요",
    },
  ].filter((d) => d.count > 0);

  const unread = db.notifications.filter((n) => n.role === "reviewer" && n.userId === me.id && !n.read).length;

  // 3-stat 실값 — 진행 중(사용 전~리뷰 검수 중) · 내 최대 지원금(연동 채널 최고 등급 배율) · 사용 가능(active)
  const myPasses = db.passes.filter((p) => p.reviewerId === me.id);
  const inProgressCnt = myPasses.filter((p) => ["active", "used", "review_submitted"].includes(p.status)).length;
  const usableCnt = myPasses.filter((p) => p.status === "active").length;
  const maxSupportPct = SUPPORT_MULTIPLIER[eff.grade];

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
          <GradeBadge grade={eff.grade} size="xl" />
        </div>
        <h1 className="text-[22px] font-bold text-ink tracking-title leading-[1.3]">
          {eff.grade}등급
        </h1>
        <p className="mt-1.5 text-[14px] text-ink2 leading-[1.4]">{TIER_COPY[eff.grade].desc}</p>
        {me.winWinBadge && (
          <div className="mt-3 flex justify-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-brandSoft text-brand text-[13px] font-semibold">
              🤝 상생 리뷰어
            </span>
          </div>
        )}

        {/* 진행도 %바는 제거 (2026-08-06 — 산식 수치 비노출 원칙) — 재평가 일정만 안내 */}
        <div className="mt-5 text-[12px] text-muted">
          다음 재평가일 {sbNum(SBUI.date, fmtKstDate(nextRegradeAt))} · 월 변동 폭 ±1등급
        </div>
      </section>

      {/* 다음 달 등급 올리기 — 행동 가이드 (2026-08-06: 점수·가중치 분해 표 폐기 — 산식 수치는
          운영팀 콘솔 /admin/grading 전용. 유저에게는 "무엇을 하면 되는지"만 보여준다) */}
      <section className="px-5 mt-1">
        <h2 className="text-[18px] font-bold text-ink tracking-title mb-2">다음 달 등급을 올리려면</h2>
        <p className="text-[12px] text-muted mb-3 leading-[1.5]">
          매월 말 직전 한 달의 활동을 평가해요. 등급은 오를 수도, 내려갈 수도 있어요.
        </p>

        {/* 지난달 감점 요인 — 있을 때만, 건수·행동 안내 (점수 비노출) */}
        {demeritItems.length > 0 && (
          <div className="mb-3 rounded-lg border border-hairline bg-errorSoft/40 p-4">
            <div className="text-[13px] font-bold text-error">지난달 아쉬웠던 점</div>
            <ul className="mt-2 space-y-1.5">
              {demeritItems.map((d) => (
                <li key={d.label} className="text-[12px] text-ink2 leading-[1.5]">
                  <span className="font-semibold text-ink">{d.label} {sbNum(SBUI.count, `${d.count}건`)}</span> — {d.tip}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted">같은 일이 두 달 연속 반복되면 평가에 더 크게 반영돼요.</p>
          </div>
        )}

        <div className="rounded-lg border border-hairline overflow-hidden">
          {[
            {
              icon: "✅",
              title: "체험을 끝까지 완료해요",
              tip: "리뷰 검수 승인까지 마친 체험이 많을수록 평가에 유리해요. 노쇼·기한 초과 없이 한 달을 보내는 게 가장 중요해요.",
            },
            {
              icon: "⏱️",
              title: "리뷰는 이용 직후 바로 올려요",
              tip: "마감일을 기다렸다 내는 것보다 방문 직후 바로 올릴수록 성실 이행 평가가 좋아져요.",
            },
            {
              icon: "🤝",
              title: "지원금보다 조금 더 결제해보세요",
              tip: "지원금을 넘는 추가 결제는 상생 활동으로 반영돼요. 금액 크기가 아니라 꾸준함이 중요해요 — 여러 체험에서 쌓일수록 좋아요.",
            },
            {
              icon: "📣",
              title: "채널 영향력을 키워요",
              tip: "블로그 방문자·팔로워가 늘면 기본 평가가 올라가요. 채널 관리에서 최신 지표로 갱신할 수 있어요.",
            },
            {
              icon: "✍️",
              title: "반려되면 기한 안에 다시 제출해요",
              tip: "반려 후 7일 안에 수정·재제출하면 완료로 인정돼요. 그대로 두면 이행하지 않은 것으로 집계됩니다.",
            },
          ].map((g, i, arr) => (
            <div key={g.title} className={`px-4 py-3.5 flex gap-3 ${i < arr.length - 1 ? "border-b border-hairlineSoft" : ""}`}>
              <span className="shrink-0 text-[16px] leading-[1.4]" aria-hidden>{g.icon}</span>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-ink">{g.title}</div>
                <div className="text-[12px] text-muted mt-0.5 leading-[1.5]">{g.tip}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* S+ 도전/유지 안내 — S·S+ 등급에게만 (2026-08-06 6단계) */}
      {(eff.grade === "S" || eff.grade === "S+") && (
        <section className="px-5 mt-3">
          <div className="rounded-md border border-hairline bg-canvas p-4">
            <div className="text-[14px] font-bold text-ink">
              👑 {eff.grade === "S+" ? "S+ 등급을 유지하려면" : "S+ 등급에 도전해보세요"}
            </div>
            <p className="mt-1.5 text-[12px] text-ink2 leading-[1.6]">
              한 달 동안 노쇼·기한 초과·반려 없이 모든 체험을 완료하고, 리뷰를 빠르게 올리고, 결제한 체험마다
              지원금 이상으로 결제하면 S 등급 위의 <b>S+</b>가 부여돼요. 포인트 적립 +10%와 프로모션 최우선
              혜택이 있어요. 조건을 하나라도 놓치면 다음 달 S로 돌아갑니다.
            </p>
          </div>
        </section>
      )}

      {/* 상생지수 안내 — 모순 방지 원칙 카피 (운영정책서 원문주의) */}
      <section className="px-5 mt-5">
        <div className="rounded-md bg-brandSoft p-4">
          <div className="text-[14px] font-bold text-ink">🤝 상생지수와 상생 리뷰어</div>
          <p className="mt-1.5 text-[12px] text-ink2 leading-[1.6]">
            상생지수는 추가 결제의 <b>비율과 빈도</b>만 반영해요. 결제 금액 자체는 반영되지 않으며, 리뷰까지 완료한
            체험만 집계됩니다. 한 달에 여러 건이 쌓일수록 온전히 반영되고, 결제 체험이 없는 달은 빼고 평가해요.
            상생지수만으로는 등급이 오르지 않아요.
          </p>
          <p className="mt-2 text-[12px] text-ink2 leading-[1.6]">
            한 달 동안 상생 활동이 꾸준하고 완료가 {WINWIN_BADGE.minCompleted}건 이상이면{" "}
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
                    {/* 점수(GS) 비노출 (2026-08-06) — 변동 방향만 */}
                    {h.skipped
                      ? "활동 없음 · 등급 유지"
                      : h.from === h.to
                        ? "등급 유지"
                        : gradeRank(h.to) < gradeRank(h.from)
                          ? "등급 상승"
                          : "등급 조정"}
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
            const g = eff.channelGrades[ch];
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
                    {connected ? `지원금 ${Math.round(SUPPORT_MULTIPLIER[g as Grade] * 100)}% 적용` : "미연동"}
                  </div>
                </div>
                {connected ? (
                  <GradeBadge grade={g as Grade} size="sm" />
                ) : (
                  <Link href="/r/me/channels" className="cp-action text-[12px] font-semibold text-brand shrink-0">
                    채널 관리에서 연동 →
                  </Link>
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
            <div className="mt-1 text-[16px] font-bold text-ink tabular-nums">{sbNum(SBUI.count, `${inProgressCnt}건`)}</div>
          </div>
          <div className="py-4 px-2 text-center border-l border-r border-hairlineSoft">
            <div className="text-[12px] text-muted">내 최대 지원금</div>
            <div className="mt-1 text-[16px] font-bold text-ink tabular-nums">{sbNum(SBUI.support, `기준의 ${Math.round(maxSupportPct * 100)}%`)}</div>
          </div>
          <div className="py-4 px-2 text-center">
            <div className="text-[12px] text-brand font-semibold">🎫 사용 가능</div>
            <div className="mt-1 text-[16px] font-bold text-brand tabular-nums">{sbNum(SBUI.count, `${usableCnt}건`)}</div>
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
            <div className="text-[11px] text-muted mt-0.5">사용 가능 {sbNum(SBUI.count, `${usableCnt}건`)} · 작성 대기/완료 포함</div>
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
          등급은 매월 말 채널 영향력·성실한 완료·상생 활동과 감점 요인을 종합해 재평가됩니다. 변동 폭은 월
          ±1등급이며, 등급은 혜택의 크기에만 영향을 주고 참여 자격을 제한하지 않아요.
        </p>
      </section>
    </div>
  );
}
