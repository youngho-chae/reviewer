import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";

export const dynamic = "force-dynamic";

const statusChip = (s: string) => ({
  active: { label: "발급", cls: "bg-brand text-white" },
  used: { label: "사용", cls: "bg-ink text-white" },
  review_submitted: { label: "검수", cls: "bg-surfaceStrong text-ink" },
  completed: { label: "완료", cls: "bg-success text-white" },
  expired: { label: "만료", cls: "bg-surfaceStrong text-muted" },
  rejected: { label: "회수", cls: "bg-error text-white" },
} as any)[s] || { label: s, cls: "bg-surfaceStrong text-muted" };

function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dayLabel(key: string) {
  const today = dayKey(Date.now());
  const y = new Date(Date.now() - 86400000);
  if (key === today) return "오늘";
  if (key === dayKey(y.getTime())) return "어제";
  return key;
}

export default async function OwnerLogs() {
  const me = await getCurrentOwner();
  const db = await getDBAsync();
  const passes = db.passes
    .filter((p) => p.ownerId === me.id)
    .sort((a, b) => b.issuedAt - a.issuedAt);

  // 일자별 그룹핑
  const groups = new Map<string, typeof passes>();
  for (const p of passes) {
    const k = dayKey(p.issuedAt);
    const list = groups.get(k) || [];
    list.push(p);
    groups.set(k, list);
  }

  const totalSupport = passes.reduce((s, p) => s + (p.supportApplied || 0), 0);

  return (
    <div className="pb-24">
      <div className="px-5 pt-12 pb-3">
        <Link href="/o/me" className="text-muted text-[14px]">← 더보기</Link>
        <h1 className="mt-3 text-[22px] font-bold">체험권 사용 로그</h1>
        <div className="text-[13px] text-muted mt-1">총 {passes.length}건 · 누적 지원 ₩{totalSupport.toLocaleString()}</div>
      </div>

      <div className="mt-3">
        {[...groups.entries()].map(([k, list]) => (
          <div key={k} className="mt-4">
            <div className="px-5 text-[12px] text-muted font-medium">{dayLabel(k)}</div>
            <div className="mt-2 divide-y divide-hairline border-y border-hairline">
              {list.map((p) => {
                const store = db.stores.find((s) => s.id === p.storeId);
                const c = db.campaigns.find((x) => x.id === p.campaignId);
                const reviewer = db.reviewers.find((r) => r.id === p.reviewerId);
                const chip = statusChip(p.status);
                return (
                  <div key={p.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${chip.cls}`}>{chip.label}</span>
                          <div className="text-[14px] font-medium truncate">{store?.name}</div>
                        </div>
                        <div className="text-[12px] text-muted mt-1 truncate">
                          {c?.title} · 익명 #{reviewer?.id.slice(-4)} · {p.reviewerGrade}등급
                        </div>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        {p.supportApplied ? (
                          <div className="text-[13px] font-medium">₩{p.supportApplied.toLocaleString()}</div>
                        ) : (
                          <div className="text-[12px] text-muted">-</div>
                        )}
                        {p.paidAmount ? (
                          <div className="text-[11px] text-muted">결제 ₩{p.paidAmount.toLocaleString()}</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {passes.length === 0 && (
          <div className="py-16 text-center text-muted text-[14px]">사용 로그가 없습니다</div>
        )}
      </div>
    </div>
  );
}
