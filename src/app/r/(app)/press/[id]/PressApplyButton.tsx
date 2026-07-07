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
    if (!passId) {
      setErr("발급에 실패했어요. 다시 시도해주세요.");
      setBusy(false);
      return;
    }
    // 인스턴스 간 동기화를 위한 1회 새로고침 후 이동.
    router.refresh();
    router.push(`/r/press/${campaignId}/write?pass=${passId}`);
  }

  return (
    <div>
      <button
        onClick={apply}
        disabled={busy}
        className="cp-action w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:opacity-50"
      >
        {busy ? "신청 중..." : "참여 신청하기"}
      </button>
      {err && <div className="mt-2 text-[12px] text-error">{err}</div>}
    </div>
  );
}
