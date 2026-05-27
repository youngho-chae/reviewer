import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import GradeBadge from "@/components/GradeBadge";

export const dynamic = "force-dynamic";

// 다음 등급까지 진행률 — 단순화: 완료 리뷰 수 기반
const THRESHOLDS: Record<string, { next: string; needReviews: number }> = {
  N: { next: "C", needReviews: 1 },
  C: { next: "B", needReviews: 5 },
  B: { next: "A", needReviews: 15 },
  A: { next: "S", needReviews: 30 },
  S: { next: "S", needReviews: 0 },
};

const BENEFITS: { grade: string; benefit: string }[] = [
  { grade: "S", benefit: "프리미엄 매장 + 최대 지원금 + 기자단 우선" },
  { grade: "A", benefit: "고급 다이닝 + 기자단 자료팩 접근" },
  { grade: "B", benefit: "일반 매장 + 평균 지원금" },
  { grade: "C", benefit: "신규 매장 + 기본 지원금" },
  { grade: "N", benefit: "웰컴 캠페인만 노출 (SNS 연동 시 즉시 재산정)" },
];

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

  return (
    <div className="pb-24">
      <div className="px-5 pt-12 pb-3">
        <Link href="/r/me" className="text-muted text-[14px]">← MY</Link>
        <h1 className="mt-3 text-[22px] font-bold">내 등급</h1>
      </div>

      {/* 큰 등급 마커 */}
      <div className="px-5 mt-4">
        <div className="rounded-md bg-ink text-white p-6 text-center shadow-card">
          <div className="flex justify-center">
            <GradeBadge grade={me.grade} size="lg" />
          </div>
          <div className="mt-3 text-[28px] font-bold">{me.grade}등급</div>
          <div className="text-[13px] text-white/70 mt-1">{me.nickname}</div>
        </div>
      </div>

      {/* 다음 등급까지 진행률 */}
      {me.grade !== "S" && (
        <div className="mx-5 mt-4 rounded-md border border-hairline p-4">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-medium">다음 등급 {t.next}까지</div>
            <div className="text-[13px] text-muted">{completed} / {t.needReviews}</div>
          </div>
          <div className="mt-2 h-2 bg-surfaceSoft rounded-full overflow-hidden">
            <div className="h-full bg-ink" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-muted">완료 리뷰 {Math.max(0, t.needReviews - completed)}건 더 작성하면 승급</div>
        </div>
      )}

      {/* 4지표 */}
      <h2 className="px-5 mt-6 text-[16px] font-bold">내 4지표</h2>
      <div className="mx-5 mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-md border border-hairline p-4">
          <div className="text-[11px] text-muted">완료 리뷰</div>
          <div className="text-[20px] font-bold mt-1">{completed}</div>
        </div>
        <div className="rounded-md border border-hairline p-4">
          <div className="text-[11px] text-muted">리뷰 점수</div>
          <div className="text-[20px] font-bold mt-1">{me.qualityScore || "-"}</div>
        </div>
        <div className="rounded-md border border-hairline p-4">
          <div className="text-[11px] text-muted">작성 완료율</div>
          <div className="text-[20px] font-bold mt-1">{completionRate}%</div>
        </div>
        <div className="rounded-md border border-hairline p-4">
          <div className="text-[11px] text-muted">노쇼</div>
          <div className="text-[20px] font-bold mt-1">{me.noShowCount}</div>
        </div>
      </div>

      {/* 등급 사다리 */}
      <h2 className="px-5 mt-6 text-[16px] font-bold">등급별 혜택</h2>
      <div className="mx-5 mt-3 rounded-md border border-hairline divide-y divide-hairline overflow-hidden">
        {BENEFITS.map((b) => (
          <div key={b.grade} className={`px-4 py-3 flex items-center gap-3 ${b.grade === me.grade ? "bg-surfaceSoft" : ""}`}>
            <GradeBadge grade={b.grade as any} size="sm" />
            <div className="flex-1 text-[13px]">{b.benefit}</div>
            {b.grade === me.grade && <span className="text-[11px] text-ink font-medium">현재</span>}
          </div>
        ))}
      </div>

      <p className="px-5 mt-6 text-[11px] text-muted leading-relaxed">
        * 등급은 완료 리뷰 수, 리뷰 점수, 작성 완료율, 노쇼 빈도, SNS 영향력을 종합해 매월 재계산됩니다.
      </p>
    </div>
  );
}
