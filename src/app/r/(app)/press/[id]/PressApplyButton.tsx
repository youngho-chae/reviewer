"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PressApplyButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function apply() {
    setBusy(true); setErr(null);
    const res = await fetch("/api/passes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaignId }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "신청 실패");
      setBusy(false);
      return;
    }
    const { passId } = await res.json();
    router.push(`/r/press/${campaignId}/write?pass=${passId}`);
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={apply}
        disabled={busy}
        className="w-full h-14 rounded-full bg-ink text-white text-[16px] font-bold disabled:opacity-50"
      >
        {busy ? "신청 중..." : "참여 신청하기"}
      </button>
      {err && <div className="mt-2 text-[12px] text-error">{err}</div>}
    </div>
  );
}
