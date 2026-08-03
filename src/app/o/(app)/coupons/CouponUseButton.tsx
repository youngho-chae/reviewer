"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// 쿠폰함 — 보유 리필권 개별 사용 (2026-07-31 2차 보완).
// 사용하면 이번 결제 주기 한도에 가산되고, 가산분은 이번 주기까지만 유효하다.
export default function CouponUseButton({ refillId, amount }: { refillId: string; amount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function useCoupon() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/owner/limit-refill/use", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refillId }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(j.error || "사용에 실패했어요.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cp-action shrink-0 h-9 px-3.5 rounded-md bg-brand text-white text-[13px] font-bold"
      >
        사용하기
      </button>
      {open && (
        <div className="fixed inset-0 bg-ink/45 z-50 flex items-end" onClick={() => !busy && setOpen(false)}>
          <div className="w-full rounded-t-xl bg-canvas p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-3">
              <span className="w-9 h-1 rounded-pill bg-borderStrong" />
            </div>
            <h3 className="text-center text-[17px] font-bold text-ink tracking-title">이 리필권을 사용할까요?</h3>
            <p className="mt-2.5 text-center text-[13px] text-ink2 leading-[1.6]">
              사용하면 이번 결제 주기 모집 한도가 <b className="text-ink">{amount}건</b> 늘어나요.
              <br />
              추가된 한도는 이번 결제 주기까지만 유효해요.
            </p>
            {err && <p className="mt-2 text-center text-[12px] text-error">{err}</p>}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="cp-action w-[104px] h-12 rounded-md bg-sunken text-[15px] font-semibold text-ink disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={useCoupon}
                disabled={busy}
                className="cp-action flex-1 h-12 rounded-md bg-brand text-white text-[15px] font-bold disabled:opacity-60"
              >
                {busy ? "적용 중..." : "사용하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
