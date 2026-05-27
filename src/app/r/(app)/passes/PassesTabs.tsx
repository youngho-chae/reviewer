"use client";
import { useState, type ReactNode } from "react";

export default function PassesTabs({
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
      <div className="px-6 mt-6">
        <div className="inline-flex bg-parchment rounded-pill p-1 gap-1 border border-hairline">
          <button
            onClick={() => setTab("visit")}
            className={`px-4 h-9 rounded-pill text-[14px] ${tab === "visit" ? "bg-canvas text-ink" : "text-muted"}`}
          >
            방문형 패스 <span className="opacity-60">{visitCount}</span>
          </button>
          <button
            onClick={() => setTab("press")}
            className={`px-4 h-9 rounded-pill text-[14px] ${tab === "press" ? "bg-canvas text-ink" : "text-muted"}`}
          >
            기자단 <span className="opacity-60">{pressCount}</span>
          </button>
        </div>
      </div>
      {tab === "visit" ? visitView : pressView}
    </>
  );
}
