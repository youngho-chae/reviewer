"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// 인증 회수 (2026-09-07 감사 개편) — 즉시 승인 체계의 오승인·데모 통과·타인 번호 도용을
// pending으로 되돌린다 (2단 확인 — 사장님 화면이 인증 대기로 게이트되는 처분).
export default function RevokeOwnerButton({ ownerId }: { ownerId: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function revoke() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/admin/owners/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ownerId, action: "revoke" }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "처리 실패");
      setBusy(false);
      setConfirm(false);
      return;
    }
    router.refresh();
  }

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="cp-action text-[11px] px-2 py-0.5 rounded-pill border border-hairline text-muted font-semibold"
      >
        인증 회수
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      {err && <span className="text-[11px] text-error">{err}</span>}
      <button
        onClick={revoke}
        disabled={busy}
        className="cp-action text-[11px] px-2 py-0.5 rounded-pill bg-error text-white font-semibold disabled:opacity-60"
      >
        {busy ? "..." : "회수 확정"}
      </button>
      <button onClick={() => setConfirm(false)} disabled={busy} className="cp-action text-[11px] px-2 py-0.5 rounded-pill bg-sunken text-ink">
        취소
      </button>
    </span>
  );
}
