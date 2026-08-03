"use client";
import { useState, type ReactNode } from "react";

/**
 * [관리] 페이지 헤더 토글 — [캠페인 | 예약 관리 | 리뷰 관리] (2026-07-28 개편 ·
 * 2026-08-03 리뷰 관리 병합 — 바텀 네비의 단독 '리뷰 관리' 메뉴를 이 탭으로 흡수).
 * 활성 타이틀은 잉크, 비활성은 뮤트 — 시안의 이중 타이틀 헤더. 뷰는 서버가 채워 전달.
 */
export type ManageTab = "campaigns" | "reservations" | "reviews";

export default function ManageTabs({
  campaignsView,
  reservationsView,
  reviewsView,
  initialTab = "campaigns",
}: {
  campaignsView: ReactNode;
  reservationsView: ReactNode;
  reviewsView: ReactNode;
  initialTab?: ManageTab; // 딥링크 — 홈 [예약 관리](?tab=reservations)·리뷰 알림(?tab=reviews)
}) {
  const [tab, setTab] = useState<ManageTab>(initialTab);
  const tabs: Array<{ key: ManageTab; label: string }> = [
    { key: "campaigns", label: "캠페인" },
    { key: "reservations", label: "예약 관리" },
    { key: "reviews", label: "리뷰 관리" },
  ];
  return (
    <div>
      <div className="px-5 pt-12 pb-2 flex items-baseline gap-3.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={`cp-action text-[19px] font-bold tracking-title whitespace-nowrap ${tab === t.key ? "text-ink" : "text-mutedSoft"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "campaigns" ? campaignsView : tab === "reservations" ? reservationsView : reviewsView}
    </div>
  );
}
