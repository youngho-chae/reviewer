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

const TIERS = ["N", "C", "B", "A", "S"];

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
    <div className="pb-24">
      <div className="px-5 pt-12 pb-6">
        <h1 className="text-[28px] font-extrabold tracking-tight">내 등급</h1>
        <p className="text-[14px] text-muted mt-1.5">등급이 오를수록 더 좋은 체험권을 받을 수 있어요.</p>
      </div>

      {/* 큰 등급 마커 */}
      <div className="mx-5 p-7 rounded-lg bg-ink text-white relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[12px] text-white/60">현재 등급</div>
            <div
              className="text-[56px] font-extrabold leading-none mt-1.5 mb-1"
              style={{ fontFamily: '"Times New Roman", "Noto Serif KR", Georgia, serif' }}
            >
              {me.grade}
            </div>
            <div className="text-[14px] font-semibold">{TIER_COPY[me.grade].label}</div>
          </div>
          <GradeBadge grade={me.grade} size="xl" inverted />
        </div>

        {me.grade !== "S" && (
          <div className="mt-6 p-3.5 bg-white/[0.07] rounded-md">
            <div className="flex justify-between text-[12px] mb-2">
              <span className="text-white/70">다음 등급까지</span>
              <span className="font-bold">{t.next}등급 · {progress}% 달성</span>
            </div>
            <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 text-[11px] text-white/55">
              완료 리뷰 {Math.max(0, t.needReviews - completed)}건 더 작성하면 승급
            </div>
          </div>
        )}
      </div>

      {/* 4지표 */}
      <div className="px-5 mt-6">
        <h3 className="text-[16px] font-bold tracking-tight mb-3">최근 30일 성과</h3>
        <div className="rounded-md border border-hairline overflow-hidden">
          {metrics.map((m, i) => {
            const ok = m.invert ? m.val <= m.target : m.val >= m.target;
            return (
              <div key={i} className={`px-4 py-4 ${i < metrics.length - 1 ? "border-b border-hairline" : ""}`}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[14px] font-semibold">{m.name}</span>
                  <span className={`text-[16px] font-bold ${ok ? "text-success" : "text-error"}`}>
                    {m.val}{m.unit}
                  </span>
                </div>
                <div className="text-[11px] text-muted mt-1">
                  목표 {m.invert ? "≤" : "≥"} {m.target}{m.unit} · {ok ? "달성" : "미달"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 등급 사다리 */}
      <div className="px-5 mt-6">
        <h3 className="text-[16px] font-bold tracking-tight mb-3">등급별 혜택</h3>
        <div className="space-y-2.5">
          {BENEFITS.map((b) => {
            const isMe = b.g === me.grade;
            return (
              <div
                key={b.g}
                className={`p-4 rounded-md flex items-center gap-3.5 ${isMe ? "bg-ink text-white border border-ink" : "bg-white border border-hairline"}`}
              >
                <GradeBadge grade={b.g as any} size="md" inverted={isMe} />
                <div className="flex-1">
                  <div className="text-[14px] font-bold">{TIER_COPY[b.g].label}</div>
                  <div className={`text-[12px] mt-0.5 ${isMe ? "text-white/65" : "text-muted"}`}>{b.d}</div>
                </div>
                <div className="text-[13px] font-bold">{b.amt}</div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="px-5 mt-6 text-[11px] text-muted leading-relaxed">
        * 등급은 완료 리뷰 수, 리뷰 점수, 작성 완료율, 노쇼 빈도, SNS 영향력을 종합해 매월 재계산됩니다.
      </p>
    </div>
  );
}
