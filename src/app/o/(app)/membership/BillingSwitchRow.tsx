"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";

// 결제 방식 전환 행 (2026-08-10 설계안) — 연간 이용 중이면 [월간으로 변경], 월간이면
// [연간으로 변경 · 2개월 무료]. 확인 모달 1단계 후 plan API에 billing만 전달
// (plan 동일 — anchor 미갱신·모집 주기 유지).
export default function BillingSwitchRow({ plan, billing }: { plan: string; billing: "monthly" | "yearly" }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toYearly = billing === "monthly";

  async function apply() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/owner/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan, billing: toYearly ? "yearly" : "monthly" }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "변경 실패");
      return;
    }
    setConfirm(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="cp-action w-full flex items-center justify-between px-4 py-4 border-b border-hairlineSoft text-left"
      >
        <span className="text-[14px] font-semibold text-ink">
          {toYearly ? "연간으로 변경" : "월간으로 변경"}
          {toYearly && <span className="ml-1.5 text-[11px] font-semibold text-brand">2개월 무료</span>}
        </span>
        <Icon name="chevron-right" variant="border" size={14} className="text-mutedSoft" />
      </button>

      {confirm && (
        <div className="fixed inset-0 bg-ink/45 z-50 flex items-center justify-center px-8" onClick={() => setConfirm(false)}>
          <div className="bg-canvas w-full max-w-[340px] rounded-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[17px] font-bold text-ink tracking-title">
              {toYearly ? "연간 결제로 변경할까요?" : "월간 결제로 변경할까요?"}
            </h2>
            <p className="mt-2 text-[13px] text-ink2 leading-[1.6]">
              {toYearly
                ? "연간은 10개월분 요금으로 12개월 이용하는 결제 방식이에요. 연간으로 시작해도 언제든 월간으로 변경할 수 있어요."
                : "이용한 기간은 월간 정상요금으로 다시 계산하고 남은 금액을 돌려드려요. 모집 주기와 남은 한도는 그대로 유지돼요."}
            </p>
            {err && <p className="mt-2 text-[12px] text-error">{err}</p>}
            <div className="mt-5 flex gap-2">
              <button onClick={() => setConfirm(false)} className="cp-action h-11 px-4 rounded-md bg-sunken text-[14px] font-semibold text-ink">
                취소
              </button>
              <button
                onClick={apply}
                disabled={busy}
                className="cp-action flex-1 h-11 rounded-md bg-brand text-white text-[14px] font-bold disabled:opacity-60"
              >
                {busy ? "변경 중..." : toYearly ? "연간으로 변경" : "월간으로 변경"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
