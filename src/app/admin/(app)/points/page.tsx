import { getCurrentAdmin } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import ProcessWithdrawalButtons from "./ProcessWithdrawalButtons";

export const dynamic = "force-dynamic";

// 포인트 출금 처리 큐 (2026-07-12 레뷰 벤치마크 — 운영정책서 §14).
// 신청 시점에 확정된 세액(사업소득 3.3%)·수수료·실지급액을 그대로 집행한다.
// 실서비스는 지급(paid) 시점에 이체·원천징수 신고 연동 — 프로토타입은 상태 전이만.
export default async function AdminPoints() {
  await getCurrentAdmin();
  const db = await getDBAsync();

  const withdrawals = [...(db.withdrawals ?? [])].sort((a, b) => b.requestedAt - a.requestedAt);
  const pending = withdrawals.filter((w) => w.status === "requested");
  const processed = withdrawals.filter((w) => w.status !== "requested");
  const reviewerName = (id: string) => db.reviewers.find((r) => r.id === id)?.nickname ?? `#${id.slice(-4)}`;
  const fmtWhen = (ts: number) =>
    new Date(ts).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="pb-24">
      <section className="px-5 pt-5">
        <div className="rounded-lg border border-hairline bg-canvas p-5">
          <div className="text-[12px] text-muted">출금 처리 대기</div>
          <div className="text-[22px] font-bold text-ink tracking-title tabular-nums mt-1">{pending.length}건</div>
          <div className="text-[12px] text-muted mt-2">
            세액은 신청 시점 확정값 — 사업소득 3.3% 원천징수 · 세액 1,000원 미만 소액부징수 · 이체 수수료 500원
          </div>
        </div>
      </section>

      {pending.length > 0 && (
        <section className="px-5 mt-5 space-y-3">
          <h2 className="text-[15px] font-bold text-ink">처리 대기</h2>
          {pending.map((w) => (
            <div key={w.id} className="rounded-lg border border-warning/40 bg-canvas p-4">
              <div className="flex items-center justify-between">
                <div className="text-[15px] font-bold text-ink">{reviewerName(w.reviewerId)}</div>
                <span className="text-[11px] px-2 py-0.5 rounded-pill bg-warningSoft text-warning font-semibold">대기</span>
              </div>
              <div className="mt-1.5 text-[13px] text-ink2 tabular-nums">
                신청 {w.amountPoints.toLocaleString()}P → 세금 {w.taxWithheld.toLocaleString()}원 + 수수료 {w.fee.toLocaleString()}원 차감 →{" "}
                <span className="font-bold text-ink">실지급 {w.payout.toLocaleString()}원</span>
              </div>
              <div className="mt-1 text-[12px] text-muted">
                {w.bank} {w.account} · 예금주 {w.holder}
              </div>
              <div className="mt-1 text-[11px] text-muted tabular-nums">신청 {fmtWhen(w.requestedAt)}</div>
              <ProcessWithdrawalButtons withdrawalId={w.id} />
            </div>
          ))}
        </section>
      )}
      {pending.length === 0 && (
        <p className="px-5 mt-5 text-[13px] text-muted">처리 대기 중인 출금 신청이 없습니다.</p>
      )}

      {processed.length > 0 && (
        <section className="px-5 mt-6 space-y-2">
          <h2 className="text-[15px] font-bold text-ink">처리 내역</h2>
          {processed.map((w) => (
            <div key={w.id} className="rounded-md border border-hairline bg-canvas px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-ink truncate">
                  {reviewerName(w.reviewerId)} · {w.amountPoints.toLocaleString()}P
                </div>
                <div className="text-[11px] text-muted truncate tabular-nums">
                  실지급 {w.payout.toLocaleString()}원 · {w.processedAt ? fmtWhen(w.processedAt) : ""}
                  {w.status === "rejected" && w.rejectReason ? ` · ${w.rejectReason}` : ""}
                </div>
              </div>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-pill font-semibold shrink-0 ${
                  w.status === "paid" ? "bg-successSoft text-successStrong" : "bg-errorSoft text-error"
                }`}
              >
                {w.status === "paid" ? "지급 완료" : "반려"}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
