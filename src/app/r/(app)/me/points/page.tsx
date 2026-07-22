import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import {
  MIN_WITHDRAWAL_POINTS,
  WITHDRAWAL_UNIT_POINTS,
  WITHDRAWAL_FEE,
  pointBalance,
  pointTxnsOf,
  withdrawalsOf,
} from "@/lib/points";
import { SBUI, sbNum } from "@/lib/storyboard";
import { isTestbedBase, openbankingConfigured } from "@/lib/openbanking";
import { fmtKoDateTime } from "@/lib/dates";
import Icon from "@/components/Icon";
import WithdrawForm from "./WithdrawForm";

export const dynamic = "force-dynamic";

// 포인트 홈 (R-17, 2026-07-12 레뷰 벤치마크) — 잔액 · 출금 신청 · 원장 내역.
// 적립은 배송형 리뷰 검수 승인만(P4), 출금 구현으로 보상의 실사용 경로 충족(P5).
export default async function PointsPage() {
  const me = await getCurrentReviewer();
  const db = await getDBAsync();
  const balance = pointBalance(db, me.id);
  const txns = pointTxnsOf(db, me.id);
  const withdrawals = withdrawalsOf(db, me.id);
  const pendingWd = withdrawals.filter((w) => w.status === "requested");

  const wdLabel: Record<string, { label: string; cls: string }> = {
    requested: { label: "처리 대기", cls: "bg-sunken text-muted" },
    paid: { label: "지급 완료", cls: "bg-successSoft text-successStrong" },
    rejected: { label: "반려", cls: "bg-errorSoft text-error" },
  };

  return (
    <div className="pb-24 bg-canvas">
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-13 px-3 flex items-center gap-1">
          <Link href="/r/me" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="뒤로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
          <h1 className="text-[18px] font-semibold text-ink tracking-[-0.011em]">체험 포인트</h1>
        </div>
      </div>

      {/* 잔액 히어로 */}
      <section className="bg-parchment px-6 pt-9 pb-8 text-center">
        <div className="text-[13px] text-muted">출금 가능한 포인트</div>
        <div className="mt-2 text-[32px] font-bold text-ink tabular-nums leading-none">
          {sbNum(SBUI.pointBalance, `${balance.toLocaleString()}P`)}
        </div>
        <p className="mt-3 text-[12px] text-muted leading-[1.5]">
          1P = 1원 · 배송형 체험 리뷰가 검수를 통과하면 적립돼요.
          <br />
          최소 {MIN_WITHDRAWAL_POINTS.toLocaleString()}P부터 {WITHDRAWAL_UNIT_POINTS.toLocaleString()}P 단위로 출금할 수 있어요.
        </p>
      </section>

      {/* 출금 신청 — 세금·수수료 미리보기 포함 (points.ts quoteWithdrawal과 동일 계산) */}
      <section className="px-5 mt-7">
        <h2 className="text-[17px] font-bold text-ink tracking-title">출금 신청</h2>
        <p className="mt-1 text-[12px] text-muted leading-[1.55]">
          본인 명의 계좌 인증 후 신청할 수 있어요 · 세법상 사업소득으로 원천징수(3.3%) 후 지급되며 이체 수수료 {WITHDRAWAL_FEE.toLocaleString()}원이 차감돼요.
        </p>
        <div className="mt-3">
          <WithdrawForm balance={balance} obConfigured={openbankingConfigured()} obTestbed={isTestbedBase()} />
        </div>
        {pendingWd.length > 0 && (
          <p className="mt-2 text-[12px] text-brand font-semibold">처리 대기 중인 출금 신청 {pendingWd.length}건이 있어요.</p>
        )}
      </section>

      {/* 출금 신청 내역 */}
      {withdrawals.length > 0 && (
        <section className="px-5 mt-9">
          <h2 className="text-[17px] font-bold text-ink tracking-title">출금 내역</h2>
          <div className="mt-3 rounded-md border border-hairline overflow-hidden">
            {withdrawals.map((w, i) => (
              <div key={w.id} className={`px-4 py-3.5 ${i < withdrawals.length - 1 ? "border-b border-hairlineSoft" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-semibold text-ink tabular-nums">
                    {sbNum(SBUI.point, `${w.amountPoints.toLocaleString()}P`)}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-pill text-[11px] font-semibold ${wdLabel[w.status].cls}`}>
                    {wdLabel[w.status].label}
                  </span>
                </div>
                <div className="mt-1 text-[12px] text-muted tabular-nums">
                  세금 {sbNum(SBUI.point, `${w.taxWithheld.toLocaleString()}원`)} · 수수료 {sbNum(SBUI.point, `${w.fee.toLocaleString()}원`)} · 실지급{" "}
                  <span className="font-semibold text-ink2">{sbNum(SBUI.support, `${w.payout.toLocaleString()}원`)}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-mutedSoft">
                  {sbNum(SBUI.dateTime, fmtKoDateTime(w.requestedAt))} · {w.bank}
                  {w.status === "rejected" && w.rejectReason ? ` · ${w.rejectReason}` : ""}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 포인트 내역 — append-only 원장 */}
      <section className="px-5 mt-9">
        <h2 className="text-[17px] font-bold text-ink tracking-title">포인트 내역</h2>
        {txns.length === 0 ? (
          <div className="mt-3 rounded-md border border-hairline px-4 py-8 text-center">
            <p className="text-[14px] text-muted">아직 적립된 포인트가 없어요.</p>
            <p className="mt-1 text-[12px] text-mutedSoft">배송형 체험 리뷰가 검수를 통과하면 적립돼요.</p>
            <Link href="/r/explore?tab=delivery" className="cp-action mt-3 inline-flex h-9 px-4 items-center rounded-sm bg-brand text-white text-[13px] font-semibold">
              배송 체험 둘러보기
            </Link>
          </div>
        ) : (
          <div className="mt-3 rounded-md border border-hairline overflow-hidden">
            {txns.map((t, i) => (
              <div key={t.id} className={`px-4 py-3.5 flex items-center justify-between gap-3 ${i < txns.length - 1 ? "border-b border-hairlineSoft" : ""}`}>
                <div className="min-w-0">
                  <div className="text-[14px] text-ink truncate">{t.memo}</div>
                  <div className="mt-0.5 text-[11px] text-mutedSoft tabular-nums">{sbNum(SBUI.dateTime, fmtKoDateTime(t.createdAt))}</div>
                </div>
                <span className={`shrink-0 text-[15px] font-bold tabular-nums ${t.amount >= 0 ? "text-ink" : "text-muted"}`}>
                  {sbNum(SBUI.point, `${t.amount >= 0 ? "+" : ""}${t.amount.toLocaleString()}P`)}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted leading-[1.55]">
          세금 안내 — 리뷰 활동 보상은 계속·반복 활동으로 보아 사업소득 3.3%(소득세 3% + 지방소득세 0.3%)를 원천징수해요.
          원천징수세액이 1,000원 미만이면 징수하지 않아요(소액부징수). 연간 소득 규모에 따라 종합소득세 신고 대상이 될 수 있어요.
        </p>
      </section>
    </div>
  );
}
