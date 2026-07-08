"use client";
import { useState, type ReactNode } from "react";

export default function PassesTabs({
  visitCount,
  pressCount,
  visitView,
  pressView,
  showPress = true,
}: {
  visitCount: number;
  pressCount: number;
  visitView: ReactNode;
  pressView: ReactNode;
  // [MVP] 기자단 제외 — 과거 기자단 패스가 없으면 탭 자체를 숨긴다 (src/lib/flags.ts)
  showPress?: boolean;
}) {
  const [tab, setTab] = useState<"visit" | "press">("visit");

  if (!showPress) return <>{visitView}</>;

  return (
    <>
      {/* category-chip 문법 — 필터 선택 = 검정 1.5px 보더 */}
      <div className="px-5 mt-4 flex gap-2">
        <button
          onClick={() => setTab("visit")}
          aria-pressed={tab === "visit"}
          className={`h-10 px-4 rounded-pill text-[14px] bg-canvas whitespace-nowrap ${
            tab === "visit" ? "border-[1.5px] border-ink text-ink font-semibold" : "border border-hairline text-ink2 font-medium"
          }`}
        >
          방문형 패스 <span className="text-muted tabular-nums">{visitCount}</span>
        </button>
        <button
          onClick={() => setTab("press")}
          aria-pressed={tab === "press"}
          className={`h-10 px-4 rounded-pill text-[14px] bg-canvas whitespace-nowrap ${
            tab === "press" ? "border-[1.5px] border-ink text-ink font-semibold" : "border border-hairline text-ink2 font-medium"
          }`}
        >
          기자단 <span className="text-muted tabular-nums">{pressCount}</span>
        </button>
      </div>
      {tab === "visit" ? visitView : pressView}
    </>
  );
}
