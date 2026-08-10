"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLAN_POLICY, PLAN_BENEFITS, type PlanKey } from "@/lib/plan-policy";
import {
  PLAN_PRICE,
  yearlyPrice,
  yearlyListPrice,
  yearlySavings,
  yearlyMonthlyEquivalent,
} from "@/lib/limit-refill";

// 플랜 비교 (2026-08-10 설계안 ②) — 결제 방식 토글 + Basic/Standard/Premium 3카드.
//  · 연간 = 절감 금액·2개월 무료·월 환산 표기 (할인율 금지 — §2②)
//  · 현재 플랜+결제 방식 카드 = "이용 중인 플랜" 비활성 · 퍼플 아웃라인
//  · 하단 고정 안내: "연간으로 결제해도 언제든 월간으로 변경할 수 있어요." (§9)
type Billing = "monthly" | "yearly";
const PLANS: PlanKey[] = ["Basic", "Standard", "Premium"];

export default function PlanCompare({
  currentPlan,
  currentBilling,
}: {
  currentPlan: PlanKey;
  currentBilling: Billing | null; // Free = null
}) {
  const router = useRouter();
  const [billing, setBilling] = useState<Billing>(currentBilling ?? "yearly");
  const [busyPlan, setBusyPlan] = useState<PlanKey | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function start(plan: PlanKey) {
    setBusyPlan(plan);
    setErr(null);
    const res = await fetch("/api/owner/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan, billing }),
    });
    setBusyPlan(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "변경 실패");
      return;
    }
    router.push("/o/membership");
    router.refresh();
  }

  const billingLabel = billing === "yearly" ? "연간" : "월간";

  return (
    <div className="pb-16">
      {/* 결제 방식 토글 */}
      <div className="px-5 mt-2">
        <div className="text-[12px] text-muted mb-2">결제 방식</div>
        <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-sunken">
          {(["monthly", "yearly"] as Billing[]).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBilling(b)}
              aria-pressed={billing === b}
              className={`h-11 rounded-md text-[14px] font-semibold ${
                billing === b ? "bg-canvas text-ink shadow-sm font-bold" : "text-muted"
              }`}
            >
              {b === "monthly" ? "월간" : "연간 · 2개월 무료"}
            </button>
          ))}
        </div>
      </div>

      {/* 연간 안내 박스 (§2②) */}
      {billing === "yearly" && (
        <div className="mx-5 mt-3 rounded-md bg-brandSoft p-4">
          <div className="text-[13px] font-bold text-brand">1년 이용하면 2개월 요금이 무료예요</div>
          <p className="mt-1 text-[12px] text-ink2">연간으로 시작해도 언제든 월간으로 변경할 수 있어요.</p>
        </div>
      )}

      {/* 플랜 카드 */}
      <div className="px-5 mt-3 space-y-3">
        {PLANS.map((plan) => {
          const isCurrent = plan === currentPlan && currentBilling === billing;
          const benefits = PLAN_BENEFITS[plan];
          const headline = [benefits.catchpass[0], benefits.catchrank[0]].filter(Boolean);
          const price = billing === "yearly" ? yearlyPrice(plan) : PLAN_PRICE[plan];
          return (
            <div
              key={plan}
              className={`rounded-lg bg-canvas p-5 ${isCurrent ? "border-[1.5px] border-brand" : "border border-hairline"}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[17px] font-bold text-ink tracking-title">{plan}</span>
                {plan === "Standard" && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-[5px] bg-brand text-white text-[10px] font-bold">추천</span>
                )}
              </div>
              <div className="mt-0.5 text-[12px] text-muted">{benefits.tagline}</div>

              <div className="mt-3">
                {billing === "yearly" && (
                  <div className="text-[13px] text-mutedSoft line-through tabular-nums">{yearlyListPrice(plan).toLocaleString()}원</div>
                )}
                <div className="text-[24px] font-bold text-ink tabular-nums leading-tight">
                  {price.toLocaleString()}원 <span className="text-[13px] font-medium text-muted">/ {billing === "yearly" ? "년" : "월"}</span>
                </div>
                <div className="mt-1 text-[12px] font-semibold text-brand tabular-nums">
                  {billing === "yearly"
                    ? `${yearlySavings(plan).toLocaleString()}원 절약 · 2개월 무료 · 월 환산 약 ${yearlyMonthlyEquivalent(plan).toLocaleString()}원`
                    : `월 ${PLAN_POLICY[plan].monthlyTeamLimit}건 모집 한도`}
                </div>
              </div>

              {/* 대표 혜택 — 체험단 모집 → 플레이스 (§8) */}
              <ul className="mt-3.5 pt-3.5 border-t border-hairlineSoft space-y-1.5">
                {headline.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-[13px] text-ink">
                    <span className="shrink-0 text-successStrong" aria-hidden>✓</span>
                    {b}
                  </li>
                ))}
              </ul>

              <details className="mt-2.5 group">
                <summary className="cp-action list-none cursor-pointer text-center text-[13px] font-semibold text-ink2 py-1">
                  전체 혜택 보기 <span className="inline-block group-open:rotate-180 transition-transform" aria-hidden>⌄</span>
                </summary>
                <div className="mt-2 pt-2.5 border-t border-hairlineSoft space-y-2.5">
                  <div>
                    <div className="text-[11px] font-bold text-brand">• 캐치패스</div>
                    <ul className="mt-1 space-y-1">
                      {benefits.catchpass.map((b) => (
                        <li key={b} className="text-[12px] text-ink2">✓ {b}</li>
                      ))}
                    </ul>
                  </div>
                  {benefits.catchrank.length > 0 && (
                    <div>
                      <div className="text-[11px] font-bold text-brand">• 캐치랭크</div>
                      <ul className="mt-1 space-y-1">
                        {benefits.catchrank.map((b) => (
                          <li key={b} className="text-[12px] text-ink2">✓ {b}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>
                    <div className="text-[11px] font-bold text-muted">• 공통</div>
                    <ul className="mt-1 space-y-1">
                      {benefits.common.map((b) => (
                        <li key={b} className="text-[12px] text-ink2">✓ {b}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </details>

              {isCurrent ? (
                <div className="mt-3 h-12 rounded-md grid place-items-center text-[15px] font-bold text-brand/50">이용 중인 플랜</div>
              ) : (
                <button
                  type="button"
                  onClick={() => start(plan)}
                  disabled={busyPlan !== null}
                  className="cp-action mt-3 w-full h-12 rounded-md text-[15px] font-bold text-brand disabled:opacity-60"
                >
                  {busyPlan === plan
                    ? "변경 중..."
                    : plan === currentPlan
                      ? `${plan} ${billingLabel}으로 변경`
                      : `${plan} ${billingLabel} 시작하기`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {err && <p className="px-5 mt-3 text-[12px] text-error">{err}</p>}

      <p className="px-5 mt-4 text-[11px] text-muted leading-[1.6]">
        플랜 요금은 결제(PG) 연동 전까지 운영팀이 확인 후 청구하며, 미납 시 플랜이 Free로 조정될 수 있어요.
      </p>

      {/* 하단 고정 안내 (§9 — 연간 선택 시 고정 노출) */}
      {billing === "yearly" && (
        <div className="fixed bottom-[var(--bottom-nav-h,72px)] left-0 right-0 mx-auto max-w-[480px] bg-canvas border-t border-hairlineSoft z-20">
          <p className="px-5 py-3 text-center text-[12px] text-ink2">연간으로 결제해도 언제든 월간으로 변경할 수 있어요.</p>
        </div>
      )}
    </div>
  );
}
