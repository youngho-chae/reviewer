import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDB } from "@/lib/db";

export const dynamic = "force-dynamic";

const statusLabel = (s: string) => ({
  active: "사용 대기",
  used: "리뷰 작성 대기",
  review_submitted: "검수 대기",
  completed: "완료",
  expired: "만료",
  rejected: "반려",
} as any)[s] || s;

const statusColor = (s: string) => ({
  active: "bg-brand text-white",
  used: "bg-ink text-white",
  review_submitted: "bg-surfaceStrong text-ink",
  completed: "bg-success text-white",
  expired: "bg-surfaceStrong text-muted",
  rejected: "bg-error text-white",
} as any)[s] || "bg-surfaceStrong text-muted";

export default async function MyPasses() {
  const me = await getCurrentReviewer();
  const db = getDB();
  const passes = db.passes
    .filter((p) => p.reviewerId === me.id)
    .sort((a, b) => b.issuedAt - a.issuedAt);

  // 자동 만료 처리
  const now = Date.now();
  for (const p of passes) {
    if (p.status === "active" && now > p.expiresAt) p.status = "expired";
  }

  return (
    <div className="pb-24">
      <div className="px-5 pt-12 pb-3">
        <h1 className="text-[22px] font-bold">내 체험권</h1>
        <div className="text-[13px] text-muted mt-1">{passes.length}개</div>
      </div>

      <div className="px-5 space-y-3">
        {passes.map((p) => {
          const store = db.stores.find((s) => s.id === p.storeId);
          const c = db.campaigns.find((c) => c.id === p.campaignId);
          const remainMs = p.expiresAt - now;
          const hours = Math.max(0, Math.floor(remainMs / 1000 / 60 / 60));
          const minutes = Math.max(0, Math.floor((remainMs / 1000 / 60) % 60));
          return (
            <Link key={p.id} href={`/r/passes/${p.id}`} className="block rounded-md border border-hairline p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[15px] font-semibold">{store?.name}</div>
                  <div className="text-[12px] text-muted mt-0.5">{c?.title}</div>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${statusColor(p.status)}`}>{statusLabel(p.status)}</span>
              </div>
              {p.status === "active" && (
                <div className="mt-3 text-[13px] text-brand font-medium">남은 시간 {hours}시간 {minutes}분</div>
              )}
              {p.status === "used" && (
                <div className="mt-3 text-[13px] text-ink">결제 ₩{p.paidAmount?.toLocaleString()} · 지원 ₩{p.supportApplied?.toLocaleString()}</div>
              )}
            </Link>
          );
        })}
        {passes.length === 0 && (
          <div className="py-12 text-center text-muted text-[14px]">발급받은 체험권이 없어요</div>
        )}
      </div>
    </div>
  );
}
