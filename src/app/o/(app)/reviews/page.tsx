import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import GradeBadge from "@/components/GradeBadge";
import Icon from "@/components/Icon";
import ReviewActions from "./ReviewActions";

export const dynamic = "force-dynamic";

const ch_label: Record<string, string> = {
  naver_blog: "네이버 블로그",
  instagram: "인스타그램",
  youtube: "유튜브",
  tiktok: "틱톡",
};

const statusMeta: Record<
  string,
  { label: string; tone: "ink" | "brand" | "mute" | "warn" }
> = {
  review_submitted: { label: "운영팀 검수 중", tone: "warn" },
  completed: { label: "검수 통과", tone: "brand" },
  rejected: { label: "운영팀 반려", tone: "mute" },
};

const toneCls = (tone: "ink" | "brand" | "mute" | "warn") =>
  ({
    ink: "bg-ink text-white",
    brand: "bg-brand text-white",
    mute: "bg-parchment text-muted border border-hairline",
    warn: "bg-canvas text-ink border border-brand/40",
  } as const)[tone];

export default async function OwnerReviews() {
  const me = await getCurrentOwner();
  const db = await getDBAsync();
  const passes = db.passes
    .filter(
      (p) =>
        p.ownerId === me.id &&
        (p.status === "review_submitted" ||
          p.status === "completed" ||
          p.status === "rejected"),
    )
    .sort((a, b) => (b.reviewSubmittedAt || 0) - (a.reviewSubmittedAt || 0));

  const pendingCnt = passes.filter((p) => p.status === "review_submitted").length;
  const doneCnt = passes.filter((p) => p.status === "completed").length;

  return (
    <div className="pb-24 bg-canvas min-h-[100dvh]">
      <div className="sticky top-0 z-10 frosted-parchment border-b border-hairlineSoft">
        <div className="h-13 px-5 flex items-center">
          <h1 className="text-[21px] font-semibold text-ink tracking-[-0.011em]">
            리뷰 모니터링
          </h1>
        </div>
      </div>

      <section className="px-6 pt-6">
        <p className="text-[14px] text-ink2 leading-[1.5]">
          체험자가 게시한 후기를 조회할 수 있습니다. 사장님은 직접 검수하지
          않으며, 광고 표시 누락·재작성 요청 등은 채널톡으로 운영팀에
          접수해주세요.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-parchment border border-hairline p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted">
              운영팀 검수 중
            </div>
            <div className="font-display text-[28px] leading-[1] text-ink mt-2 tracking-[-0.022em]">
              {pendingCnt}
            </div>
          </div>
          <div className="rounded-lg bg-parchment border border-hairline p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted">
              통과 누적
            </div>
            <div className="font-display text-[28px] leading-[1] text-ink mt-2 tracking-[-0.022em]">
              {doneCnt}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 mt-7 space-y-3">
        {passes.map((p) => {
          const reviewer = db.reviewers.find((r) => r.id === p.reviewerId);
          const store = db.stores.find((s) => s.id === p.storeId);
          const meta = statusMeta[p.status];
          return (
            <article
              key={p.id}
              className="bg-canvas border border-hairline rounded-lg p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <GradeBadge grade={p.reviewerGrade} size="sm" />
                  <span className="text-[12px] uppercase tracking-[0.18em] text-muted">
                    익명 #{reviewer?.id.slice(-4)} · {p.reviewerGrade}등급
                  </span>
                </div>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-pill font-semibold ${toneCls(meta?.tone || "mute")}`}
                >
                  {meta?.label || p.status}
                </span>
              </div>

              <h3 className="mt-3 font-display text-[20px] leading-[1.2] text-ink">
                {store?.name}
              </h3>
              <div className="text-[12px] text-muted mt-1">
                {ch_label[p.reviewChannel || "naver_blog"]} ·{" "}
                {p.reviewSubmittedAt &&
                  new Date(p.reviewSubmittedAt).toLocaleDateString()}
              </div>

              <a
                href={p.reviewUrl}
                target="_blank"
                rel="noreferrer"
                className="cp-action mt-3 flex items-center gap-2 text-[13px] text-brand"
              >
                <Icon name="arrow-right" variant="border" size={14} />
                <span className="truncate underline">{p.reviewUrl}</span>
              </a>

              {p.reviewBody && (
                <p className="mt-3 text-[14px] text-ink2 leading-[1.55] line-clamp-3">
                  {p.reviewBody}
                </p>
              )}

              {p.status === "review_submitted" && (
                <div className="mt-3 px-3 py-2.5 rounded-md bg-parchment border border-hairlineSoft text-[12px] text-muted leading-[1.5]">
                  운영팀이 광고 표시·작성 조건을 점검하고 있어요 (최대 72시간).
                  사장님이 직접 검수하실 필요가 없습니다.
                </div>
              )}

              <ReviewActions
                passId={p.id}
                storeName={store?.name}
                reviewUrl={p.reviewUrl}
              />
            </article>
          );
        })}
        {passes.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-[15px] text-muted">아직 등록된 리뷰가 없습니다.</p>
            <Link
              href="/o/home"
              className="cp-action inline-block mt-3 text-[14px] text-brand"
            >
              홈으로 돌아가기 →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
