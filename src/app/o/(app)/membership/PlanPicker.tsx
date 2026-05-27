"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Plan = "Basic" | "Standard" | "Premium";

export default function PlanPicker({ current }: { current: Plan }) {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>(current);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function change() {
    if (plan === current) return;
    setBusy(true); setMsg(null);
    const res = await fetch("/api/owner/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error || "변경 실패");
      return;
    }
    setMsg(`${plan} 플랜으로 변경되었습니다`);
    router.refresh();
  }

  return (
    <div>
      <div className="text-[13px] font-semibold mb-2">플랜 변경</div>
      <div className="flex gap-2">
        {(["Basic", "Standard", "Premium"] as Plan[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPlan(p)}
            className={`flex-1 h-11 rounded-sm text-[13px] font-medium border ${plan === p ? "bg-ink text-white border-ink" : "border-hairline"}`}
          >
            {p}
          </button>
        ))}
      </div>
      <button
        onClick={change}
        disabled={busy || plan === current}
        className="mt-3 w-full h-12 rounded-sm bg-ink text-white text-[14px] font-medium disabled:opacity-40"
      >
        {busy ? "변경 중..." : plan === current ? "현재 플랜과 동일" : `${plan} 플랜으로 변경`}
      </button>
      {msg && <div className="mt-2 text-[12px] text-muted">{msg}</div>}
    </div>
  );
}
