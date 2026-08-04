import Link from "next/link";
import type { Campaign, Pass, Store } from "@/lib/types";
import Icon from "@/components/Icon";
import ChannelIcons from "@/components/ChannelIcons";
import ReviewActions from "./ReviewActions";
import {
  ownerReviewState,
  ownerReviewSummary,
  isReviewOverdue,
  OWNER_REVIEW_LABEL,
  type OwnerReviewState,
} from "@/lib/owner-review-status";
import { reviewDeadline } from "@/lib/pass-lifecycle";

// 상태 칩 (2026-08-04 시안) — 검수중/검수 완료 = 뉴트럴, 반려만 에러 톤
const stateTone: Record<OwnerReviewState, string> = {
  pending: "bg-sunken text-muted",
  reviewing: "bg-sunken text-ink2",
  done: "bg-sunken text-muted",
  resubmit: "bg-errorSoft text-error",
};

const fmtKst = (t: number) =>
  new Date(t + 9 * 3600000).toISOString().slice(0, 10).replaceAll("-", ".");

// 상태 필터 딥링크 — [관리] 병합(2026-08-03)으로 탭 컨텍스트 유지가 필요해 URL 고정
const hrefOf = (st?: OwnerReviewState) => (st ? `/o/manage?tab=reviews&st=${st}` : "/o/manage?tab=reviews");

