import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import Icon from "@/components/Icon";
import PlanCompare from "./PlanCompare";

export const dynamic = "force-dynamic";

// 플랜 비교 (2026-08-10 설계안 ②) — 결제 방식 토글(월간/연간) + 3개 카드 + 하단 고정 안내.
// 월간/연간은 별개 상품이 아니라 결제 방식(§2①), 할인율 대신 절감 금액·2개월 무료(§2②).
export default async function PlanComparePage() {
  const me = await getCurrentOwner();
  return (
    <div className="pb-24 bg-canvas min-h-[100dvh]">
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-3 flex items-center">
          <Link href="/o/membership" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="멤버십으로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
          <h1 className="text-[18px] font-bold text-ink tracking-title">플랜 비교</h1>
        </div>
      </div>
      <PlanCompare currentPlan={me.plan} currentBilling={me.plan === "Free" ? null : (me.billing ?? "monthly")} />
    </div>
  );
}
