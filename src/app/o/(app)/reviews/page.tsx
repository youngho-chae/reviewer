import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import Icon from "@/components/Icon";
import ReviewActions from "./ReviewActions";

export const dynamic = "force-dynamic";

const ch_label: Record<string, string> = {
  naver_blog: "네이버 블로그",
  instagram: "인스타그램",
  tiktok: "틱톡",
};

// 상태 칩 — *Soft 배경 + 강조 텍스트 (v2 상태 문법)
const statusMeta: Record<
  string,
  { label: string; tone: "success" | "error" | "warn" | "mute" }
> = {
  review_submitted: { label: "운영팀 검수 중", tone: "warn" },
  completed: { label: "검수 통과", tone: "success" },
  rejected: { label: "운영팀 반려", tone: "error" },
};

const toneCls = (tone: "success" | "error" | "warn" | "mute") =>
  ({
    success: "bg-successSoft text-successStrong",
    error: "bg-errorSoft text-error",
    warn: "bg-warningSoft text-warning",
    mute: "bg-sunken text-muted",
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
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-5 flex items-center">
          <h1 className="text-[18px] font-bold text-ink tracking-title">
            리뷰 모니터링
          </h1>
        </div>
      </div>

      <section className="px-5 pt-2">
        <p className="text-[14px] text-ink2 leading-[1.5]">
          체험자가 게시한 후기를 조회할 수 있습니다. 사장님은 직접 검수하지
          않으며, 광고 표시 누락·재작성 요청 등은 채널톡으로 운영팀에
          접수해주세요.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-canvas border border-hairline p-4">
            <div className="text-[12px] text-muted">
              운영팀 검수 중
            </div>
            <div className="text-[20px] font-bold text-ink tabular-nums mt-2 tracking-title">
              {pendingCnt}
            </div>
          </div>
          <div className="rounded-lg bg-canvas border border-hairline p-4">
            <div className="text-[12px] text-muted">
              통과 누적
            </div>
            <div className="text-[20px] font-bold text-ink tabular-nums mt-2 tracking-title">
              {doneCnt}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 mt-7 space-y-3">
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
                  {/* [확정 정책 8·10] 체험자 등급은 사장님에게 비노출 — 익명 표기만 */}
                  <span className="text-[12px] text-muted">익명 #{reviewer?.id.slice(-4)}</span>
                </div>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-pill font-semibold ${toneCls(meta?.tone || "mute")}`}
                >
                  {meta?.label || p.status}
                </span>
              </div>

              <h3 className="mt-3 text-[16px] font-bold text-ink">
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
                <div className="mt-3 px-3 py-2.5 rounded-md bg-sunken text-[12px] text-muted leading-[1.5]">
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
              className="cp-action inline-block mt-3 text-[14px] font-semibold text-brand"
            >
              홈으로 돌아가기 →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
