"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// 사용 전(active) 체험권 취소 — 확인 단계 후 POST /api/passes/cancel.
// 취소 시 모집 슬롯이 즉시 복구되므로, 방문이 어려우면 만료 방치보다 취소를 유도한다.
export default function CancelPassButton({ passId }: { passId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setErr(null);
    const res = await fetch("/api/passes/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passId }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "취소 실패");
      setLoading(false);
      return;
    }
    router.push("/r/passes");
    router.refresh();
  }

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="cp-action mt-4 text-[13px] text-muted underline">
        방문이 어려워요 — 참여 취소
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-md border border-hairline bg-parchment p-4 text-left w-full">
      <div className="text-[14px] font-semibold text-ink">참여를 취소할까요?</div>
      <p className="mt-1.5 text-[12px] text-muted leading-[1.5]">
        취소하면 이 체험권은 사용할 수 없고, 모집 자리는 다른 체험자에게 돌아갑니다.
      </p>
      {err && <div className="mt-2 text-[12px] text-error">{err}</div>}
      <div className="mt-3 flex gap-2">
        <button
          disabled={loading}
          onClick={submit}
          className="cp-action h-10 px-4 rounded-pill bg-ink text-white text-[13px] font-medium disabled:opacity-50"
        >
          {loading ? "취소 중..." : "참여 취소"}
        </button>
        <button
          disabled={loading}
          onClick={() => setConfirming(false)}
          className="cp-action h-10 px-4 rounded-pill border border-hairline text-ink text-[13px] bg-canvas"
        >
          계속 사용할게요
        </button>
      </div>
    </div>
  );
}
