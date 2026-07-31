"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// 대표 매장 지정 (2026-07-31) — 새 캠페인 생성의 매장 리스트 기본 선택이 된다.
export default function PrimaryStoreButton({ storeId, isPrimary }: { storeId: string; isPrimary: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (isPrimary) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-brandSoft text-brand text-[11px] font-bold">
        ★ 대표 매장
      </span>
    );
  }

  async function setPrimary() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/owner/primary-store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ storeId }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "지정에 실패했어요");
      setBusy(false);
      return;
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={setPrimary}
        disabled={busy}
        className="cp-action inline-flex items-center h-7 px-2.5 rounded-pill border border-hairline text-[11px] font-semibold text-ink2 disabled:opacity-50"
      >
        {busy ? "지정 중..." : "대표 매장으로 지정"}
      </button>
      {err && <span className="text-[11px] text-error">{err}</span>}
    </span>
  );
}
