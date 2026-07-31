"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// 모집 한도 리필권 구매 (2026-07-31 BM 전략안) — 확인 바텀시트 → 즉시 적용.
// 결제(PG) 연동 전에는 멤버십과 동일하게 운영팀 수기 청구 SOP.
export default function RefillPurchase({ plan, grant, price }: { plan: string; grant: number; price: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function buy() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/owner/limit-refill", { method: "POST" });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(j.error || "구매에 실패했어요.");
      return;
    }
    setOpen(false);
    setMsg(`리필권 적용 완료 — 이번 달 모집 한도가 ${j.amount}건 늘었어요.`);
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cp-action w-full h-11 rounded-md bg-brand text-white text-[14px] font-bold"
      >
        {price.toLocaleString()}원에 {grant}건 리필하기
      </button>
      {msg && <p className="mt-2 text-[12px] font-medium text-brand">{msg}</p>}

      {open && (
        <div className="fixed inset-0 bg-ink/45 z-50 flex items-end" onClick={() => !busy && setOpen(false)}>
          <div className="w-full rounded-t-xl bg-canvas p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-3">
              <span className="w-9 h-1 rounded-pill bg-borderStrong" />
            </div>
            <h3 className="text-center text-[17px] font-bold text-ink tracking-title">모집 한도 리필권을 구매할까요?</h3>
            <div className="mt-4 rounded-lg bg-sunken p-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted">지급 수량</span>
                <span className="text-[15px] font-bold text-ink tabular-nums">{plan} 플랜 기준 {grant}건</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[13px] text-muted">가격</span>
                <span className="text-[15px] font-bold text-ink tabular-nums">{price.toLocaleString()}원</span>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5 text-[12px] text-ink2 leading-[1.55] list-disc pl-4">
              <li>구매 즉시 이번 달 모집 한도에 추가돼요.</li>
              <li>추가 한도는 <b>다음 결제일 전까지</b> 사용할 수 있고, 남은 수량은 다음 달로 이월되지 않아요.</li>
              <li>기존 한도를 먼저 사용한 뒤 리필 한도가 사용돼요.</li>
              <li>요금은 결제(PG) 연동 전까지 운영팀이 확인 후 청구해요.</li>
            </ul>
            {msg && <p className="mt-2 text-[12px] text-error">{msg}</p>}
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
                onClick={buy}
                disabled={busy}
                className="cp-action flex-1 h-12 rounded-md bg-brand text-white text-[15px] font-bold disabled:opacity-60"
              >
                {busy ? "적용 중..." : `${grant}건 리필하기`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
