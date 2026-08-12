"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";

// 멤버십 해지 행 (2026-08-11 — **임시 활성**: 결제(PG)·환불 정산 연동 전이지만 Free 전환
// 경로를 열어둔다. 확인 모달 1단계 후 plan API로 Free 전환 — billing은 서버가 함께 소거,
// planStartedAt 갱신(주기 재시작)은 plan API 기존 규칙 그대로. 환불·정산은 운영팀 수기(§3).
export default function CancelMembershipRow({ plan }: { plan: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function apply() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/owner/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan: "Free" }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "해지 처리에 실패했어요");
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
        className="cp-action w-full flex items-center justify-between px-4 py-4 text-left"
      >
        <span className="text-[14px] font-semibold text-ink">멤버십 해지</span>
        <Icon name="chevron-right" variant="border" size={14} className="text-mutedSoft" />
      </button>

      {confirm && (
        <div className="fixed inset-0 bg-ink/45 z-50 flex items-center justify-center px-8" onClick={() => setConfirm(false)}>
          <div className="bg-canvas w-full max-w-[340px] rounded-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[17px] font-bold text-ink tracking-title">멤버십을 해지할까요?</h2>
            <p className="mt-2 text-[13px] text-ink2 leading-[1.6]">
              해지하면 <span className="font-bold text-ink">Free 플랜</span>으로 전환되고 모집 한도가 월 5팀으로
              줄어요. 진행 중인 캠페인과 보유 리필권은 그대로 유지돼요.
            </p>
            <p className="mt-2 text-[12px] text-muted leading-[1.6]">
              남은 기간 정산·환불은 운영팀이 확인 후 처리해요 (이용약관 제10조).
            </p>
            {err && <p className="mt-2 text-[12px] text-error">{err}</p>}
            <div className="mt-5 flex gap-2">
              <button onClick={() => setConfirm(false)} className="cp-action h-11 px-4 rounded-md bg-sunken text-[14px] font-semibold text-ink">
                취소
              </button>
              <button
                onClick={apply}
                disabled={busy}
                className="cp-action flex-1 h-11 rounded-md bg-error text-white text-[14px] font-bold disabled:opacity-60"
              >
                {busy ? "처리 중..." : `${plan} 해지하고 Free로 전환`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
