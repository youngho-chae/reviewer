"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLAN_BENEFITS, type PlanKey } from "@/lib/plan-policy";
import {
  PLAN_PRICE,
  yearlyPrice,
  yearlyListPrice,
  yearlyCostPerTeam,
  costBucketLabel,
} from "@/lib/limit-refill";
import { openPaymentTestWindow } from "@/lib/payment";

// 전체 플랜 (2026-08-12 와이어프레임 개편) — 구 결제 방식 토글(월간|연간 탭) 폐기.
//  · 카드 안에 [월간 구독|연간 구독] 라디오 2행 — 전 카드 통틀어 단일 선택(플랜+방식 조합)
//  · 연간 행 = 정가 취소선 + "10개월 + [2개월 무료]" 칩 + "체험단 모집 한 팀당 n원대"
//    (미선택도 프로모 오렌지 아웃라인으로 상시 강조 — 선택 시 퍼플+틴트)
//  · 이용 중인 조합 = 라디오 비활성 + "이용 중" 오렌지 칩 (선택 불가)
//  · 기본 선택: Free 사장님 = Standard 월간 / 유료 구독 중 = 없음(CTA "플랜 선택" 비활성)
//  · 하단 고정: "연간으로 결제해도 언제든 월간으로 변경할 수 있어요." + [{플랜} (연간) 구독하기]
type Billing = "monthly" | "yearly";
const PLANS: PlanKey[] = ["Basic", "Standard", "Premium"];

// 대표 혜택의 수량 부분("월 15건"·"2곳" 등) 볼드 강조 (와이어프레임 — v2: 검정 볼드 = 가치)
function boldNums(text: string) {
  const parts = text.split(/(월 [\d,]+건|[\d,]+곳|[\d,]+건|[\d,]+개)/g);
  return parts.map((p, i) => (i % 2 === 1 ? <b key={i} className="font-bold text-ink">{p}</b> : p));
}

function Radio({ on, dim }: { on: boolean; dim?: boolean }) {
  return (
    <span
      aria-hidden
      className={`shrink-0 w-5 h-5 rounded-full border-[1.5px] grid place-items-center ${
        on ? "border-brand" : dim ? "border-hairline" : "border-borderStrong"
      }`}
    >
      {on && <span className="w-2.5 h-2.5 rounded-full bg-brand" />}
    </span>
  );
}

