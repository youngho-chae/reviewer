"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// 운영자 캠페인 조기 종료 (2026-07-24) — 정책은 사장님 종료와 동일 (campaign-close.ts 공유).
// 사장님에게 종료 알림이 발송된다.
export default function AdminCampaignClose({ campaignId, title }: { campaignId: string; title: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/admin/campaigns/close", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaignId }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "종료 처리 실패");
      setBusy(false);
      return;
    }
    setBusy(false);
    setConfirming(false);
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="cp-action h-8 px-3 rounded-sm border border-hairline bg-canvas text-[12px] font-semibold text-error shrink-0"
      >
        종료
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {err && <span className="text-[11px] text-error">{err}</span>}
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="cp-action h-8 px-2.5 rounded-sm border border-hairline bg-canvas text-[12px] font-semibold text-ink"
      >
        취소
      </button>
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        aria-label={`${title} 종료 확정`}
        className="cp-action h-8 px-2.5 rounded-sm bg-error text-white text-[12px] font-bold disabled:opacity-60"
      >
        {busy ? "처리 중..." : "종료 확정"}
      </button>
    </div>
  );
}
