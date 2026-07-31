import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import Icon from "@/components/Icon";
import RefillFlow from "@/components/RefillFlow";
import CouponUseButton from "./CouponUseButton";
import { ownedRefills, refillGrantFor, kstMonth, REFILL_PRICE } from "@/lib/limit-refill";

export const dynamic = "force-dynamic";

// 쿠폰함 (2026-07-31 2차 보완) — 모집 한도 리필권 구매 + 보유 쿠폰 관리.
// 구매 = 쿠폰 발급(자동 적용 아님) — 사용 시 그 결제 주기 한도에 가산·주기 종료까지 유효.
export default async function OwnerCoupons() {
  const me = await getCurrentOwner();
  const db = await getDBAsync();
  const owned = ownedRefills(db, me.id);
  const month = kstMonth();
  const used = (db.limitRefills ?? [])
    .filter((r) => r.ownerId === me.id && r.usedAt)
    .sort((a, b) => (b.usedAt ?? 0) - (a.usedAt ?? 0));
  const fmtDate = (t: number) => new Date(t + 9 * 3600000).toISOString().slice(5, 10).replace("-", ".");

  return (
    <div className="pb-24 bg-canvas">
      {/* top-app-bar — 뒤로가기 + 타이틀 */}
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-3 flex items-center">
          <Link href="/o/me" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="더보기로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
          <h1 className="text-[18px] font-bold text-ink tracking-title">쿠폰함</h1>
        </div>
      </div>

      {/* 모집 한도 리필권 구매 — 항상 구매 플로우 (mode=buy) */}
      <div className="mx-5 mt-2 rounded-lg border border-hairline bg-canvas p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[15px] font-bold text-ink">모집 한도 리필권</div>
            <p className="mt-1 text-[12px] text-ink2 leading-[1.5]">현재 멤버십의 월 모집 한도를 한 번 더 충전할 수 있어요.</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[18px] font-bold text-ink tabular-nums">{REFILL_PRICE.toLocaleString()}원</div>
            <div className="text-[11px] text-muted">/1장</div>
          </div>
        </div>
        <div className="mt-3 rounded-md bg-sunken px-3.5 py-2.5 text-[12px] text-ink2 leading-[1.6]">
          구매하면 쿠폰으로 발급돼요 — 바로 쓰거나 보관할 수 있어요.
          <br />
          사용한 달의 모집 한도에 추가되고, 그 달까지만 유효해요 (남은 수량 이월 불가).
        </div>
        <div className="mt-3">
          {me.plan === "Free" ? (
            <p className="text-[12px] text-muted leading-[1.5]">
              Free 플랜은 리필권을 구매할 수 없어요 —{" "}
              <Link href="/o/membership" className="text-brand font-medium">Basic으로 업그레이드</Link>하면 매월 15건을
              모집할 수 있어요.
            </p>
          ) : (
            <RefillFlow
              plan={me.plan}
              grant={refillGrantFor(me.plan)}
              price={REFILL_PRICE}
              owned={owned.length}
              mode="buy"
              trigger={`${REFILL_PRICE.toLocaleString()}원에 ${refillGrantFor(me.plan)}건 리필권 구매`}
              className="cp-action w-full h-11 rounded-md bg-brand text-white text-[14px] font-bold"
            />
          )}
        </div>
      </div>

      {/* 보유 쿠폰 */}
      <h2 className="px-5 mt-7 text-[18px] font-bold text-ink tracking-title">보유 쿠폰 {owned.length}장</h2>
      <div className="px-5 mt-3 space-y-2.5">
        {owned.length === 0 && (
          <div className="rounded-md border border-dashed border-hairline p-6 text-center text-muted text-[13px]">
            보유 중인 쿠폰이 없어요.
          </div>
        )}
        {owned.map((r) => (
          <div key={r.id} className="rounded-lg border border-brand/40 bg-brandSoft/40 p-4 flex items-center gap-3">
            <div className="flex-1">
              <div className="text-[14px] font-bold text-ink">모집 한도 리필권 +{r.amount}건</div>
              <div className="mt-0.5 text-[12px] text-muted tabular-nums">{fmtDate(r.purchasedAt)} 구매 · 사용 전까지 보관</div>
            </div>
            <CouponUseButton refillId={r.id} amount={r.amount} />
          </div>
        ))}
      </div>

      {/* 사용 내역 */}
      {used.length > 0 && (
        <>
          <h2 className="px-5 mt-7 text-[15px] font-bold text-ink">사용 내역</h2>
          <div className="px-5 mt-2 space-y-1.5">
            {used.map((r) => (
              <div key={r.id} className="rounded-md bg-sunken px-3.5 py-2.5 flex items-center justify-between text-[12px] tabular-nums">
                <span className="text-ink2">모집 한도 리필권 +{r.amount}건</span>
                <span className="text-muted">
                  {fmtDate(r.usedAt!)} 사용{r.usedMonth === month ? " · 이번 달 적용 중" : ""}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
