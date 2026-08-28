import Link from "next/link";
import Image from "next/image";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { effectiveChannelState } from "@/lib/sns-cookie";
import { SBUI, sbNum } from "@/lib/storyboard";
import { kstMonthKey, kstMonthEnd, collectMonthlyActivity } from "@/lib/grade-regrade";
import { CHANNEL_ORDER, CHANNEL_LABEL, CHANNEL_ICON_SRC } from "@/lib/channels";
import GradeBadge, { GRADE_TEXT_CLS } from "@/components/GradeBadge";
import WinWinBadge from "@/components/WinWinBadge";
import Icon from "@/components/Icon";
import type { Grade, SnsKind } from "@/lib/types";

export const dynamic = "force-dynamic";

// 내 등급/등급별 혜택 (2026-08-18 와이어프레임 개편 — 구 "다음 달 등급을 올리려면" 카드군 대체)
//  · 히어로 = "{닉네임} 님의 이번달 등급은 {등급} 입니다." + 우측 대형 배지(도형·색 방침) +
//    재평가 원칙 문단(P1 카피 — 참여 자격 미제한)
//  · 다음 달 등급을 위한 활동(이번 달 기준): ①성실하게 리뷰 작성하기(작성 대기/기한 초과/반려/완료)
//    ②상생 활동 채우기(결제 체험·진행도 3칸 게이지) ③상생 리뷰어 뱃지 카드 ④채널 영향력 키우기
//  · 등급별 혜택 리스트 — 대형 배지 + 등급 고유색 + 진입 조건 (산식 수치는 계속 비노출 §10)
// [P1] 등급은 참여 자격이 아니라 혜택 크기만 — 잠금/오버레이 표현 금지.

// 등급별 혜택 — 혜택 줄 + (있으면) 추가 칩 + 진입 조건 목록
const TIERS: { g: Grade; benefit: string; benefit2?: string; chip?: string; require: string[] }[] = [
  {
    g: "S+",
    benefit: "기준 지원금의 100%",
    chip: "프로모션 최우선",
    require: ["S 등급", "한 달 동안 성실 이행", "상생 활동 모두 만점", "감점 요인 0건"],
  },
  { g: "S", benefit: "기준 지원금의 100%", require: ["최상위 채널 영향력", "꾸준하고 성실한 체험 완료"] },
  { g: "A", benefit: "기준 지원금의 80%", require: ["높은 채널 영향력", "꾸준하고 성실한 체험 완료"] },
  { g: "B", benefit: "기준 지원금의 60%", require: ["안정적인 채널 영향력과 활동 유지"] },
  { g: "C", benefit: "기준 지원금의 40%", require: ["채널을 연동하고 활동을 시작하는 단계"] },
  {
    g: "N",
    benefit: "결제 금액의 10%",
    benefit2: "영수증 리뷰",
    // 2026-08-18 문구 정정 — N은 "연동 조건"이 아니라 "채널 미연동 상태" 자체
    require: ["채널이 연동되지 않은 상태 (연동하면 바로 C 등급부터 시작)"],
  },
];