export default function PlanCompare({
  currentPlan,
  currentBilling,
}: {
  currentPlan: PlanKey;
  currentBilling: Billing | null; // Free = null
}) {
  const router = useRouter();
  const isFree = currentPlan === "Free";
  // 기본 선택 — Free는 Standard 월간, 유료 구독 중은 미선택 (와이어프레임 1·3)
  const [sel, setSel] = useState<{ plan: PlanKey; billing: Billing } | null>(
    isFree ? { plan: "Standard", billing: "monthly" } : null,
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isCurrent = (plan: PlanKey, billing: Billing) => plan === currentPlan && billing === currentBilling;
  const isSel = (plan: PlanKey, billing: Billing) => sel?.plan === plan && sel?.billing === billing;

  async function subscribe() {
    if (!sel) return;
    // 결제 테스트 모듈 (2026-08-30, 정본 src/lib/payment.ts) — 팝업 차단 회피를 위해 await 이전 동기 호출
    openPaymentTestWindow();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/owner/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan: sel.plan, billing: sel.billing }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "변경 실패");
      return;
    }
    router.push("/o/membership");
    router.refresh();
  }

  return (
    <div className="pb-44">
      {/* 프로모 배너 (와이어프레임) — 연간 = 2개월 무료 */}
      <div className="mx-5 mt-2 rounded-lg bg-sunken px-5 py-5">
        <div className="text-[14px] text-ink">연간 구독하면</div>
        <div className="mt-0.5 text-[20px] font-bold text-ink tracking-title">2개월 요금이 무료!</div>
        <div className="mt-2 inline-block bg-ink text-white text-[11px] px-1.5 py-1 rounded-[4px]">
          * 연간으로 결제해도 언제든 월간으로 변경 가능
        </div>
      </div>

      {/* 플랜 카드 */}
      <div className="px-5 mt-4 space-y-4">
        {PLANS.map((plan) => {
          const benefits = PLAN_BENEFITS[plan];
          const cardSelected = sel?.plan === plan;
          const monthlyCurrent = isCurrent(plan, "monthly");
          const yearlyCurrent = isCurrent(plan, "yearly");
          return (
            <div
              key={plan}
              className={`rounded-lg bg-canvas p-4 ${cardSelected ? "border-[1.5px] border-brand" : "border border-hairline"}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[19px] font-bold text-ink tracking-title">{plan}</span>
                {plan === "Standard" && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-[5px] bg-errorSoft text-[11px] font-bold text-error">
                    🔥 추천 플랜
                  </span>
                )}
              </div>

              {/* 대표 혜택 2줄 — 수량 볼드 (와이어프레임) */}
              <ul className="mt-2.5 space-y-1.5">
                {[benefits.catchpass[0], benefits.catchrank[0]].filter(Boolean).map((b) => (
                  <li key={b} className="flex items-start gap-2 text-[14px] text-ink2">
                    <span className="shrink-0 text-successStrong font-bold" aria-hidden>✓</span>
                    <span>{boldNums(b!)}</span>
                  </li>
                ))}
              </ul>

              {/* 월간 구독 라디오 */}
              <button
                type="button"
                disabled={monthlyCurrent}
                onClick={() => setSel({ plan, billing: "monthly" })}
                aria-pressed={isSel(plan, "monthly")}
                className={`cp-action mt-3.5 w-full rounded-md px-3.5 py-3.5 flex items-center gap-2.5 text-left ${
                  isSel(plan, "monthly")
                    ? "border-[1.5px] border-brand bg-brandSoft"
                    : monthlyCurrent
                      ? "border border-hairline bg-sunken"
                      : "border border-hairline"
                }`}
              >
                <Radio on={isSel(plan, "monthly")} dim={monthlyCurrent} />
                <span className={`text-[14px] font-semibold ${monthlyCurrent ? "text-mutedSoft" : "text-ink"}`}>월간 구독</span>
                {monthlyCurrent && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-[#FF6B00] text-white text-[11px] font-bold">이용 중</span>
                )}
                <span className={`ml-auto text-[15px] font-bold tabular-nums ${monthlyCurrent ? "text-mutedSoft" : "text-ink"}`}>
                  월 {PLAN_PRICE[plan].toLocaleString()}원
                </span>
              </button>

              {/* 연간 구독 라디오 — 미선택도 프로모 오렌지 아웃라인 (와이어프레임) */}
              <button
                type="button"
                disabled={yearlyCurrent}
                onClick={() => setSel({ plan, billing: "yearly" })}
                aria-pressed={isSel(plan, "yearly")}
                className={`cp-action mt-2 w-full rounded-md px-3.5 py-3.5 text-left ${
                  isSel(plan, "yearly")
                    ? "border-[1.5px] border-brand bg-brandSoft"
                    : yearlyCurrent
                      ? "border border-hairline bg-sunken"
                      : "border-[1.5px] border-[#FF9A3D]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Radio on={isSel(plan, "yearly")} dim={yearlyCurrent} />
                  <span className={`text-[14px] font-semibold ${yearlyCurrent ? "text-mutedSoft" : "text-ink"}`}>연간 구독</span>
                  {yearlyCurrent && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-[#FF6B00] text-white text-[11px] font-bold">이용 중</span>
                  )}
                  <span className="ml-auto text-right">
                    <span className={`block text-[15px] font-bold tabular-nums ${yearlyCurrent ? "text-mutedSoft" : "text-ink"}`}>
                      년 {yearlyPrice(plan).toLocaleString()}원
                    </span>
                    <span className="block text-[11px] text-mutedSoft line-through tabular-nums">
                      정가 {yearlyListPrice(plan).toLocaleString()}원
                    </span>
                  </span>
                </div>
                <div className="mt-2 pl-[30px] flex items-center gap-1.5">
                  <span className="text-[13px] font-bold text-ink tabular-nums">10개월</span>
                  <span className="text-[13px] text-ink" aria-hidden>+</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-brand text-white text-[11px] font-bold">2개월 무료</span>
                </div>
                <div className="mt-1.5 pl-[30px] text-[13px] text-ink2 tabular-nums">
                  체험단 모집 한 팀당 <b className="text-ink">{costBucketLabel(yearlyCostPerTeam(plan))}</b>
                </div>
              </button>

              {/* 전체 혜택 보기 — 캐치패스·캐치랭크 전체 목록 접힘 */}
              <details className="mt-2.5 group">
                <summary className="cp-action list-none cursor-pointer text-center text-[13px] font-semibold text-ink2 py-1.5">
                  전체 혜택 보기 <span className="inline-block group-open:rotate-180 transition-transform" aria-hidden>⌄</span>
                </summary>
                <div className="mt-1.5 pt-2.5 border-t border-hairlineSoft space-y-2.5">
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
                </div>
              </details>
            </div>
          );
        })}
      </div>

      {err && <p className="px-5 mt-3 text-[12px] text-error">{err}</p>}

      {/* 하단 고정 — 안내 + 구독 CTA (와이어프레임) */}
      <div className="fixed bottom-[var(--bottom-nav-h,72px)] left-0 right-0 mx-auto max-w-[480px] bg-canvas border-t border-hairlineSoft z-20 px-5 pt-2.5 pb-3">
        <p className="text-center text-[12px] text-ink2">연간으로 결제해도 언제든 월간으로 변경할 수 있어요.</p>
        <button
          type="button"
          onClick={subscribe}
          disabled={!sel || busy}
          className="cp-action mt-2 w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
        >
          {busy ? "처리 중..." : sel ? `${sel.plan}${sel.billing === "yearly" ? " 연간" : ""} 구독하기` : "플랜 선택"}
        </button>
      </div>
    </div>
  );
}
