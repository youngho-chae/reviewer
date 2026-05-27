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
      <div className="px-5">
        <div className="flex bg-surfaceSoft border border-hairline rounded-md p-1 gap-1">
          <button
            onClick={() => setTab("visit")}
            className={`flex-1 h-10 rounded-sm text-[13px] font-bold ${tab === "visit" ? "bg-ink text-white" : "text-ink2"}`}
          >
            🍽️ 방문형 패스 <span className="opacity-70">{visitCount}</span>
          </button>
          <button
            onClick={() => setTab("press")}
            className={`flex-1 h-10 rounded-sm text-[13px] font-bold ${tab === "press" ? "bg-ink text-white" : "text-ink2"}`}
          >
            ✍️ 기자단 <span className="opacity-70">{pressCount}</span>
          </button>
        </div>
      </div>
      {tab === "visit" ? visitView : pressView}
    </>
  );
}
