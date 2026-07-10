import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import Icon from "@/components/Icon";

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

  // 채널별 분포 — [확정 정책 8·10] 등급별 집계는 사장님에게 비노출(어드민 내부 전용)이라 만들지 않는다
  const byChannel: Record<string, number> = {};
  for (const p of completed) {
    const ch = p.reviewChannel || "naver_blog";
    byChannel[ch] = (byChannel[ch] || 0) + 1;
  }
  const ch_label: any = { naver_blog: "네이버 블로그", instagram: "인스타", tiktok: "틱톡" };

  // ROI: 추정 노출 / 누적 지원
  const cpm = totalSupport > 0 ? Math.round((totalSupport / Math.max(1, totalImpressions)) * 1000) : 0;

  return (
    <div className="pb-24 bg-canvas">
      {/* top-app-bar — 뒤로가기 + 타이틀 */}
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-3 flex items-center">
          <Link href="/o/me" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="더보기로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
          <h1 className="text-[18px] font-bold text-ink tracking-title">성과 리포트</h1>
        </div>
      </div>
      <p className="px-5 pt-1 pb-3 text-[13px] text-muted">최근 30일 · 매장 {myStoreIds.length}곳 누계</p>

      {/* 총 노출 추정 — 화이트 stat 카드 + 퍼플 틴트 막대 */}
      <div className="mx-5 mt-1 rounded-lg border border-hairline bg-canvas p-5">
        <div className="text-[12px] text-muted">총 노출 추정 (30일)</div>
        <div className="mt-1 text-[22px] font-bold text-ink tracking-title tabular-nums">{totalImpressions.toLocaleString()}회</div>
        <div className="mt-3 flex items-end gap-0.5 h-16">
          {dayBuckets.map((v, i) => (
            <div key={i} className="flex-1 bg-brandTint rounded-sm" style={{ height: `${(v / maxBucket) * 100}%`, minHeight: 2 }} />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-muted">
          <span>{days}일 전</span>
          <span>오늘</span>
        </div>
      </div>

      {/* 핵심 지표 */}
      <div className="mx-5 mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-md border border-hairline bg-canvas p-3 text-center">
          <div className="text-[11px] text-muted">작성 완료율</div>
          <div className="text-[18px] font-bold text-ink tabular-nums mt-1">{completionRate}%</div>
        </div>
        <div className="rounded-md border border-hairline bg-canvas p-3 text-center">
          <div className="text-[11px] text-muted">광고표시 준수</div>
          <div className="text-[18px] font-bold text-ink tabular-nums mt-1">{adComplyRate}%</div>
        </div>
        <div className="rounded-md border border-hairline bg-canvas p-3 text-center">
          <div className="text-[11px] text-muted">평균 본문 길이</div>
          <div className="text-[18px] font-bold text-ink tabular-nums mt-1">{avgLen}자</div>
        </div>
      </div>

      {/* CPM */}
      <div className="mx-5 mt-3 rounded-lg border border-hairline bg-canvas p-4">
        <div className="text-[14px] font-bold text-ink">CPM (1,000 노출당 비용)</div>
        <div className="mt-1 text-[20px] font-bold text-ink tabular-nums">{cpm.toLocaleString()}원</div>
        <div className="text-[11px] text-muted mt-1 tabular-nums">총 지원 {totalSupport.toLocaleString()}원 / 추정 노출 {totalImpressions.toLocaleString()}회</div>
      </div>

      {/* 채널별 */}
      <h2 className="px-5 mt-7 text-[18px] font-bold text-ink tracking-title">채널별 분포</h2>
      <div className="px-5 mt-3 space-y-2">
        {Object.entries(byChannel).map(([ch, n]) => (
          <div key={ch} className="flex items-center justify-between rounded-md border border-hairline bg-canvas px-3 py-2.5">
            <div className="text-[13px] text-ink">{ch_label[ch] || ch}</div>
            <div className="text-[13px] font-semibold text-ink tabular-nums">{n}건</div>
          </div>
        ))}
        {Object.keys(byChannel).length === 0 && (
          <div className="text-[13px] text-muted text-center py-4">완료된 리뷰가 없습니다</div>
        )}
      </div>

      {/* [확정 정책 8·10] 등급별 ROI 섹션 제거 — 체험자 등급 데이터는 사장님 비노출(어드민 내부 전용) */}

      <p className="px-5 mt-6 text-[11px] text-muted leading-relaxed">
        * 노출 추정은 리뷰어의 SNS 영향력 × 30% 도달율로 단순화한 값으로, 실제 노출과 차이가 있을 수 있습니다.
      </p>
    </div>
  );
}
