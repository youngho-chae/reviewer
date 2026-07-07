"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Plan = "Free" | "Basic" | "Standard" | "Premium";

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
      <div className="text-[14px] font-bold text-ink mb-2">플랜 변경</div>
      {/* radio-select — 데이터 선택 = 퍼플 1.5px 보더 */}
      <div className="grid grid-cols-4 gap-2">
        {(["Free", "Basic", "Standard", "Premium"] as Plan[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPlan(p)}
            className={`h-11 rounded-md text-[13px] bg-canvas ${plan === p ? "border-[1.5px] border-brand text-brand font-semibold" : "border border-hairline text-ink font-medium"}`}
          >
            {p}
          </button>
        ))}
      </div>
      <button
        onClick={change}
        disabled={busy || plan === current}
        className="mt-3 w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
      >
        {busy ? "변경 중..." : plan === current ? "현재 플랜과 동일" : `${plan} 플랜으로 변경`}
      </button>
      <p className="mt-2 text-[11px] text-muted leading-[1.5]">
        변경 즉시 모집 정책이 적용됩니다. 유료 플랜 요금은 결제(PG) 연동 전까지 운영팀이 확인 후 청구하며,
        미납 시 플랜이 Free로 조정될 수 있어요.
      </p>
      {msg && <div className="mt-2 text-[12px] text-muted">{msg}</div>}
    </div>
  );
}
