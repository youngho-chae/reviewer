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

  const pending = db.passes
    .filter((p) => p.status === "review_submitted")
    .sort((a, b) => (a.reviewSubmittedAt ?? 0) - (b.reviewSubmittedAt ?? 0)); // 오래된 것 우선

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
      {/* 상단 통계 */}
      <section className="px-5 pt-6">
        <div className="rounded-2xl bg-ink text-white p-5">
          <div className="text-[12px] text-white/70">검수 대기</div>
          <div className="font-display text-[40px] leading-none mt-1">{pending.length}건</div>
          <div className="text-[12px] text-white/70 mt-2">최근 7일 처리 {processedToday}건</div>
        </div>
      </section>

      <section className="px-5 mt-5 space-y-3">
        {rows.length === 0 && (
          <div className="rounded-md border border-dashed border-hairline p-10 text-center text-[14px] text-muted">
            검수 대기 중인 후기가 없습니다.
          </div>
        )}
        {rows.map(({ p, store, campaign, reviewer }) => (
          <div key={p.id} className="rounded-md border border-hairline bg-canvas p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GradeBadge grade={p.reviewerGrade} size="sm" />
                <span className="text-[12px] text-muted">익명 #{p.reviewerId.slice(-4)} · {p.reviewerGrade}등급</span>
              </div>
              <span className="text-[11px] text-muted">
                {campaign?.kind === "press" ? "기자단" : "방문형"}
              </span>
            </div>

            <div className="mt-2 text-[15px] font-semibold text-ink">{store?.name}</div>
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
                className="mt-2 inline-block text-[13px] text-brand underline decoration-hairline underline-offset-4 break-all"
              >
                게시물 열기 ↗
              </a>
            )}

            {/* 자가 점검 표시 — 채널별 조건 */}
            {p.reviewSelfCheck && p.reviewChannel && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(CHANNEL_REVIEW_CONDITIONS[p.reviewChannel as SnsKind] ?? []).map((cond) => {
                  const ok = p.reviewSelfCheck?.[cond.key];
                  return (
                    <span
                      key={cond.key}
                      className={`text-[10px] px-2 py-0.5 rounded-pill ${ok ? "bg-success/10 text-success" : "bg-parchment text-muted"}`}
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
