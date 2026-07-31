"use client";
import { useState, type ReactNode } from "react";

/**
 * 캠페인 상세 내부 탭 (2026-07-31 개편) — 시안: 상단 풀폭 언더라인 탭.
 *  - 캠페인 관리: 사진·배지·모집 현황 타일·[캠페인 종료하기]·기본 정보·모집 조건·매장 정보 +
 *    (예약형·미종료) 예약 일정 관리(당일 일시중지·날짜/시간 차단 — 구 '상태관리' 탭 흡수).
 *  - 예약관리: [관리]-[예약관리]와 동일 기능을 이 캠페인 범위로 (예약형·미종료 전용).
 *  - 후기: 이 캠페인에 연결된 후기(작성 대기·심사 중·승인·반려)만 조회.
 * 내용은 서버에서 데이터를 채워 ReactNode로 전달받는다. 시안 블루 액센트는 v2 규칙(퍼플)로 치환.
 */
export default function ManageTabs({
  showReserve,
  reservationCount,
  reviewCount,
  infoView,
  reservationsView,
  reviewView,
}: {
  showReserve: boolean; // 예약형(미종료)만 예약관리 탭 노출
  reservationCount: number;
  reviewCount: number;
  infoView: ReactNode;
  reservationsView: ReactNode;
  reviewView: ReactNode;
}) {
  const [tab, setTab] = useState<"info" | "reservations" | "review">("info");

  const tabs = [
    { key: "info" as const, label: "캠페인 관리" },
    ...(showReserve
      ? [{ key: "reservations" as const, label: `예약 관리${reservationCount > 0 ? ` ${reservationCount}` : ""}` }]
      : []),
    { key: "review" as const, label: `후기${reviewCount > 0 ? ` ${reviewCount}` : ""}` },
  ];

  return (
    <div>
      <div className="px-5 flex border-b border-hairline">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={`cp-action flex-1 h-11 -mb-px border-b-2 text-[15px] tabular-nums whitespace-nowrap ${
              tab === t.key ? "border-brand text-brand font-bold" : "border-transparent text-muted font-medium"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "info" ? infoView : tab === "reservations" ? reservationsView : reviewView}
    </div>
  );
}
