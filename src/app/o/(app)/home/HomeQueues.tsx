"use client";
import { useState, type ReactNode } from "react";
import { DELIVERY_ENABLED } from "@/lib/flags";

/**
 * 사장님 홈 내부 큐 탭 (2026-07-16 회의) — [방문 예약 | 발송 대기]를 각각 볼 수 있는 탭.
 * 내용(ReservationQueue/ShipQueue)은 서버에서 데이터를 채워 ReactNode로 전달받는다.
 */
export default function HomeQueues({
  reservationCount,
  shipCount,
  reservationView,
  shipView,
}: {
  reservationCount: number;
  shipCount: number;
  reservationView: ReactNode;
  shipView: ReactNode;
}) {
  // 기본 탭: 방문 예약 (예약 0건 + 발송 대기만 있으면 발송 대기로)
  const [tab, setTab] = useState<"reserve" | "ship">(reservationCount === 0 && shipCount > 0 ? "ship" : "reserve");

  const tabs = [
    { key: "reserve" as const, label: `📅 방문 예약${reservationCount > 0 ? ` ${reservationCount}` : ""}` },
    // 발송 대기 — 배송형 비활성(main 릴리스) 시 탭 자체를 숨긴다 (과거 배송 건 보유 시 유지)
    ...(DELIVERY_ENABLED || shipCount > 0
      ? [{ key: "ship" as const, label: `📦 발송 대기${shipCount > 0 ? ` ${shipCount}` : ""}` }]
      : []),
  ];

  return (
    <div className="mt-5">
      <div className="px-5 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={`cp-action h-10 px-4 rounded-pill text-[14px] tabular-nums ${
              tab === t.key
                ? "bg-ink text-white font-bold"
                : "bg-canvas border border-hairline text-ink font-medium"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "reserve" ? (
        reservationCount > 0 ? (
          reservationView
        ) : (
          <div className="mx-5 mt-3 rounded-lg border border-dashed border-hairline p-6 text-center text-[13px] text-muted">
            방문 예약 신청이 아직 없어요 · 예약형 캠페인에 신청이 들어오면 여기에서 확인·제안할 수 있어요.
          </div>
        )
      ) : shipCount > 0 ? (
        shipView
      ) : (
        <div className="mx-5 mt-3 rounded-lg border border-dashed border-hairline p-6 text-center text-[13px] text-muted">
          발송 대기 건이 없어요 · 배송형 캠페인에 신청이 들어오면 여기에서 발송 처리할 수 있어요.
        </div>
      )}
    </div>
  );
}