export default async function ReviewerGrade() {
  const me = await getCurrentReviewer();
  const db = await getDBAsync();
  // 인스턴스 불일치 스톱갭 — 연동/해제 직후 본인 시점 최신 채널·표기 등급 (sns-cookie.ts)
  const eff = await effectiveChannelState(me);

  // 이번 달(평가 대상월) 실측 — 집계는 재평가 스윕과 동일 정본(collectMonthlyActivity)
  const thisMonth = kstMonthKey(Date.now());
  const monthNum = Number(thisMonth.slice(5));
  const lastDay = new Date(kstMonthEnd(thisMonth) + 9 * 60 * 60 * 1000).getUTCDate();
  const thisAct = collectMonthlyActivity(db, me.id, thisMonth);
  // 상생 만점 표본 = 지원금의 2배 이상 결제(r≥1, 스윕과 동일 캡) — 3건부터 온전히 반영
  const wFull = Math.min(thisAct.wRatios.filter((r) => r >= 1).length, 3);
  const wPartial = thisAct.wRatios.length - thisAct.wRatios.filter((r) => r >= 1).length;

  const myPasses = db.passes.filter((p) => p.reviewerId === me.id);
  const reviewWaitCnt = myPasses.filter((p) => p.status === "used").length; // 작성 대기
  const resubmitWaitCnt = myPasses.filter((p) => p.status === "rejected").length; // 반려 (재제출 대기)

  return (
    <div className="pb-24 bg-canvas">
      {/* top-app-bar — 뒤로가기 + 중앙 타이틀 (와이어프레임) */}
      <div className="sticky top-0 z-30 bg-canvas">
        <div className="h-[52px] px-3 grid grid-cols-[40px_1fr_40px] items-center">
          <Link href="/r/me" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="마이로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
          <h1 className="text-[16px] font-bold text-ink tracking-title text-center">내 등급/등급별 혜택</h1>
          <span />
        </div>
      </div>

      {/* 히어로 — 문장형 + 우측 대형 배지 */}
      <section className="px-5 pt-4">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-[19px] font-bold text-ink tracking-title leading-[1.45]">
            {me.nickname} 님의 이번달 등급은
            <br />
            <span className={GRADE_TEXT_CLS[eff.grade]}>{eff.grade}등급</span> 입니다.
          </h2>
          <GradeBadge grade={eff.grade} size="xl" />
        </div>
        {/* 재평가 원칙 — P1 카피 (참여 자격 미제한) */}
        <p className="mt-3 text-[12px] text-muted leading-[1.6]">
          등급은 매월 말 채널 영향력·성실한 완료·상생 활동과 감점 요인을 종합해 재평가됩니다. 변동 폭은 월 ±1등급이며,
          등급은 혜택의 크기에만 영향을 주고 참여 자격을 제한하지 않아요.
        </p>
      </section>

      {/* 다음 달 등급을 위한 활동 — 이번 달 실측 (산식 수치 비노출 — 건수·진행도만) */}
      <section className="px-5 mt-7">
        <h2 className="text-[17px] font-bold text-ink tracking-title">다음 달 등급을 위한 활동</h2>
        <p className="mt-1 text-[13px] font-semibold text-brand tabular-nums">
          {monthNum}월 1일 ~ {monthNum}월 {lastDay}일 활동 기준
        </p>

        <div className="mt-3 space-y-3">
          {/* ① 성실하게 리뷰 작성하기 */}
          <Link href="/r/passes?tab=review" className="cp-action block rounded-lg border border-hairline bg-canvas p-4">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold text-ink">성실하게 리뷰 작성하기</span>
              <Icon name="chevron-right" variant="border" size={16} className="text-mutedSoft" />
            </div>
            <div className="mt-3 space-y-2.5">
              {(
                [
                  { label: "작성 대기", n: reviewWaitCnt, warn: false },
                  { label: "기한 초과", n: thisAct.overdue, warn: true },
                  { label: "반려", n: resubmitWaitCnt, warn: true },
                  { label: "완료", n: thisAct.completed, warn: false },
                ] as const
              ).map((r) => (
                <div key={r.label} className="flex items-center justify-between text-[14px]">
                  <span className="text-ink2">{r.label}</span>
                  <span className={`font-bold tabular-nums ${r.warn && r.n > 0 ? "text-error" : "text-ink"}`}>
                    {sbNum(SBUI.count, `${r.n}`)}
                  </span>
                </div>
              ))}
            </div>
          </Link>

          {/* ② 상생 활동 채우기 — 3칸 진행도 게이지 */}
          <div className="rounded-lg border border-hairline bg-canvas p-4">
            <div className="text-[15px] font-bold text-ink">
              상생 활동 채우기{" "}
              <span className="inline-flex w-[18px] h-[18px] rounded-full border border-hairline text-[11px] text-muted items-center justify-center align-middle" aria-hidden>
                ?
              </span>
            </div>
            <p className="mt-1.5 text-[12px] text-muted leading-[1.55]">
              추가 결제 할수록 상생 활동이 쌓여요.
              <br />
              3칸을 모두 채우면 다음 달 상생 리뷰어 뱃지를 획득할 수 있어요.
            </p>
            <div className="mt-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-[14px]">
                <span className="text-ink2">이번 달 결제한 체험</span>
                <span className="font-bold text-ink tabular-nums">{sbNum(SBUI.count, `${thisAct.wRatios.length}`)}</span>
              </div>
              <div className="flex items-center justify-between text-[14px]">
                <span className="text-ink2">상생 활동</span>
                <span className="font-bold text-ink tabular-nums">{wFull}/3</span>
              </div>
            </div>
            {/* 3분할 게이지 — 완료(퍼플)/진행중(틴트 — 부분 반영 결제 존재)/대기중(회색) */}
            <div className="mt-2.5 flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`flex-1 h-2.5 rounded-pill ${
                    i < wFull ? "bg-brand" : i === wFull && wPartial > 0 ? "bg-brandTint" : "bg-sunken"
                  }`}
                />
              ))}
            </div>
            <div className="mt-1.5 flex text-[11px] text-muted">
              <span className="flex-1 text-center">완료</span>
              <span className="flex-1 text-center">진행중</span>
              <span className="flex-1 text-center">대기중</span>
            </div>
            {/* 반영 기준 — 소비 유도 금지 (사실 안내만, 기준값은 스윕 공식과 동일) */}
            <details className="mt-2.5">
              <summary className="cp-action list-none cursor-pointer text-[12px] font-semibold text-muted">
                반영 기준 자세히 보기 ⌄
              </summary>
              <p className="mt-1.5 text-[12px] text-muted leading-[1.55]">
                결제 금액이 지원금의 2배를 넘으면 한 칸이 채워져요(리뷰 완료 건만 집계 · 지원금을 넘는 결제는 부분
                반영). 무리해서 결제할 필요는 없어요 — 실제로 이용한 만큼만, 꾸준히 쌓이는 게 중요해요.
              </p>
            </details>
          </div>

          {/* ③ 상생 리뷰어 뱃지 */}
          <div className="rounded-lg border border-hairline bg-canvas p-4">
            <div className="flex items-center justify-between gap-2">
              {/* winwin.png = 텍스트 포함 pill 일체형 (2026-08-18) */}
              <WinWinBadge size={28} />
              <span
                className={`shrink-0 text-[11px] px-2 py-1 rounded-pill font-semibold ${
                  me.winWinBadge ? "bg-successSoft text-successStrong" : "bg-sunken text-muted"
                }`}
              >
                {me.winWinBadge ? "보유 중" : "지난달 뱃지 미획득"}
              </span>
            </div>
            <p className="mt-2.5 text-[12px] text-ink2 leading-[1.6]">
              한 달 동안 상생 활동을 3칸 이상 완료하면 받을 수 있는 특별 뱃지예요. 프로모션이 있을 때 우선 지급 대상이
              돼요.
              <br />
              지원금과 참여 조건에는 영향을 주지 않아요.
            </p>
          </div>

          {/* ④ 채널 영향력 키우기 */}
          <Link href="/r/me/channels" className="cp-action block rounded-lg border border-hairline bg-canvas p-4">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold text-ink">채널 영향력 키우기</span>
              <Icon name="chevron-right" variant="border" size={16} className="text-mutedSoft" />
            </div>
            <p className="mt-1.5 text-[12px] text-muted leading-[1.5]">블로그 방문자·팔로워가 늘면 채널별 등급도 함께 올라가요.</p>
            <div className="mt-3 space-y-3">
              {CHANNEL_ORDER.map((ch: SnsKind) => {
                const g = eff.channelGrades[ch];
                return (
                  <div key={ch} className="flex items-center gap-2.5">
                    <Image src={CHANNEL_ICON_SRC[ch]} alt={CHANNEL_LABEL[ch]} width={24} height={24} className="shrink-0 rounded-[6px]" />
                    <span className="flex-1 text-[14px] text-ink">{CHANNEL_LABEL[ch]}</span>
                    {g ? (
                      <span className={`text-[13px] font-bold ${GRADE_TEXT_CLS[g as Grade]}`}>{g}등급</span>
                    ) : (
                      <span className="text-[11px] px-2 py-1 rounded-pill bg-sunken text-mutedSoft font-semibold">연동 필요</span>
                    )}
                  </div>
                );
              })}
            </div>
          </Link>
        </div>
      </section>

      {/* 등급별 혜택 — 도형 배지 + 등급 고유색 + 진입 조건 (산식 수치 비노출) */}
      <section className="px-5 pt-9 pb-10">
        <h2 className="text-[17px] font-bold text-ink tracking-title mb-4">등급별 혜택</h2>
        <div className="space-y-6">
          {TIERS.map((t) => {
            const isMe = t.g === eff.grade;
            return (
              <div key={t.g} className="flex items-start gap-4">
                <GradeBadge grade={t.g} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[16px] font-bold ${GRADE_TEXT_CLS[t.g]}`}>{t.g} 등급</span>
                    {isMe && (
                      <span className="text-[11px] px-2 py-0.5 rounded-pill bg-brandSoft text-brand font-semibold">현재 등급</span>
                    )}
                  </div>
                  <div className="mt-1 text-[14px] font-semibold text-ink">{t.benefit}</div>
                  {t.benefit2 && <div className="text-[13px] text-ink2">{t.benefit2}</div>}
                  {t.chip && (
                    <span className="mt-1.5 inline-flex text-[11px] px-2 py-0.5 rounded-pill bg-brandSoft text-brand font-semibold">
                      {t.chip}
                    </span>
                  )}
                  <div className="mt-2 text-[12px] text-muted">진입 조건</div>
                  <div className="mt-0.5 space-y-0.5">
                    {t.require.map((r) => (
                      <div key={r} className="text-[12px] text-ink2 leading-[1.5]">{r}</div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
