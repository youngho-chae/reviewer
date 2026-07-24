"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";

/** 관심 목록 하트 토글 — 캠페인 단위 저장 (2026-07-07 회의).
 *  게스트(2026-07-24)는 저장 대신 로그인으로 유도한다 (로그인 후 이 상세로 복귀). */
export default function InterestToggle({
  campaignId,
  initialSaved,
  guest = false,
  loginHref = "/r/login",
}: {
  campaignId: string;
  initialSaved: boolean;
  guest?: boolean;
  loginHref?: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (guest) {
      router.push(loginHref);
      return;
    }
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
