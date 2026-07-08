"use client";
import { useState } from "react";
import Icon from "@/components/Icon";

/** 관심 목록 하트 토글 — 캠페인 단위 저장 (2026-07-07 회의) */
export default function InterestToggle({
  campaignId,
  initialSaved,
}: {
  campaignId: string;
  initialSaved: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setSaved((v) => !v); // optimistic
    try {
      const res = await fetch("/api/interests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      if (res.ok) {
        const j = await res.json();
        setSaved(!!j.saved);
      } else {
        setSaved((v) => !v); // rollback
      }
    } catch {
      setSaved((v) => !v);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`cp-action w-10 h-10 rounded-full flex items-center justify-center ${saved ? "text-brand" : "text-ink"}`}
      aria-label={saved ? "관심 목록에서 제거" : "관심 목록에 저장"}
      aria-pressed={saved}
    >
      <Icon name="heart" variant={saved ? "bold" : "border"} size={22} />
    </button>
  );
}
