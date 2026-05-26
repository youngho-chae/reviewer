"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewActions({ passId }: { passId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    await fetch("/api/passes/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passId, decision }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mt-3 flex gap-2">
      <button disabled={busy} onClick={() => decide("reject")} className="flex-1 h-10 rounded-sm border border-hairline text-[13px] disabled:opacity-50">반려</button>
      <button disabled={busy} onClick={() => decide("approve")} className="flex-1 h-10 rounded-sm bg-ink text-white text-[13px] font-medium disabled:opacity-50">통과</button>
    </div>
  );
}
