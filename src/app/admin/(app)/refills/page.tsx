import { getCurrentAdmin } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { kstMonth } from "@/lib/limit-refill";

export const dynamic = "force-dynamic";

// 모집 한도 리필권 구매 내역 (2026-07-31 BM 전략안 §7·§9).
// 결제(PG) 연동 전 수기 청구 근거 + 핵심 지표(플랜별 구매·반복 구매·대량 모집 후보 식별).
// Premium 리필 2회 도달 사장님은 대량 모집(Enterprise) 플랜 제안 대상.
export default async function AdminRefills() {
  await getCurrentAdmin();
  const db = await getDBAsync();

  const refills = [...(db.limitRefills ?? [])].sort((a, b) => b.purchasedAt - a.purchasedAt);
  const month = kstMonth();
  const thisMonth = refills.filter((r) => r.month === month);
  const revenue = thisMonth.reduce((s, r) => s + r.price, 0);
  const ownerEmail = (id: string) => db.owners.find((o) => o.id === id)?.email ?? `#${id.slice(-4)}`;
  const fmtWhen = (ts: number) =>
    new Date(ts).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  // 대량 모집 플랜 전환 후보 — 이번 주기 리필 2회 이상 반복 구매한 Premium 사장님 (§8).
  // 구매 횟수 제한은 해제(2026-07-31 보완) — 반복 구매자는 식별만 해서 별도 제안한다.
  const cycleCount = new Map<string, number>();
  for (const r of thisMonth) cycleCount.set(r.ownerId, (cycleCount.get(r.ownerId) ?? 0) + 1);
  const enterpriseCandidates = [...cycleCount.entries()].filter(([ownerId, n]) => {
    const o = db.owners.find((x) => x.id === ownerId);
    return o?.plan === "Premium" && n >= 2;
  });

  return (
    <div className="pb-24">
      <section className="px-5 pt-5">
        <div className="rounded-lg border border-hairline bg-canvas p-5">
          <div className="text-[12px] text-muted">이번 달 리필권 매출 ({month})</div>
          <div className="text-[22px] font-bold text-ink tracking-title tabular-nums mt-1">
            {revenue.toLocaleString()}원 <span className="text-[14px] text-muted font-medium">· {thisMonth.length}건</span>
          </div>
          <div className="text-[12px] text-muted mt-2">
            PG 연동 전 수기 청구 근거 — 구매 즉시 한도 적용됨 · 리필 12,900원/회 (Basic 15 · Standard 50 · Premium 100건)
          </div>
        </div>
      </section>

      {enterpriseCandidates.length > 0 && (
        <section className="px-5 mt-5">
          <h2 className="text-[15px] font-bold text-ink">대량 모집 플랜 제안 대상</h2>
          <p className="mt-1 text-[12px] text-muted">이번 주기 Premium 리필 2회 이상 반복 구매 — Enterprise 제안 대상 (§8)</p>
          <div className="mt-2 space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start">
            {enterpriseCandidates.map(([ownerId, n]) => (
              <div key={ownerId} className="rounded-lg border border-warning/40 bg-canvas p-4 flex items-center justify-between">
                <span className="text-[14px] font-semibold text-ink">{ownerEmail(ownerId)}</span>
                <span className="text-[12px] px-2 py-0.5 rounded-pill bg-warningSoft text-ink font-semibold tabular-nums">
                  이번 달 리필 {n}회
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="px-5 mt-5">
        <h2 className="text-[15px] font-bold text-ink">구매 내역 {refills.length}건</h2>
        <div className="mt-2 space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start">
          {refills.length === 0 && (
            <div className="rounded-md border border-dashed border-hairline p-6 text-center text-muted text-[13px]">
              아직 구매 내역이 없어요.
            </div>
          )}
          {refills.map((r) => (
            <div key={r.id} className="rounded-lg border border-hairline bg-canvas p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-semibold text-ink truncate">{ownerEmail(r.ownerId)}</span>
                <span className="text-[14px] font-bold text-ink tabular-nums shrink-0">{r.price.toLocaleString()}원</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[12px] text-muted tabular-nums">
                <span>
                  {r.plan} · +{r.amount}건 · 유효 {r.month}
                </span>
                <span>{fmtWhen(r.purchasedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
