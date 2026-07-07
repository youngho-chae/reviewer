import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

// 상태 칩 — *Soft 배경 + 강조 텍스트 (v2 상태 문법)
const statusChip = (s: string) => ({
  active: { label: "발급", cls: "bg-brandTint text-brand" },
  used: { label: "사용", cls: "bg-sunken text-ink2" },
  review_submitted: { label: "검수", cls: "bg-warningSoft text-warning" },
  completed: { label: "완료", cls: "bg-successSoft text-successStrong" },
  expired: { label: "만료", cls: "bg-sunken text-muted" },
  rejected: { label: "반려", cls: "bg-errorSoft text-error" },
} as any)[s] || { label: s, cls: "bg-sunken text-muted" };

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
    <div className="pb-24 bg-canvas">
      {/* top-app-bar — 뒤로가기 + 타이틀 */}
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-3 flex items-center">
          <Link href="/o/me" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="더보기로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
          <h1 className="text-[18px] font-bold text-ink tracking-title">체험권 사용 로그</h1>
        </div>
      </div>
      <div className="px-5 pt-1 pb-3 text-[13px] text-muted">
        총 <span className="tabular-nums">{passes.length}</span>건 · 누적 지원 <span className="font-bold text-ink tabular-nums">₩{totalSupport.toLocaleString()}</span>
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
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-pill ${chip.cls}`}>{chip.label}</span>
                          <div className="text-[14px] font-semibold text-ink truncate">{store?.name}</div>
                        </div>
                        <div className="text-[12px] text-muted mt-1 truncate">
                          {c?.title} · 익명 #{reviewer?.id.slice(-4)} · {p.reviewerGrade}등급
                        </div>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        {p.supportApplied ? (
                          <div className="text-[13px] font-bold text-ink tabular-nums">₩{p.supportApplied.toLocaleString()}</div>
                        ) : (
                          <div className="text-[12px] text-muted">-</div>
                        )}
                        {p.paidAmount ? (
                          <div className="text-[11px] text-muted tabular-nums">결제 ₩{p.paidAmount.toLocaleString()}</div>
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
