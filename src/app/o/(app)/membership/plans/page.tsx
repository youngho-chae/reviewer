import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import Icon from "@/components/Icon";
import PlanCompare from "./PlanCompare";

export const dynamic = "force-dynamic";

// 전체 플랜 (2026-08-12 와이어프레임 개편) — 카드 안 월간/연간 구독 라디오 + 하단 고정 CTA.
// 월간/연간은 별개 상품이 아니라 결제 방식(§2①), 할인율 대신 정가 취소선·2개월 무료(§2②).
export default async function PlanComparePage() {
  const me = await getCurrentOwner();
  return (
    <div className="pb-24 bg-canvas min-h-[100dvh]">
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-3 grid grid-cols-[40px_1fr_40px] items-center">
          <Link href="/o/membership" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="내 멤버십으로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
          <h1 className="text-[16px] font-bold text-ink tracking-title text-center">전체 플랜</h1>
          <span />
        </div>
      </div>
      <PlanCompare currentPlan={me.plan} currentBilling={me.plan === "Free" ? null : (me.billing ?? "monthly")} />
    </div>
  );
}
