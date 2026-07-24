"use client";
import { useState, type ReactNode } from "react";

/**
 * 캠페인 관리 내부 탭 (2026-07-23) — [예약 관리 | 후기 관리].
 *  - 예약 관리: 접수된 예약 확인·확정이 아니라(홈 [방문 예약] 큐 담당) **예약 가능 일정 차단**
 *    (당일 일시 정지·특정 날짜·특정 시간)을 제공한다. 예약형 캠페인 전용.
 *  - 후기 관리: 이 캠페인에 연결된 후기(작성 대기·심사 중·승인·반려)만 조회.
 * 내용은 서버에서 데이터를 채워 ReactNode로 전달받는다 (HomeQueues와 동일 문법).
 */
export default function ManageTabs({
  showReserve,
  reviewCount,
  reserveView,
  reviewView,
}: {
  showReserve: boolean; // 예약형 캠페인만 예약 관리 탭 노출 (방문형·배송형은 후기 관리 단독)
  reviewCount: number;
  reserveView: ReactNode;
  reviewView: ReactNode;
}) {
  const [tab, setTab] = useState<"reserve" | "review">(showReserve ? "reserve" : "review");

  if (!showReserve) return <>{reviewView}</>;

  const tabs = [
    { key: "reserve" as const, label: "🗓 예약 관리" },
    { key: "review" as const, label: `⭐ 후기 관리${reviewCount > 0 ? ` ${reviewCount}` : ""}` },
  ];

  return (
    <div className="mt-6">
      <div className="px-5 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={`cp-action h-10 px-4 rounded-pill text-[14px] tabular-nums ${
              tab === t.key ? "bg-ink text-white font-bold" : "bg-canvas border border-hairline text-ink font-medium"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "reserve" ? reserveView : reviewView}
    </div>
  );
}
