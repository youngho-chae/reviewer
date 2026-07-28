"use client";
import { useState, type ReactNode } from "react";

/**
 * 캠페인 관리 내부 탭 (2026-07-23 · 2026-07-28 개편) — [예약관리 | 상태관리 | 후기 관리].
 *  - 예약관리: [관리]-[예약관리]와 동일한 기능을 이 캠페인 범위로 제공 (매장 필터 없음) —
 *    상태 칩 + 예약 카드([예약 정보] 상세 이동 · [예약 확정]). 예약형·미종료 전용.
 *  - 상태관리(구 '예약 관리' — 예약관리 탭 신설로 네이밍 겹쳐 변경): 예약 가능 일정 차단
 *    (당일 일시 정지·특정 날짜·특정 시간). 예약형·미종료 전용.
 *  - 후기 관리: 이 캠페인에 연결된 후기(작성 대기·심사 중·승인·반려)만 조회.
 * 내용은 서버에서 데이터를 채워 ReactNode로 전달받는다.
 */
export default function ManageTabs({
  showReserve,
  reservationCount,
  reviewCount,
  reservationsView,
  statusView,
  reviewView,
}: {
  showReserve: boolean; // 예약형(미종료)만 예약관리·상태관리 탭 노출 (그 외 후기 관리 단독)
  reservationCount: number;
  reviewCount: number;
  reservationsView: ReactNode;
  statusView: ReactNode;
  reviewView: ReactNode;
}) {
  const [tab, setTab] = useState<"reservations" | "status" | "review">(showReserve ? "reservations" : "review");

  if (!showReserve) return <>{reviewView}</>;

  const tabs = [
    { key: "reservations" as const, label: `📅 예약관리${reservationCount > 0 ? ` ${reservationCount}` : ""}` },
    { key: "status" as const, label: "🗓 상태관리" },
    { key: "review" as const, label: `⭐ 후기 관리${reviewCount > 0 ? ` ${reviewCount}` : ""}` },
  ];

  return (
    <div className="mt-6">
      <div className="px-5 flex gap-2 overflow-x-auto scrollbar-none">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={`cp-action h-10 px-4 rounded-pill text-[14px] tabular-nums whitespace-nowrap shrink-0 ${
              tab === t.key ? "bg-ink text-white font-bold" : "bg-canvas border border-hairline text-ink font-medium"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "reservations" ? reservationsView : tab === "status" ? statusView : reviewView}
    </div>
  );
}
