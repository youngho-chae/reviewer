"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VerifyOwnerButton({ ownerId }: { ownerId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function verify() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/admin/owners/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ownerId }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "처리 실패");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3">
      {err && <p className="mb-2 text-[12px] text-error">{err}</p>}
      <button
        onClick={verify}
        disabled={busy}
        className="cp-action w-full h-11 rounded-md bg-brand text-white text-[14px] font-bold disabled:opacity-60"
      >
        {busy ? "처리 중..." : "인증 완료 처리"}
      </button>
    </div>
  );
}
