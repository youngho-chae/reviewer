"use client";
import { useState, type ReactNode } from "react";

export default function CampaignTabs({
  visitCount,
  pressCount,
  visitView,
  pressView,
}: {
  visitCount: number;
  pressCount: number;
  visitView: ReactNode;
  pressView: ReactNode;
}) {
  const [tab, setTab] = useState<"visit" | "press">("visit");

  return (
    <>
      <div className="px-5 mt-3">
        {/* category-chip — 선택 = 검정 1.5px 보더 (필터 선택 문법) */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab("visit")}
            className={`px-4 h-9 rounded-pill text-[13px] bg-canvas ${tab === "visit" ? "border-[1.5px] border-ink text-ink font-semibold" : "border border-hairline text-muted font-medium"}`}
          >
            체험단 <span className="opacity-60 tabular-nums">{visitCount}</span>
          </button>
          <button
            onClick={() => setTab("press")}
            className={`px-4 h-9 rounded-pill text-[13px] bg-canvas ${tab === "press" ? "border-[1.5px] border-ink text-ink font-semibold" : "border border-hairline text-muted font-medium"}`}
          >
            기자단 <span className="opacity-60 tabular-nums">{pressCount}</span>
          </button>
        </div>
      </div>
      <div className="mt-3">{tab === "visit" ? visitView : pressView}</div>
    </>
  );
}
