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
        <div className="inline-flex bg-parchment rounded-pill p-1 gap-1 border border-hairline">
          <button
            onClick={() => setTab("visit")}
            className={`px-4 h-9 rounded-pill text-[13px] ${tab === "visit" ? "bg-canvas text-ink" : "text-muted"}`}
          >
            체험단 <span className="opacity-60">{visitCount}</span>
          </button>
          <button
            onClick={() => setTab("press")}
            className={`px-4 h-9 rounded-pill text-[13px] ${tab === "press" ? "bg-canvas text-ink" : "text-muted"}`}
          >
            기자단 <span className="opacity-60">{pressCount}</span>
          </button>
        </div>
      </div>
      <div className="mt-3">{tab === "visit" ? visitView : pressView}</div>
    </>
  );
}
