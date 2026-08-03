import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import Icon from "@/components/Icon";
import ReviewActions from "./ReviewActions";
import {
  ownerReviewState,
  ownerReviewSummary,
  isReviewOverdue,
  OWNER_REVIEW_LABEL,
  type OwnerReviewState,
} from "@/lib/owner-review-status";
import { reviewDeadline } from "@/lib/pass-lifecycle";

export const dynamic = "force-dynamic";

const ch_label: Record<string, string> = {
  naver_blog: "네이버 블로그",
  instagram: "인스타그램",
  tiktok: "틱톡",
};

// 상태 칩 — *Soft 배경 + 강조 텍스트 (v2 상태 문법, §4-1 상태 정의)
const stateTone: Record<OwnerReviewState, string> = {
  pending: "bg-sunken text-muted",
  reviewing: "bg-warningSoft text-warning",
  done: "bg-successSoft text-successStrong",
  resubmit: "bg-errorSoft text-error",
};

const fmtKst = (t: number) =>
  new Date(t + 9 * 3600000).toISOString().slice(0, 10).replaceAll("-", ".");

// 리뷰 관리 (2026-07-31 개선안 — 구 '후기' 메뉴, 용어 통일 §4-6).
// 모수 = 이용 완료(사용 처리) 체험권 — 작성 대기·검수 중·완료·재작성 요청을 구분해
// 캠페인별 리뷰 작성 현황을 파악할 수 있게 한다 (§4-3).
// [§4-5] 체험자 식별정보(익명 ID 포함) 비노출 — 체험권 번호·이용 일시·매장·상태로 구분.
export default async function OwnerReviews({ searchParams }: { searchParams: Promise<{ st?: string }> }) {
  const { st } = await searchParams;
  const me = await getCurrentOwner();
  const db = await getDBAsync();
  const now = Date.now();

  const all = db.passes
    .filter((p) => p.ownerId === me.id && ownerReviewState(p) !== null)
    .sort((a, b) => (b.reviewSubmittedAt || b.usedAt || 0) - (a.reviewSubmittedAt || a.usedAt || 0));
  const summary = ownerReviewSummary(all);

  const filter: OwnerReviewState | "all" = st === "pending" || st === "reviewing" || st === "done" || st === "resubmit" ? st : "all";
  const passes = filter === "all" ? all : all.filter((p) => ownerReviewState(p) === filter);

  // 상단 요약 — 선택 시 해당 상태만 필터 (§4-3). 재작성 요청은 목록 내 별도 상태로 표시.
  const tiles: Array<{ key: OwnerReviewState; label: string; count: number }> = [
    { key: "pending", label: "작성 대기", count: summary.pending },
    { key: "reviewing", label: "검수 중", count: summary.reviewing },
    { key: "done", label: "완료", count: summary.done },
  ];

  return (
    <div className="pb-24 bg-canvas min-h-[100dvh]">
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-5 flex items-center">
          <h1 className="text-[18px] font-bold text-ink tracking-title">리뷰 관리</h1>
        </div>
      </div>

      <section className="px-5 pt-2">
        <p className="text-[14px] text-ink2 leading-[1.5]">
          이용을 완료한 체험자의 리뷰 현황을 확인할 수 있습니다. 사장님은 직접 검수하지 않으며,
          재작성 요청 등 문제는 채널톡으로 운영팀에 접수해주세요.
        </p>

        {/* 전체 캠페인 요약 — 이용 완료 기준 집계 (§4-1·§4-7) */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {tiles.map((t) => {
            const active = filter === t.key;
            return (
              <Link
                key={t.key}
                href={active ? "/o/reviews" : `/o/reviews?st=${t.key}`}
                className={`cp-action rounded-lg p-4 bg-canvas ${active ? "border-[1.5px] border-brand" : "border border-hairline"}`}
              >
                <div className={`text-[12px] ${active ? "text-brand font-semibold" : "text-muted"}`}>{t.label}</div>
                <div className="text-[20px] font-bold text-ink tabular-nums mt-2 tracking-title">{t.count}건</div>
              </Link>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between text-[12px] text-muted tabular-nums">
          <span>이용 완료 {summary.usedTotal}건 기준</span>
          {summary.resubmit > 0 && (
            <Link href={filter === "resubmit" ? "/o/reviews" : "/o/reviews?st=resubmit"} className={`cp-action font-semibold ${filter === "resubmit" ? "text-brand" : "text-error"}`}>
              재작성 요청 {summary.resubmit}건 →
            </Link>
          )}
        </div>
      </section>

      <section className="px-5 mt-6 space-y-3">
        {passes.map((p) => {
          const store = db.stores.find((s) => s.id === p.storeId);
          const campaign = db.campaigns.find((c) => c.id === p.campaignId);
          const state = ownerReviewState(p)!;
          const overdue = isReviewOverdue(p, now);
          const deadline = reviewDeadline(p);
          return (
            <article key={p.id} className="bg-canvas border border-hairline rounded-lg p-5">
              <div className="flex items-center justify-between gap-2">
                {/* [2026-07-31 보완] 체험권 번호 대신 캠페인명 표기 — 캠페인명은 선택 입력이라
                    미작성(구버전 포함) 캠페인은 매장명으로 폴백 (§4-5 식별정보 비노출은 유지) */}
                <span className="text-[12px] text-muted truncate min-w-0">{campaign?.title || store?.name}</span>
                <span className="flex items-center gap-1.5">
                  {overdue && (
                    <span className="text-[11px] px-2 py-0.5 rounded-pill font-semibold bg-errorSoft text-error">기한 초과</span>
                  )}
                  <span className={`text-[11px] px-2 py-0.5 rounded-pill font-semibold ${stateTone[state]}`}>
                    {OWNER_REVIEW_LABEL[state]}
                  </span>
                </span>
              </div>

              <h3 className="mt-3 text-[16px] font-bold text-ink">{store?.name}</h3>
              <div className="text-[12px] text-muted mt-1 tabular-nums">
                {p.usedAt ? `이용 ${fmtKst(p.usedAt)}` : "이용 일시 미기록"}
                {state === "pending" && deadline != null && <> · 리뷰 기한 {fmtKst(deadline)}</>}
                {state !== "pending" && p.reviewChannel && <> · {ch_label[p.reviewChannel]}</>}
                {p.reviewSubmittedAt && <> · 제출 {fmtKst(p.reviewSubmittedAt)}</>}
              </div>

              {/* 작성 대기 — 독촉 기능 없음 (§4-3), 기한 내/기한 초과 안내 카피 */}
              {state === "pending" && (
                <div className="mt-3 px-3 py-2.5 rounded-md bg-sunken text-[12px] text-muted leading-[1.5]">
                  {overdue
                    ? "리뷰 작성 기한이 지났어요. 운영팀에서 확인 및 안내를 진행합니다."
                    : "체험자가 아직 리뷰를 제출하지 않았어요. 작성 기한 내에는 별도의 조치가 필요하지 않습니다."}
                </div>
              )}

              {state !== "pending" && p.reviewUrl && (
                <a
                  href={p.reviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="cp-action mt-3 flex items-center gap-2 text-[13px] text-brand"
                >
                  <Icon name="arrow-right" variant="border" size={14} />
                  <span className="truncate underline">{p.reviewUrl}</span>
                </a>
              )}

              {state !== "pending" && p.reviewBody && (
                <p className="mt-3 text-[14px] text-ink2 leading-[1.55] line-clamp-3">{p.reviewBody}</p>
              )}

              {state === "reviewing" && (
                <div className="mt-3 px-3 py-2.5 rounded-md bg-sunken text-[12px] text-muted leading-[1.5]">
                  운영팀이 광고 표시·작성 조건을 점검하고 있어요 (영업일 기준 최대 3일). 사장님이 직접
                  검수하실 필요가 없습니다.
                </div>
              )}

              {state === "resubmit" && (
                <div className="mt-3 px-3 py-2.5 rounded-md bg-sunken text-[12px] text-muted leading-[1.5]">
                  운영팀이 리뷰를 반려했어요. 체험자의 수정·재제출을 기다리고 있습니다.
                </div>
              )}

              {state !== "pending" && (
                <ReviewActions passId={p.id} storeName={store?.name} reviewUrl={p.reviewUrl} />
              )}
            </article>
          );
        })}
        {passes.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-[15px] text-muted">
              {filter === "all" ? "아직 리뷰 현황이 없습니다." : "해당 상태의 건이 없습니다."}
            </p>
            <Link href="/o/home" className="cp-action inline-block mt-3 text-[14px] font-semibold text-brand">
              홈으로 돌아가기 →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
