import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";

export const dynamic = "force-dynamic";

// SNS 영향력 → 추정 노출 (단순화: 영향력 × 0.3 도달율)
function estimateImpressions(reviewerInfluence: number) {
  return Math.floor(reviewerInfluence * 0.3);
}

export default async function OwnerReport() {
  const me = await getCurrentOwner();
  const db = await getDBAsync();
  const myStoreIds = db.stores.filter((s) => s.ownerId === me.id).map((s) => s.id);
  const completed = db.passes.filter((p) => p.ownerId === me.id && p.status === "completed");

  // 30일 노출 합계 추정
  const now = Date.now();
  const days = 30;
  const dayBuckets: number[] = new Array(days).fill(0);
  let totalImpressions = 0;
  let totalSupport = 0;
  for (const p of completed) {
    const reviewer = db.reviewers.find((r) => r.id === p.reviewerId);
    const inf = reviewer?.sns.reduce((s, x) => s + x.influence, 0) || 0;
    const imp = estimateImpressions(inf);
    totalImpressions += imp;
    totalSupport += p.supportApplied || 0;
    const dayIdx = Math.floor((now - (p.reviewSubmittedAt || p.issuedAt)) / 86400000);
    if (dayIdx >= 0 && dayIdx < days) {
      dayBuckets[days - 1 - dayIdx] += imp;
    }
  }
  const maxBucket = Math.max(1, ...dayBuckets);

  // 광고표시 준수율 — 데모: 등록된 리뷰는 광고표시 체크 박스를 통과한 경우만 등록되므로 100% 가정
  const adComplyRate = 100;
  const avgLen = completed.length
    ? Math.round(completed.reduce((s, p) => s + (p.reviewBody?.length || 0), 0) / completed.length)
    : 0;
  const submittedCount = db.passes.filter((p) =>
    p.ownerId === me.id && ["review_submitted", "completed", "rejected"].includes(p.status)
  ).length;
  const issuedCount = db.passes.filter((p) => p.ownerId === me.id).length;
  const completionRate = issuedCount ? Math.round((submittedCount / issuedCount) * 100) : 0;

  // 채널별 / 등급별 분포
  const byChannel: Record<string, number> = {};
  const byGrade: Record<string, { count: number; support: number }> = {};
  for (const p of completed) {
    const ch = p.reviewChannel || "naver_blog";
    byChannel[ch] = (byChannel[ch] || 0) + 1;
    const g = p.reviewerGrade;
    byGrade[g] = byGrade[g] || { count: 0, support: 0 };
    byGrade[g].count += 1;
    byGrade[g].support += p.supportApplied || 0;
  }
  const ch_label: any = { naver_blog: "네이버 블로그", instagram: "인스타", tiktok: "틱톡" };

  // ROI: 추정 노출 / 누적 지원
  const cpm = totalSupport > 0 ? Math.round((totalSupport / Math.max(1, totalImpressions)) * 1000) : 0;

  return (
    <div className="pb-24">
      <div className="px-5 pt-12 pb-3">
        <Link href="/o/me" className="text-muted text-[14px]">← 더보기</Link>
        <h1 className="mt-3 text-[22px] font-bold">성과 리포트</h1>
        <p className="text-[13px] text-muted mt-1">최근 30일 · 매장 {myStoreIds.length}곳 누계</p>
      </div>

      {/* 총 노출 추정 */}
      <div className="mx-5 mt-4 rounded-md bg-ink text-white p-5">
        <div className="text-[12px] text-white/70">총 노출 추정 (30일)</div>
        <div className="mt-1 text-[28px] font-bold">{totalImpressions.toLocaleString()}회</div>
        <div className="mt-3 flex items-end gap-0.5 h-16">
          {dayBuckets.map((v, i) => (
            <div key={i} className="flex-1 bg-white/60 rounded-sm" style={{ height: `${(v / maxBucket) * 100}%`, minHeight: 2 }} />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-white/60">
          <span>{days}일 전</span>
          <span>오늘</span>
        </div>
      </div>

      {/* 핵심 지표 */}
      <div className="mx-5 mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-md border border-hairline p-3 text-center">
          <div className="text-[11px] text-muted">작성 완료율</div>
          <div className="text-[18px] font-bold mt-1">{completionRate}%</div>
        </div>
        <div className="rounded-md border border-hairline p-3 text-center">
          <div className="text-[11px] text-muted">광고표시 준수</div>
          <div className="text-[18px] font-bold mt-1">{adComplyRate}%</div>
        </div>
        <div className="rounded-md border border-hairline p-3 text-center">
          <div className="text-[11px] text-muted">평균 본문 길이</div>
          <div className="text-[18px] font-bold mt-1">{avgLen}자</div>
        </div>
      </div>

      {/* CPM */}
      <div className="mx-5 mt-4 rounded-md border border-hairline p-4">
        <div className="text-[13px] font-semibold">CPM (1,000 노출당 비용)</div>
        <div className="mt-1 text-[24px] font-bold">₩{cpm.toLocaleString()}</div>
        <div className="text-[11px] text-muted mt-1">총 지원 ₩{totalSupport.toLocaleString()} / 추정 노출 {totalImpressions.toLocaleString()}회</div>
      </div>

      {/* 채널별 */}
      <h2 className="px-5 mt-6 text-[16px] font-bold">채널별 분포</h2>
      <div className="px-5 mt-3 space-y-2">
        {Object.entries(byChannel).map(([ch, n]) => (
          <div key={ch} className="flex items-center justify-between rounded-md border border-hairline px-3 py-2.5">
            <div className="text-[13px]">{ch_label[ch] || ch}</div>
            <div className="text-[13px] font-medium">{n}건</div>
          </div>
        ))}
        {Object.keys(byChannel).length === 0 && (
          <div className="text-[13px] text-muted text-center py-4">완료된 리뷰가 없습니다</div>
        )}
      </div>

      {/* 등급별 ROI */}
      <h2 className="px-5 mt-6 text-[16px] font-bold">등급별 ROI</h2>
      <div className="px-5 mt-3 space-y-2">
        {(["S", "A", "B", "C"] as const).map((g) => {
          const v = byGrade[g];
          if (!v) return null;
          return (
            <div key={g} className="flex items-center justify-between rounded-md border border-hairline px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold w-6 text-center">{g}</span>
                <span className="text-[13px] text-muted">{v.count}건</span>
              </div>
              <div className="text-[13px] font-medium">₩{v.support.toLocaleString()}</div>
            </div>
          );
        })}
        {Object.keys(byGrade).length === 0 && (
          <div className="text-[13px] text-muted text-center py-4">데이터가 없습니다</div>
        )}
      </div>

      <p className="px-5 mt-6 text-[11px] text-muted leading-relaxed">
        * 노출 추정은 리뷰어의 SNS 영향력 × 30% 도달율로 단순화한 값으로, 실제 노출과 차이가 있을 수 있습니다.
      </p>
    </div>
  );
}
