"use client";
import { useState } from "react";
import Icon from "@/components/Icon";

// 주소 행 + 복사 버튼 — 복사 성공 시 1.8초간 "복사됨" 피드백
export default function AddressCopy({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(address);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {}
      }}
      className="cp-action mt-2 inline-flex items-center gap-1.5 text-[13px] text-ink2"
      aria-label="주소 복사"
    >
      <Icon name="pin" variant="bold" size={14} className="text-ink" />
      <span>{address}</span>
      {copied ? (
        <span className="text-brand font-semibold">복사됨</span>
      ) : (
        <Icon name="copy" variant="border" size={14} className="text-muted" />
      )}
    </button>
  );
}
