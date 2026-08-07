import { getCurrentAdmin } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import GradeBadge from "@/components/GradeBadge";
import { CHANNEL_LABEL, CHANNEL_REVIEW_CONDITIONS } from "@/lib/channels";
import type { SnsKind } from "@/lib/types";
import ReviewDecisionActions from "./ReviewDecisionActions";

export const dynamic = "force-dynamic";

const CH_LABEL: Record<string, string> = CHANNEL_LABEL;

export default async function AdminReviews() {
  await getCurrentAdmin(); // 인증 게이트
  const db = await getDBAsync();

  // S+ 혜택 ④ 검수 우선 처리 (2026-08-06 §10.6) — S+ 계정의 제출 건을 큐 상단으로.
  // 검수 기준·주체는 동일(P3) — 처리 순서(운영 SLA)만 우대. 그 안에서는 오래된 것 우선.
  const splusFirst = (rid: string) => (db.reviewers.find((r) => r.id === rid)?.grade === "S+" ? 0 : 1);
  const pending = db.passes
    .filter((p) => p.status === "review_submitted")
    .sort(
      (a, b) =>
        splusFirst(a.reviewerId) - splusFirst(b.reviewerId) ||
        (a.reviewSubmittedAt ?? 0) - (b.reviewSubmittedAt ?? 0),
    );

  const processedToday = db.passes.filter(
    (p) =>
      (p.status === "completed" || p.status === "rejected") &&
      (p.reviewSubmittedAt ?? 0) > Date.now() - 7 * 86400000,
  ).length;

  const rows = pending.map((p) => {
    const store = db.stores.find((s) => s.id === p.storeId);
    const campaign = db.campaigns.find((c) => c.id === p.campaignId);
    const reviewer = db.reviewers.find((r) => r.id === p.reviewerId);
    return { p, store, campaign, reviewer };
  });

  return (
    <div className="pb-24">
      {/* 상단 통계 — 화이트 stat 카드 */}
      <section className="px-5 pt-5">
        <div className="rounded-lg border border-hairline bg-canvas p-5">
          <div className="text-[12px] text-muted">검수 대기</div>
          <div className="text-[22px] font-bold text-ink tracking-title tabular-nums mt-1">{pending.length}건</div>
          <div className="text-[12px] text-muted mt-2 tabular-nums">최근 7일 처리 {processedToday}건</div>
        </div>
      </section>

      <section className="px-5 mt-5 space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start">
        {rows.length === 0 && (
          <div className="rounded-md border border-dashed border-hairline p-10 text-center text-[14px] text-muted">
            검수 대기 중인 리뷰가 없습니다.
          </div>
        )}
        {rows.map(({ p, store, campaign, reviewer }) => (
          <div key={p.id} className="rounded-lg border border-hairline bg-canvas p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GradeBadge grade={p.reviewerGrade} size="sm" />
                {/* [2026-07-31 §3-3] 운영팀 콘솔은 개별 건 구분을 위해 회원명(가입자 정보)을 노출한다
                    — 익명 표기는 사장님 화면 전용 정책 */}
                <span className="text-[12px] text-ink font-semibold">{reviewer?.nickname ?? "(탈퇴 회원)"}</span>
                <span className="text-[12px] text-muted">· {p.reviewerGrade}등급</span>
                {reviewer?.grade === "S+" && (
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-pill bg-gradeSplus text-white">S+ 우선</span>
                )}
              </div>
              <span className="text-[11px] text-muted">
                {campaign?.kind === "delivery" ? "배송형" : "방문형"}
              </span>
            </div>

            <div className="mt-2 text-[16px] font-bold text-ink">{store?.name}</div>
            <div className="text-[12px] text-muted mt-0.5">
              {campaign?.title} · {p.reviewChannel ? CH_LABEL[p.reviewChannel] ?? p.reviewChannel : "채널 미상"}
              {p.reviewSubmittedAt
                ? ` · ${new Date(p.reviewSubmittedAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} 제출`
                : ""}
            </div>

            {p.reviewUrl && (
              <a
                href={p.reviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="cp-action mt-2 inline-block text-[13px] font-semibold text-brand break-all"
              >
                게시물 열기 ↗
              </a>
            )}

            {/* 검수 기준 보조 (확정 정책 11) — 사장님이 입력한 강조 키워드 포함 여부를 수기 확인 */}
            {campaign?.highlightKeywords && campaign.highlightKeywords.length > 0 && (
              <div className="mt-2">
                <div className="text-[11px] text-muted mb-1">강조 키워드 포함 확인</div>
                <div className="flex flex-wrap gap-1.5">
                  {campaign.highlightKeywords.map((kw, i) => (
                    <span key={`${kw}-${i}`} className="text-[11px] font-medium px-2 py-0.5 rounded-pill bg-brandSoft text-brand">
                      #{kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 자가 점검 표시 — 채널별 조건 */}
            {p.reviewSelfCheck && p.reviewChannel && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(CHANNEL_REVIEW_CONDITIONS[p.reviewChannel as SnsKind] ?? []).map((cond) => {
                  const ok = p.reviewSelfCheck?.[cond.key];
                  return (
                    <span
                      key={cond.key}
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-pill ${ok ? "bg-successSoft text-successStrong" : "bg-sunken text-muted"}`}
                    >
                      {ok ? "✓" : "—"} {cond.label}
                    </span>
                  );
                })}
              </div>
            )}

            <ReviewDecisionActions passId={p.id} />
          </div>
        ))}
      </section>
    </div>
  );
}
