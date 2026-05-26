import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDB } from "@/lib/db";
import ReviewActions from "./ReviewActions";

export const dynamic = "force-dynamic";

const ch_label: any = {
  naver_blog: "네이버 블로그",
  instagram: "인스타그램",
  youtube: "유튜브",
  tiktok: "틱톡",
};

export default async function OwnerReviews() {
  const me = await getCurrentOwner();
  const db = getDB();
  const passes = db.passes
    .filter((p) => p.ownerId === me.id && (p.status === "review_submitted" || p.status === "completed" || p.status === "rejected"))
    .sort((a, b) => (b.reviewSubmittedAt || 0) - (a.reviewSubmittedAt || 0));

  return (
    <div className="pb-24">
      <div className="px-5 pt-12 pb-3">
        <h1 className="text-[22px] font-bold">리뷰 검수</h1>
        <p className="text-[13px] text-muted mt-1">광고 표시 문구 확인만 — 품질 판정은 운영팀</p>
      </div>

      <div className="px-5 space-y-3">
        {passes.map((p) => {
          const reviewer = db.reviewers.find((r) => r.id === p.reviewerId);
          return (
            <div key={p.id} className="rounded-md border border-hairline p-4">
              <div className="flex items-center justify-between">
                <div className="text-[14px] font-semibold">익명 리뷰어 #{reviewer?.id.slice(-4)}</div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                  p.status === "completed" ? "bg-success text-white" :
                  p.status === "rejected" ? "bg-error text-white" :
                  "bg-surfaceStrong text-ink"
                }`}>{
                  p.status === "completed" ? "통과" :
                  p.status === "rejected" ? "반려" : "검수 대기"
                }</span>
              </div>
              <div className="text-[12px] text-muted mt-1">{ch_label[p.reviewChannel || "naver_blog"]} · {p.reviewSubmittedAt && new Date(p.reviewSubmittedAt).toLocaleDateString()}</div>
              <a href={p.reviewUrl} target="_blank" rel="noreferrer" className="block mt-2 text-[13px] text-ink underline truncate">{p.reviewUrl}</a>
              <p className="mt-2 text-[13px] text-body line-clamp-3">{p.reviewBody}</p>
              {p.status === "review_submitted" && (
                <ReviewActions passId={p.id} />
              )}
            </div>
          );
        })}
        {passes.length === 0 && (
          <div className="py-12 text-center text-muted text-[14px]">검수할 리뷰가 없어요</div>
        )}
      </div>
    </div>
  );
}
