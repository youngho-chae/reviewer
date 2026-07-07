import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { SBUI } from "@/lib/storyboard";
import { SUPPORT_MULTIPLIER } from "@/lib/grade";
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

const TIER_REQUIRE: Record<Grade, string> = {
  S: "운영팀 부여 영역 (자동 진입 불가)",
  A: "SNS 영향력 가중 합산 50,000 이상",
  B: "SNS 영향력 가중 합산 10,000 이상",
  C: "SNS 영향력 가중 합산 1,000 이상",
  N: "SNS 1개 이상 연동 시 자동 산정",
};

const THRESHOLDS: Record<Grade, { next: Grade; needReviews: number }> = {
  N: { next: "C", needReviews: 1 },
  C: { next: "B", needReviews: 5 },
  B: { next: "A", needReviews: 15 },
  A: { next: "S", needReviews: 30 },
  S: { next: "S", needReviews: 0 },
};

export default async function ReviewerGrade() {
  const me = await getCurrentReviewer();
  const db = await getDBAsync();

  // 등급 진행도 (진행도 바는 구조 표현이므로 실제 비율 유지)
  const myPasses = db.passes.filter((p) => p.reviewerId === me.id);
  const completed = myPasses.filter((p) => p.status === "completed").length;
  const t = THRESHOLDS[me.grade];
  const progress = t.needReviews > 0 ? Math.min(100, Math.round((completed / t.needReviews) * 100)) : 100;

  // 30일 성과 지표 — val은 스토리보드에서 노출하지 않고 단위(타입)만 사용
  const metrics = [
    { name: "완료율", unit: "%", invert: false },
    { name: "리뷰 품질 점수", unit: "점", invert: false },
    { name: "광고표시 준수율", unit: "%", invert: false },
    { name: "노쇼율", unit: "%", invert: true },
  ];

  const unread = db.notifications.filter((n) => n.role === "reviewer" && n.userId === me.id && !n.read).length;

  return (
    <div className="pb-24 bg-canvas">
      {/* Sub-nav */}
      <div className="sticky top-0 z-30 frosted-parchment border-b border-hairlineSoft">
        <div className="h-13 px-5 flex items-center justify-between">
          <h1 className="text-[15px] font-semibold text-ink">등급</h1>
          <Link
            href="/r/notifications"
            className="cp-action relative w-9 h-9 rounded-full flex items-center justify-center text-ink"
            aria-label="알림"
          >
            <Icon name="bell" variant={unread > 0 ? "bold" : "border"} size={22} />
            {unread > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand" />}
          </Link>
        </div>
      </div>

      {/* Parchment hero — 큰 등급 배지 + 다음 등급 진행도 (기존 유지) */}
      <section className="bg-parchment px-6 pt-12 pb-12 text-center">
        <div className="flex justify-center mb-5">
          <GradeBadge grade={me.grade} size="xl" />
        </div>
        <h1 className="font-display text-[56px] leading-[1.07] tracking-[-0.026em] text-ink">
          {me.grade}등급
        </h1>
        <p className="mt-3 text-[19px] text-ink2 leading-[1.4]">{TIER_COPY[me.grade].desc}</p>

        {me.grade !== "S" && (
          <div className="mt-8 max-w-[300px] mx-auto">
            <div className="flex justify-between text-[13px] text-muted mb-2">
              <span>다음 등급까지</span>
              <span className="text-ink font-medium">{t.next} · {progress}%</span>
            </div>
            <div className="h-1 bg-hairline rounded-pill overflow-hidden">
              <div className="h-full bg-brand rounded-pill transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 text-[12px] text-muted">
              완료 리뷰 {Math.max(0, t.needReviews - completed)}건이면 승급
            </div>
          </div>
        )}
      </section>

      {/* 채널별 등급 — 연동 채널을 독립 평가 (v2.16) */}
      <section className="px-5 mt-5">
        <h2 className="text-[15px] font-semibold text-ink mb-2">채널별 등급</h2>
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

      {/* 3-stat 카드 — 기존 혜택 탭에서 이동 (v2.9) */}
      <section className="px-5 mt-5">
        <div className="rounded-2xl bg-ink text-white p-5 shadow-card">
          <div className="text-[11px] uppercase tracking-[0.14em] text-white/70">내 등급으로 받는 혜택</div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[13px] font-semibold leading-tight">{SBUI.count}</div>
              <div className="text-[10px] text-white/70 mt-1.5">진행 중인 체험</div>
            </div>
            <div className="border-l border-r border-white/10">
              <div className="text-[13px] font-semibold leading-tight">{SBUI.support}</div>
              <div className="text-[10px] text-white/70 mt-1.5">내 최대 지원금</div>
            </div>
            <div>
              <div className="text-[13px] font-semibold leading-tight">{SBUI.count}</div>
              <div className="text-[10px] text-white/70 mt-1.5">사용 가능 체험권</div>
            </div>
          </div>
        </div>
      </section>

      {/* 내 체험권 entry — 기존 혜택 탭에서 이동 (v2.9) */}
      <section className="px-5 mt-3">
        <Link
          href="/r/passes"
          className="cp-action flex items-center gap-3 p-4 rounded-md border border-hairline bg-canvas"
        >
          <span className="w-10 h-10 rounded-md bg-brand/12 text-brand flex items-center justify-center">
            <Icon name="ticket" variant="bold" size={20} />
          </span>
          <div className="flex-1">
            <div className="text-[14px] font-semibold text-ink">내 체험권</div>
            <div className="text-[11px] text-muted mt-0.5">사용 가능 {SBUI.count} · 작성 대기/완료 포함</div>
          </div>
          <Icon name="chevron-right" variant="border" size={14} className="text-muted" />
        </Link>
      </section>

      {/* 최근 30일 성과 (기존 유지) */}
      <section className="px-6 pt-12 pb-10">
        <h2 className="font-display text-[26px] leading-[1.14] text-ink mb-2 tracking-[-0.022em]">최근 30일 성과</h2>
        <p className="text-[14px] text-ink2 mb-7 leading-[1.47]">목표 지표를 모두 달성하면 다음 등급으로 자동 승급합니다.</p>
        <div className="space-y-5">
          {metrics.map((m, i) => {
            return (
              <div key={i} className="pb-5 border-b border-hairlineSoft last:border-b-0">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[16px] text-ink">{m.name}</span>
                  <span className="text-[14px] font-semibold tracking-[-0.022em] text-ink">
                    {m.unit === "%" ? "비율값" : m.unit === "점" ? "점수값" : "값"}
                  </span>
                </div>
                <div className="text-[12px] text-muted">
                  목표값 · 달성여부
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 등급별 혜택 사다리 — 진입 조건(혜택 탭에서 이동) 통합 (v2.9) */}
      <section className="bg-parchment px-6 py-12">
        <h2 className="font-display text-[26px] leading-[1.14] text-ink mb-6 tracking-[-0.022em]">등급별 혜택</h2>
        <div className="space-y-2.5">
          {BENEFITS.map((b) => {
            const isMe = b.g === me.grade;
            return (
              <div
                key={b.g}
                className={`rounded-lg p-4 flex items-start gap-3 ${isMe ? "bg-canvas border border-ink" : "bg-canvas border border-hairline"}`}
              >
                <GradeBadge grade={b.g} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold text-ink">{TIER_COPY[b.g].label}</span>
                    {isMe && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-pill bg-brand text-white font-semibold">내 등급</span>
                    )}
                  </div>
                  <div className="text-[12px] text-muted mt-1 leading-[1.45]">{b.d}</div>
                  <div className="text-[11px] text-ink2 mt-1.5">진입 조건: {TIER_REQUIRE[b.g]}</div>
                </div>
                <div className="text-[12px] text-ink2 shrink-0 pt-0.5">{b.amt}</div>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-[11px] text-muted leading-[1.5] text-center">
          등급은 완료 리뷰 수, 리뷰 점수, 작성 완료율, 노쇼 빈도, SNS 영향력을 종합해 매월 재계산됩니다.
        </p>
      </section>
    </div>
  );
}
