import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import GradeBadge from "@/components/GradeBadge";

export const dynamic = "force-dynamic";

const TIER_COPY: Record<string, { label: string; desc: string }> = {
  S: { label: "S 등급", desc: "상위 5% 리뷰어" },
  A: { label: "A 등급", desc: "검증된 리뷰어" },
  B: { label: "B 등급", desc: "일반 리뷰어" },
  C: { label: "C 등급", desc: "성장 단계" },
  N: { label: "New", desc: "검증 전" },
};

const BENEFITS: { g: string; d: string; amt: string }[] = [
  { g: "S", d: "고지원금 매장 우선 노출", amt: "100% 지원금" },
  { g: "A", d: "인기 매장 노출", amt: "~80% 지원금" },
  { g: "B", d: "기본 체험권 노출", amt: "~60% 지원금" },
  { g: "C", d: "저지원금 체험권부터", amt: "~40% 지원금" },
  { g: "N", d: "웰컴 캠페인만 참여 가능", amt: "10% 지원금" },
];

const THRESHOLDS: Record<string, { next: string; needReviews: number }> = {
  N: { next: "C", needReviews: 1 },
  C: { next: "B", needReviews: 5 },
  B: { next: "A", needReviews: 15 },
  A: { next: "S", needReviews: 30 },
  S: { next: "S", needReviews: 0 },
};

export default async function ReviewerGrade() {
  const me = await getCurrentReviewer();
  const db = await getDBAsync();
  const myPasses = db.passes.filter((p) => p.reviewerId === me.id);
  const completed = myPasses.filter((p) => p.status === "completed").length;
  const submitted = myPasses.filter((p) => ["review_submitted", "completed", "rejected"].includes(p.status)).length;
  const issued = myPasses.length;
  const completionRate = issued ? Math.round((submitted / issued) * 100) : 0;

  const t = THRESHOLDS[me.grade];
  const progress = t.needReviews > 0 ? Math.min(100, Math.round((completed / t.needReviews) * 100)) : 100;

  const metrics = [
    { name: "완료율", val: completionRate, target: 85, unit: "%", invert: false },
    { name: "리뷰 품질 점수", val: me.qualityScore || 0, target: 90, unit: "점", invert: false },
    { name: "광고표시 준수율", val: 100, target: 100, unit: "%", invert: false },
    { name: "노쇼율", val: me.noShowCount, target: 5, unit: "%", invert: true },
  ];

  return (
    <div className="pb-24 bg-canvas">
      {/* Sub-nav */}
      <div className="sticky top-0 z-10 frosted-parchment border-b border-hairlineSoft">
        <div className="h-13 px-5 flex items-center">
          <h1 className="text-[21px] font-semibold text-ink tracking-[-0.011em]">등급</h1>
        </div>
      </div>

      {/* Parchment hero — big grade marker */}
      <section className="bg-parchment px-6 pt-12 pb-14 text-center">
        <div className="flex justify-center mb-5">
          <GradeBadge grade={me.grade} size="xl" />
        </div>
        <h1 className="font-display text-[56px] leading-[1.07] tracking-[-0.026em] text-ink">
          {me.grade}등급
        </h1>
        <p className="mt-3 text-[19px] text-ink2 leading-[1.4]">{TIER_COPY[me.grade].desc}</p>

        {me.grade !== "S" && (
          <div className="mt-10 max-w-[300px] mx-auto">
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

      {/* Light tile — metrics */}
      <section className="bg-canvas px-6 py-14">
        <h2 className="font-display text-[28px] leading-[1.14] text-ink mb-2">최근 30일 성과</h2>
        <p className="text-[15px] text-ink2 mb-8 leading-[1.47]">목표 지표를 모두 달성하면 다음 등급으로 자동 승급합니다.</p>
        <div className="space-y-6">
          {metrics.map((m, i) => {
            const ok = m.invert ? m.val <= m.target : m.val >= m.target;
            return (
              <div key={i} className="pb-6 border-b border-hairlineSoft last:border-b-0">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[17px] text-ink">{m.name}</span>
                  <span className={`text-[19px] font-semibold tracking-[-0.022em] ${ok ? "text-brand" : "text-ink"}`}>
                    {m.val}{m.unit}
                  </span>
                </div>
                <div className="text-[13px] text-muted">
                  목표 {m.invert ? "≤" : "≥"} {m.target}{m.unit} · {ok ? "달성" : "진행 중"}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Parchment tile — ladder */}
      <section className="bg-parchment px-6 py-14">
        <h2 className="font-display text-[28px] leading-[1.14] text-ink mb-8">등급별 혜택</h2>
        <div className="space-y-3">
          {BENEFITS.map((b) => {
            const isMe = b.g === me.grade;
            return (
              <div
                key={b.g}
                className={`rounded-lg p-5 flex items-center gap-4 ${isMe ? "bg-canvas border border-ink" : "bg-canvas border border-hairline"}`}
              >
                <GradeBadge grade={b.g as any} size="md" />
                <div className="flex-1">
                  <div className="text-[17px] font-semibold text-ink">{TIER_COPY[b.g].label}</div>
                  <div className="text-[14px] text-muted mt-0.5">{b.d}</div>
                </div>
                <div className="text-[14px] text-ink2">{b.amt}</div>
              </div>
            );
          })}
        </div>
        <p className="mt-8 text-[12px] text-muted leading-[1.5] text-center">
          등급은 완료 리뷰 수, 리뷰 점수, 작성 완료율, 노쇼 빈도, SNS 영향력을 종합해 매월 재계산됩니다.
        </p>
      </section>
    </div>
  );
}
