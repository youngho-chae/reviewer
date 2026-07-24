"use client";
import { useState, type ReactNode } from "react";

/**
 * 내 캠페인 상태 필터 (2026-07-23) — [전체 | 진행중 | 종료] 칩.
 * 지금까지 오픈한 전체 캠페인을 상태별로 필터링해 보여준다 — 각 카드는 캠페인 관리
 * (/o/campaign/[id] — 예약 관리·후기 관리)로 진입한다. 뷰는 서버에서 채워 ReactNode로 전달.
 */
export default function CampaignFilter({
  allCount,
  openCount,
  closedCount,
  allView,
  openView,
  closedView,
}: {
  allCount: number;
  openCount: number;
  closedCount: number;
  allView: ReactNode;
  openView: ReactNode;
  closedView: ReactNode;
}) {
  const [filter, setFilter] = useState<"all" | "open" | "closed">("open");

  const chips = [
    { key: "all" as const, label: `전체 ${allCount}` },
    { key: "open" as const, label: `진행중 ${openCount}` },
    { key: "closed" as const, label: `종료 ${closedCount}` },
  ];

  return (
    <div>
      <div className="px-5 mb-3 flex gap-1.5">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            aria-pressed={filter === c.key}
            className={`cp-action h-9 px-3.5 rounded-pill text-[13px] tabular-nums ${
              filter === c.key ? "bg-ink text-white font-bold" : "bg-canvas border border-hairline text-ink2 font-medium"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      {filter === "all" ? allView : filter === "open" ? openView : closedView}
    </div>
  );
}