// 리뷰 관리 (2026-07-31 개선안 · 2026-08-04 시안 개편 — 정본 owner-review-status.ts §4).
// 구성: 인트로 카드(리뷰 모니터링 + [채널톡 문의하기] 단일 진입 — 카드별 문의 버튼 제거) →
// 요약 타일(이용 완료 | 작성 대기·검수중·검수 완료 3분할) → 필터 칩(전체/검수중/검수 완료/반려)
// → 리뷰 카드(캠페인명·상태 칩·채널 파스텔 배지·날짜·[리뷰 보러가기]·본문 3줄·상태 밴드).
// 모수 = 이용 완료 체험권 (§4-1) · [§4-5] 체험자 식별정보 비노출 — 캠페인명(폴백 매장명)으로 구분.
export default function ReviewsPanel({
  passes: all,
  stores,
  campaigns,
  st,
}: {
  passes: Pass[]; // 이용 완료 기준 정렬 완료 목록 (ownerReviewState !== null)
  stores: Store[];
  campaigns: Campaign[];
  st?: string;
}) {
  const now = Date.now();
  const summary = ownerReviewSummary(all);

  const filter: OwnerReviewState | "all" =
    st === "pending" || st === "reviewing" || st === "done" || st === "resubmit" ? st : "all";
  const passes = filter === "all" ? all : all.filter((p) => ownerReviewState(p) === filter);

  // 필터 칩 (시안) — 작성 대기는 칩 없이 전체에서 노출 (구 ?st=pending 딥링크는 계속 동작)
  const chips: Array<{ key: OwnerReviewState | "all"; label: string }> = [
    { key: "all", label: "전체" },
    { key: "reviewing", label: "검수중" },
    { key: "done", label: "검수 완료" },
    { key: "resubmit", label: "반려" },
  ];

  return (
    <div>
      {/* 인트로 카드 (시안) — 아이콘 + 리뷰 모니터링 + [채널톡 문의하기] (시안 블루 → v2 퍼플) */}
      <section className="px-5 pt-3">
        <div className="flex items-start gap-3.5">
          <div className="shrink-0 w-[56px] h-[56px] rounded-full border-[1.5px] border-brandSoft bg-canvas grid place-items-center text-brand">
            <Icon name="clipboard" variant="border" size={26} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[16px] font-bold text-ink tracking-title">리뷰 모니터링</h2>
              <ReviewActions
                trigger={<>채널톡 문의하기 ↗</>}
                className="cp-action shrink-0 text-[13px] font-semibold text-brand"
              />
            </div>
            <p className="mt-1 text-[12px] text-ink2 leading-[1.55]">
              사장님은 직접 검수하지 않으며, 운영팀이 대신 확인해요.
              <br />
              광고 표시 누락·재작성 요청 등은 채널톡으로 문의해주세요.
            </p>
          </div>
        </div>

        {/* 요약 타일 (시안) — 이용 완료(모수 §4-1) + 작성 대기·검수중·검수 완료 3분할 */}
        <div className="mt-5 flex gap-2">
          <div className="shrink-0 w-[92px] rounded-lg bg-brandSoft py-4 text-center">
            <div className="text-[20px] font-bold text-ink tabular-nums">{summary.usedTotal}</div>
            <div className="mt-0.5 text-[12px] text-muted">이용 완료</div>
          </div>
          <div className="flex-1 rounded-lg bg-brandSoft py-4 grid grid-cols-3 text-center">
            <div>
              <div className="text-[20px] font-bold text-ink tabular-nums">{summary.pending}</div>
              <div className="mt-0.5 text-[12px] text-muted">작성 대기</div>
            </div>
            <div className="border-l border-r border-hairlineSoft">
              <div className="text-[20px] font-bold text-ink tabular-nums">{summary.reviewing}</div>
              <div className="mt-0.5 text-[12px] text-muted">검수중</div>
            </div>
            <div>
              <div className="text-[20px] font-bold text-ink tabular-nums">{summary.done}</div>
              <div className="mt-0.5 text-[12px] text-muted">검수 완료</div>
            </div>
          </div>
        </div>

        {/* 상태 필터 칩 (시안) — 전체/검수중/검수 완료/반려 */}
        <div className="mt-4 flex gap-1.5 overflow-x-auto scrollbar-none">
          {chips.map((c) => {
            const active = filter === c.key || (c.key === "all" && filter === "pending");
            return (
              <Link
                key={c.key}
                href={c.key === "all" ? hrefOf() : hrefOf(c.key)}
                className={`cp-action h-10 px-4 rounded-pill text-[13px] whitespace-nowrap shrink-0 inline-flex items-center ${
                  active ? "bg-ink text-white font-bold" : "bg-canvas border border-hairline text-ink2 font-medium"
                }`}
              >
                {c.label}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="px-5 mt-4 space-y-3 pb-6">
        {passes.map((p) => {
          const store = stores.find((s) => s.id === p.storeId);
          const campaign = campaigns.find((c) => c.id === p.campaignId);
          const state = ownerReviewState(p)!;
          const overdue = isReviewOverdue(p, now);
          const deadline = reviewDeadline(p);
          const dateAt = state === "pending" ? p.usedAt : (p.reviewSubmittedAt ?? p.usedAt);
          return (
            <article key={p.id} className="bg-canvas border border-hairline rounded-lg p-5">
              {/* 캠페인명 최대 2줄 + 상태 칩 — [§4-5] 캠페인명(선택 입력) 미작성은 매장명 폴백 */}
              <div className="flex items-start justify-between gap-2">
                <h3 className="flex-1 min-w-0 text-[17px] font-bold text-ink tracking-title leading-[1.35] line-clamp-2">
                  {campaign?.title || store?.name}
                </h3>
                <span className="shrink-0 flex items-center gap-1.5 pt-0.5">
                  {overdue && (
                    <span className="text-[11px] px-2 py-1 rounded-pill font-semibold bg-errorSoft text-error">기한 초과</span>
                  )}
                  <span className={`text-[11px] px-2 py-1 rounded-pill font-semibold ${stateTone[state]}`}>
                    {OWNER_REVIEW_LABEL[state]}
                  </span>
                </span>
              </div>

              {/* 채널 파스텔 배지 + 날짜 (시안 — 작성 대기는 이용일·리뷰 기한) */}
              <div className="mt-2 flex items-center gap-2 text-[13px] text-ink2 tabular-nums">
                {state !== "pending" && p.reviewChannel && <ChannelIcons channels={[p.reviewChannel]} />}
                <span>
                  {dateAt ? fmtKst(dateAt) : "일시 미기록"}
                  {state === "pending" && deadline != null && <> · 리뷰 기한 {fmtKst(deadline)}</>}
                </span>
              </div>

              {state !== "pending" && p.reviewUrl && (
                <a
                  href={p.reviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="cp-action mt-2.5 inline-flex items-center gap-1 text-[14px] font-semibold text-brand"
                >
                  리뷰 보러가기 <Icon name="arrow-right" variant="border" size={13} />
                </a>
              )}

              {state !== "pending" && p.reviewBody && (
                <p className="mt-2.5 text-[14px] text-ink2 leading-[1.6] line-clamp-3">{p.reviewBody}</p>
              )}

              {/* 상태 밴드 (시안) — 검수중 = 안내 / 반려 = 반려 사유. 검수 완료는 밴드 없음 */}
              {state === "reviewing" && (
                <div className="mt-3 rounded-md bg-brandSoft px-3 py-2.5 text-center text-[12px] text-ink2">
                  영업일 기준 최대 3일 이내로 검수 완료되어요
                </div>
              )}
              {state === "resubmit" && (
                <div className="mt-3 rounded-md bg-errorSoft px-3 py-2.5 text-[12px] text-error leading-[1.5]">
                  반려 사유{p.rejectReason ? <> — <span className="text-ink2">{p.rejectReason}</span></> : "는 채널톡으로 확인해주세요"}
                </div>
              )}

              {/* 작성 대기 — 독촉 기능 없음 (§4-3), 기한 내/기한 초과 안내 카피 */}
              {state === "pending" && (
                <div className="mt-3 rounded-md bg-sunken px-3 py-2.5 text-[12px] text-muted leading-[1.5]">
                  {overdue
                    ? "리뷰 작성 기한이 지났어요. 운영팀에서 확인 및 안내를 진행합니다."
                    : "체험자가 아직 리뷰를 제출하지 않았어요. 작성 기한 내에는 별도의 조치가 필요하지 않습니다."}
                </div>
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
