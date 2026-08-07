import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { effectiveChannelState } from "@/lib/sns-cookie";
import { SBUI, sbNum } from "@/lib/storyboard";
import { SUPPORT_MULTIPLIER, gradeRank, bestGrade } from "@/lib/grade";
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
  { g: "N", d: "모든 캠페인 참여(방문형은 영수증 리뷰로) · 결제 금액의 10% 할인", amt: "10% 할인" },
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

  // ── 이번 달(평가 대상월) 실측 현황 (2026-08-07 — 개인화 행동 가이드) ─────────
  // 산식 수치(가중치·점수·컷)는 비노출 원칙 유지 — 행동 단위 수치(건수·표본)만 보여준다.
  // 집계 기준은 재평가 스윕과 동일 정본(collectMonthlyActivity)이라 안내와 평가가 어긋나지 않는다.
  const thisMonth = kstMonthKey(Date.now());
  const thisMonthLabel = `${Number(thisMonth.slice(5))}월`;
  const thisAct = collectMonthlyActivity(db, me.id, thisMonth);
  const thisDemerits = thisAct.noShow + thisAct.overdue + thisAct.rejectedFinal;
  // 상생 만점 표본 = 지원금의 2배 이상 결제(r≥1, 스윕과 동일 캡) — 3건부터 온전히 반영
  const wFull = thisAct.wRatios.filter((r) => r >= 1).length;
  const wPartial = thisAct.wRatios.length - wFull;
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

  // 행동 가이드 보조 — 지금 처리하면 바로 좋아지는 대기 건들
  const reviewWaitCnt = myPasses.filter((p) => p.status === "used").length; // 리뷰 작성 대기
  const resubmitWaitCnt = myPasses.filter((p) => p.status === "rejected").length; // 반려 재제출 대기
  const ongoingCnt = usableCnt + reviewWaitCnt; // 이번 달 안에 마무리할 수 있는 진행 건
  const connectedChannels = CHANNEL_ORDER.filter((ch) => !!eff.channelGrades[ch]);
  const bestChannelGrade = bestGrade(Object.values(eff.channelGrades));
  // 상태 칩 톤 (v2 토큰) — 만점 페이스/진행 중/주의/중립
  const CHIP: Record<"success" | "progress" | "warn" | "neutral", string> = {
    success: "bg-successSoft text-successStrong",
    progress: "bg-brandSoft text-brand",
    warn: "bg-errorSoft text-error",
    neutral: "bg-sunken text-muted",
  };

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

      {/* 다음 달 등급 올리기 — 이번 달 실측 기반 개인화 가이드 (2026-08-07 개편).
          산식 수치(가중치·점수·컷)는 계속 비노출(운영팀 콘솔 전용) — 대신 스윕과 동일한
          집계로 "지금 상태 → 만점까지 무엇이 얼마나 더 필요한지"를 행동 단위 수치로 보여준다. */}
      <section className="px-5 mt-1">
        <h2 className="text-[18px] font-bold text-ink tracking-title mb-2">다음 달 등급을 올리려면</h2>
        <p className="text-[12px] text-muted mb-3 leading-[1.5]">
          이번 달({thisMonthLabel}) 활동 기준이에요 — 매월 말 이 현황 그대로 평가돼요. 등급은 오를 수도, 내려갈 수도 있어요.
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

        <div className="space-y-2.5">
          {/* ① 성실 이행 — 이번 달 완료·감점 실측 + 만점 조건 */}
          <div className="rounded-lg border border-hairline bg-canvas p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[14px] font-bold text-ink">✅ 성실하게 완료하기</div>
              <span
                className={`shrink-0 text-[11px] px-2 py-0.5 rounded-pill font-semibold ${
                  thisDemerits + thisAct.rejectedAbandoned > 0 ? CHIP.warn : thisAct.completed > 0 ? CHIP.success : CHIP.neutral
                }`}
              >
                {thisDemerits + thisAct.rejectedAbandoned > 0 ? "주의" : thisAct.completed > 0 ? "만점 페이스" : "시작 전"}
              </span>
            </div>
            <div className="mt-2 text-[13px] text-ink">
              이번 달 완료 <b className="tabular-nums">{sbNum(SBUI.count, `${thisAct.completed}건`)}</b> · 감점 요인{" "}
              <b className={`tabular-nums ${thisDemerits > 0 ? "text-error" : ""}`}>{sbNum(SBUI.count, `${thisDemerits}건`)}</b>
              {thisAct.rejectedAbandoned > 0 && (
                <> · 반려 방치 <b className="tabular-nums text-error">{sbNum(SBUI.count, `${thisAct.rejectedAbandoned}건`)}</b></>
              )}
            </div>
            <p className="mt-1.5 text-[12px] text-muted leading-[1.55]">
              {thisDemerits + thisAct.rejectedAbandoned > 0
                ? "이미 감점 요인이 있어요 — 남은 체험을 빠짐없이 완료하면 만회할 수 있어요."
                : ongoingCnt > 0
                  ? `진행 중인 체험 ${ongoingCnt}건을 노쇼·기한 초과 없이 마치면 이번 달 만점이에요.`
                  : "노쇼·기한 초과·반려 없이 완료한 체험이 쌓일수록 만점에 가까워져요."}
            </p>
            {reviewWaitCnt > 0 && (
              <Link href="/r/passes" className="cp-action mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-brand">
                리뷰 작성 대기 {sbNum(SBUI.count, `${reviewWaitCnt}건`)} — 지금 올릴수록 평가가 좋아져요 →
              </Link>
            )}
          </div>

          {/* ② 반려 재제출 — 대기 건이 있을 때만 (방치 = 미이행 집계) */}
          {resubmitWaitCnt > 0 && (
            <div className="rounded-lg border border-hairline bg-canvas p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[14px] font-bold text-ink">✍️ 반려 리뷰 다시 제출하기</div>
                <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-pill font-semibold ${CHIP.warn}`}>주의</span>
              </div>
              <div className="mt-2 text-[13px] text-ink">
                재제출 대기 <b className="tabular-nums text-error">{sbNum(SBUI.count, `${resubmitWaitCnt}건`)}</b>
              </div>
              <p className="mt-1.5 text-[12px] text-muted leading-[1.55]">
                반려 후 7일 안에 다시 제출하면 완료로 인정돼요. 그대로 두면 이행하지 않은 것으로 집계됩니다.
              </p>
              <Link href="/r/passes" className="cp-action mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-brand">
                내 체험권에서 재제출하기 →
              </Link>
            </div>
          )}

          {/* ③ 상생 활동 — 만점 표본 진행도 (지원금 2배 이상 결제 × 3건, 스윕과 동일 판정) */}
          <div className="rounded-lg border border-hairline bg-canvas p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[14px] font-bold text-ink">🤝 상생 활동 쌓기</div>
              <span
                className={`shrink-0 text-[11px] px-2 py-0.5 rounded-pill font-semibold ${
                  wFull >= 3 && wPartial === 0 ? CHIP.success : thisAct.wRatios.length === 0 ? CHIP.neutral : CHIP.progress
                }`}
              >
                {wFull >= 3 && wPartial === 0 ? "만점 페이스" : thisAct.wRatios.length === 0 ? "표본 없음" : "진행 중"}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[13px] text-ink">
                이번 달 결제 체험 <b className="tabular-nums">{sbNum(SBUI.count, `${thisAct.wRatios.length}건`)}</b>
                <span className="text-muted"> · 온전히 반영 </span>
                <b className="tabular-nums">{sbNum(SBUI.count, `${wFull}건`)}</b>
                <span className="text-muted"> / 3건</span>
              </span>
              <span className="flex gap-1" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span key={i} className={`w-2 h-2 rounded-full ${i < Math.min(wFull, 3) ? "bg-brand" : "bg-borderStrong/40"}`} />
                ))}
              </span>
            </div>
            {/* 소비 유도 금지 (2026-08-07) — "더 담아보세요"류 부추김 없이 반영 기준만 사실 안내.
                기준(결제액 ≥ 지원금 2배·표본 3건)은 스윕 공식과 동일 값. */}
            <p className="mt-1.5 text-[12px] text-muted leading-[1.55]">
              {wFull >= 3 && wPartial === 0
                ? "이 페이스면 상생 만점이에요 — 지금처럼 꾸준히면 충분해요."
                : thisAct.wRatios.length === 0
                  ? "이번 달 결제 체험이 없으면 상생은 평가에서 빠져요 — 불이익은 없어요."
                  : "지원금을 넘는 결제는 부분 반영되고, 결제 금액이 지원금의 2배를 넘으면 한 건이 온전히 반영돼요(리뷰 완료 건만 집계)."}{" "}
              무리해서 결제할 필요는 없어요 — 실제로 이용한 만큼만, 꾸준히 쌓이는 게 중요해요.
            </p>
          </div>

          {/* ④ 채널 영향력 — 현재 채널 등급 + 갱신/성장 유도 (지수 점수는 비노출) */}
          <div className="rounded-lg border border-hairline bg-canvas p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[14px] font-bold text-ink">📣 채널 영향력 키우기</div>
              <span
                className={`shrink-0 text-[11px] px-2 py-0.5 rounded-pill font-semibold ${
                  connectedChannels.length === 0 ? CHIP.neutral : bestChannelGrade === "S" ? CHIP.success : CHIP.progress
                }`}
              >
                {connectedChannels.length === 0 ? "미연동" : bestChannelGrade === "S" ? "최고 수준" : "성장 여지"}
              </span>
            </div>
            {connectedChannels.length > 0 ? (
              <div className="mt-2 flex items-center gap-2.5">
                {connectedChannels.map((ch) => (
                  <span key={ch} className="inline-flex items-center gap-1.5 text-[13px] text-ink">
                    <GradeBadge grade={eff.channelGrades[ch] as Grade} size="sm" />
                    {CHANNEL_SHORT[ch]}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-[13px] text-ink">연동된 채널이 없어요</div>
            )}
            <p className="mt-1.5 text-[12px] text-muted leading-[1.55]">
              {connectedChannels.length === 0
                ? "채널을 연동하면 기본 평가가 시작돼요 — 연동 즉시 최소 C 등급부터예요."
                : bestChannelGrade === "S"
                  ? "채널 영향력은 이미 최고 수준이에요 — 지표를 최신으로 유지하는 게 중요해요."
                  : "블로그 방문자·팔로워가 늘면 기본 평가가 올라가요 — 채널 관리에서 최신 지표로 갱신해 반영하세요."}
            </p>
            <Link href="/r/me/channels" className="cp-action mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-brand">
              채널 관리에서 {connectedChannels.length === 0 ? "연동하기" : "지표 갱신하기"} →
            </Link>
          </div>
        </div>
      </section>

      {/* S+ 도전/유지 안내 — S·S+ 등급에게만 (2026-08-06 6단계 · 2026-08-07 조건 체크리스트化).
          이번 달 실측(스윕과 동일 집계)으로 조건별 충족/부족을 바로 보여준다. */}
      {(eff.grade === "S" || eff.grade === "S+") && (
        <section className="px-5 mt-3">
          <div className="rounded-md border border-hairline bg-canvas p-4">
            <div className="text-[14px] font-bold text-ink">
              👑 {eff.grade === "S+" ? "S+ 등급을 유지하려면" : "S+ 등급에 도전해보세요"}
            </div>
            <p className="mt-1.5 text-[12px] text-muted leading-[1.5]">
              이번 달 아래 조건을 <b>모두</b> 충족하면 S 위의 S+가 부여돼요 — 하나라도 놓치면 다음 달 S로 돌아가요.
            </p>
            <ul className="mt-3 space-y-2">
              {[
                {
                  ok: bestChannelGrade === "S",
                  label: "채널 최고 등급 S 유지",
                  note: bestChannelGrade === "S" ? "충족하고 있어요" : "채널 등급을 먼저 S로 올려야 해요",
                },
                {
                  ok: thisDemerits + thisAct.rejectedAbandoned === 0,
                  label: "감점 요인 0건 (노쇼·기한 초과·반려)",
                  note:
                    thisDemerits + thisAct.rejectedAbandoned === 0
                      ? "지금까지 0건 — 이대로 유지하세요"
                      : `이미 ${sbNum(SBUI.count, `${thisDemerits + thisAct.rejectedAbandoned}건`)} — 이번 달 S+는 어려워요`,
                },
                {
                  ok: thisDemerits + thisAct.rejectedAbandoned === 0 && ongoingCnt === 0 && thisAct.completed >= 2 ? true : null,
                  label: "모든 체험 완료 + 리뷰 즉시 제출 (완료 2건 이상)",
                  note:
                    ongoingCnt > 0
                      ? `진행 중 ${sbNum(SBUI.count, `${ongoingCnt}건`)} 남음 — 기한 안에 마치고 바로 제출하세요`
                      : thisAct.completed >= 2
                        ? `이번 달 완료 ${sbNum(SBUI.count, `${thisAct.completed}건`)}`
                        : `완료 ${sbNum(SBUI.count, `${thisAct.completed}건`)} — 2건 이상 필요해요`,
                },
                {
                  ok: wFull >= 3 && wPartial === 0 && thisAct.wRatios.length > 0,
                  label: "상생 활동 만점",
                  note: `온전히 반영된 결제 체험 ${sbNum(SBUI.count, `${wFull}건`)} / 3건${wPartial > 0 ? " · 부분 반영이 있어 만점은 아니에요" : ""}`,
                },
              ].map((c) => (
                <li key={c.label} className="flex items-start gap-2.5">
                  <span
                    className={`shrink-0 mt-0.5 w-[18px] h-[18px] rounded-full grid place-items-center text-[11px] font-bold ${
                      c.ok === true ? "bg-successSoft text-successStrong" : c.ok === false ? "bg-errorSoft text-error" : "bg-sunken text-muted"
                    }`}
                    aria-hidden
                  >
                    {c.ok === true ? "✓" : c.ok === false ? "!" : "…"}
                  </span>
                  <span className="min-w-0 text-[12px] leading-[1.5]">
                    <span className="font-semibold text-ink">{c.label}</span>
                    <span className="block text-muted">{c.note}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 pt-3 border-t border-hairlineSoft text-[11px] text-muted leading-[1.5]">
              S+ 혜택: 포인트 적립 +10% · 프로모션 최우선 · 골드 배지. 무리한 결제가 아니라 꾸준하고 성실한 완료가 핵심이에요.
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
          등급은 매월 말 채널 영향력·성실한 완료·상생 활동과 감점 요인을 종합해 재평가됩니다. 변동 폭은 월
          ±1등급이며, 등급은 혜택의 크기에만 영향을 주고 참여 자격을 제한하지 않아요.
        </p>
      </section>
    </div>
  );
}
