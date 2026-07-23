import { getCurrentAdmin } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { campaignExposure } from "@/lib/campaign-visibility";

export const dynamic = "force-dynamic";

const EXPOSURE_LABEL: Record<string, { label: string; cls: string }> = {
  open: { label: "모집 중", cls: "bg-successSoft text-successStrong" },
  issued_out: { label: "발급 마감 · 진행 중", cls: "bg-brandSoft text-brand" },
  closed: { label: "종료", cls: "bg-sunken text-muted" },
};

// 캠페인 관리 (확정 정책 12) — 실시간 캠페인 목록·노출 상태.
// 등급별 버킷은 내부 배분 기록으로 여기(어드민)에만 노출한다 (사장님 화면 비노출).
export default async function AdminCampaigns() {
  await getCurrentAdmin();
  const db = await getDBAsync();
  const now = Date.now();

  const rows = [...db.campaigns]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((c) => {
      const store = db.stores.find((s) => s.id === c.storeId);
      const owner = db.owners.find((o) => o.id === store?.ownerId);
      const exposure = campaignExposure(c, db.passes, now);
      const totalQ = c.quota.S + c.quota.A + c.quota.B + c.quota.C;
      const usedQ = c.used.S + c.used.A + c.used.B + c.used.C;
      return { c, store, owner, exposure, totalQ, usedQ };
    });

  const liveCount = rows.filter((r) => r.exposure !== "closed").length;

  return (
    <div className="pb-24">
      <section className="px-5 pt-5">
        <div className="rounded-lg border border-hairline bg-canvas p-5">
          <div className="text-[12px] text-muted">진행 중 캠페인</div>
          <div className="text-[22px] font-bold text-ink tracking-title tabular-nums mt-1">
            {liveCount}건 <span className="text-[13px] text-muted font-medium">/ 전체 {rows.length}건</span>
          </div>
          <div className="text-[12px] text-muted mt-2">등급별 배분 버킷은 내부 기록 — 사장님 화면에는 노출하지 않는다</div>
        </div>
      </section>

      <section className="px-5 mt-5 space-y-3">
        {rows.map(({ c, store, owner, exposure, totalQ, usedQ }) => {
          const ex = EXPOSURE_LABEL[exposure];
          return (
            <div key={c.id} className="rounded-lg border border-hairline bg-canvas p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-ink truncate">{c.title}</div>
                  <div className="text-[11px] text-muted truncate">
                    {store?.name} · {owner?.email ?? "사장님 미상"} · {c.kind === "delivery" ? "배송형" : "방문형"}
                  </div>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-pill font-semibold shrink-0 ${ex.cls}`}>{ex.label}</span>
              </div>
              <div className="mt-2 flex items-center gap-3 text-[12px] text-ink2 tabular-nums">
                <span>모집 {usedQ}/{totalQ}명</span>
                <span className="text-muted">
                  ~{new Date(c.endAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                </span>
                <span className="text-muted">지원금 {c.supportAmount.toLocaleString()}원</span>
              </div>
              {/* 등급별 버킷 — 어드민 내부 전용 */}
              <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
                {(["S", "A", "B", "C"] as const).map((g) => (
                  <div key={g} className="rounded-sm py-1.5 bg-sunken text-[11px] text-muted tabular-nums">
                    {g} {c.used[g]}/{c.quota[g]}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
