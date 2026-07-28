"use client";
import { useState, type ReactNode } from "react";

/**
 * [관리] 페이지 헤더 토글 — [캠페인 | 예약관리] (2026-07-28 사장님 화면 개편).
 * 활성 타이틀은 잉크, 비활성은 뮤트 — 시안의 이중 타이틀 헤더. 뷰는 서버가 채워 전달.
 */
export default function ManageTabs({
  campaignsView,
  reservationsView,
}: {
  campaignsView: ReactNode;
  reservationsView: ReactNode;
}) {
  const [tab, setTab] = useState<"campaigns" | "reservations">("campaigns");
  return (
    <div>
      <div className="px-5 pt-12 pb-2 flex items-baseline gap-3.5">
        <button
          type="button"
          onClick={() => setTab("campaigns")}
          aria-pressed={tab === "campaigns"}
          className={`cp-action text-[20px] font-bold tracking-title ${tab === "campaigns" ? "text-ink" : "text-mutedSoft"}`}
        >
          캠페인
        </button>
        <button
          type="button"
          onClick={() => setTab("reservations")}
          aria-pressed={tab === "reservations"}
          className={`cp-action text-[20px] font-bold tracking-title ${tab === "reservations" ? "text-ink" : "text-mutedSoft"}`}
        >
          예약관리
        </button>
      </div>
      {tab === "campaigns" ? campaignsView : reservationsView}
    </div>
  );
}
