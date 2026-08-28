import { getCurrentAdmin } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import GradeBadge from "@/components/GradeBadge";
import WinWinBadge from "@/components/WinWinBadge";
import { CHANNEL_SHORT } from "@/lib/channels";
import type { SnsKind } from "@/lib/types";

export const dynamic = "force-dynamic";

// 회원(체험자) 관리 (확정 정책 12) — 등급·재평가 이력·작성 리뷰 조회.
// 등급·GS 등 내부 데이터는 어드민 전용 노출이다 (사장님 화면 비노출 원칙과 쌍).
export default async function AdminMembers() {
  await getCurrentAdmin();
  const db = await getDBAsync();

  const rows = [...db.reviewers]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((rv) => {
      const summaries = (rv.gradeHistory ?? []).filter((h) => !h.channel);
      const latest = summaries.length > 0 ? summaries[summaries.length - 1] : null;
      const reviews = db.passes
        .filter((p) => p.reviewerId === rv.id && p.reviewUrl)
        .sort((a, b) => (b.reviewSubmittedAt ?? 0) - (a.reviewSubmittedAt ?? 0));
      return { rv, latest, reviews };
    });

  return (
    <div className="pb-24">
      <section className="px-5 pt-5">
        <div className="rounded-lg border border-hairline bg-canvas p-5">
          <div className="text-[12px] text-muted">체험자 회원</div>
          <div className="text-[22px] font-bold text-ink tracking-title tabular-nums mt-1">{rows.length}명</div>
          <div className="text-[12px] text-muted mt-2">등급·재평가 이력·작성 리뷰는 내부 관리 전용 (사장님 비노출)</div>
        </div>
      </section>

      <section className="px-5 mt-5 space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start">
        {rows.map(({ rv, latest, reviews }) => (
          <details key={rv.id} className="rounded-lg border border-hairline bg-canvas p-4">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <GradeBadge grade={rv.grade} size="sm" />
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-ink truncate">
                      {rv.nickname}
                      {rv.winWinBadge && <WinWinBadge size={18} className="ml-1.5 align-middle" />}
                    </div>
                    {/* [2026-07-31 §3-3] 운영상 개별 건 구분을 위해 관리자 화면은 가입자 식별정보(이메일·휴대폰)를 노출한다 */}
                    <div className="text-[11px] text-muted truncate tabular-nums">
                      {rv.email}
                      {rv.phone && <> · {rv.phone.replace(/(\d{3})(\d{3,4})(\d{4})/, "$1-$2-$3")}</>}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 text-[11px] text-muted tabular-nums">
                  완료 {rv.completedReviews} · 노쇼 {rv.noShowCount}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                {Object.entries(rv.channelGrades ?? {}).map(([ch, g]) => (
                  <span key={ch} className="px-2 py-0.5 rounded-pill bg-sunken">
                    {CHANNEL_SHORT[ch as SnsKind]} {g}
                  </span>
                ))}
                {latest && !latest.skipped && (
                  <span className="px-2 py-0.5 rounded-pill bg-brandSoft text-brand font-semibold tabular-nums">
                    GS {latest.breakdown.GS}점
                  </span>
                )}
              </div>
            </summary>

            {/* 재평가 이력 */}
            {(rv.gradeHistory ?? []).filter((h) => !h.channel).length > 0 && (
              <div className="mt-3 pt-3 border-t border-hairlineSoft">
                <div className="text-[11px] font-semibold text-muted mb-1.5">월간 재평가 이력</div>
                {(rv.gradeHistory ?? [])
                  .filter((h) => !h.channel)
                  .slice(-6)
                  .reverse()
                  .map((h) => (
                    <div key={h.month} className="flex items-center gap-2 py-1 text-[12px] text-ink2 tabular-nums">
                      <span className="text-muted w-[58px]">{h.month.replace("-", ".")}</span>
                      <span>
                        {h.from} → {h.to}
                      </span>
                      <span className="text-muted">
                        {h.skipped
                          ? "활동 없음"
                          : `GS ${h.breakdown.GS} (I ${h.breakdown.I}·F ${h.breakdown.F}·W ${h.breakdown.W}${h.breakdown.P > 0 ? `·P −${h.breakdown.P}` : ""})`}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            {/* 작성 리뷰 */}
            <div className="mt-3 pt-3 border-t border-hairlineSoft">
              <div className="text-[11px] font-semibold text-muted mb-1.5">작성 리뷰 {reviews.length}건</div>
              {reviews.slice(0, 8).map((p) => {
                const store = db.stores.find((s) => s.id === p.storeId);
                return (
                  <div key={p.id} className="flex items-center justify-between gap-2 py-1 text-[12px]">
                    <span className="text-ink2 truncate">{store?.name}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-muted">{p.status}</span>
                      {p.reviewUrl && (
                        <a href={p.reviewUrl} target="_blank" rel="noopener noreferrer" className="cp-action text-brand font-semibold">
                          열기 ↗
                        </a>
                      )}
                    </span>
                  </div>
                );
              })}
              {reviews.length === 0 && <div className="text-[12px] text-muted py-1">작성한 리뷰가 없습니다.</div>}
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
