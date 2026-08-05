"use client";
import { useState } from "react";
import Link from "next/link";

/**
 * 홈 '진행 중인 캠페인' (2026-07-28 홈 개편 시안) — 유형 칩(전체/방문형/배송형) +
 * 신형 카드: [유형 다크 칩][즉시 입장(그린)/예약 필수(오렌지)] … 모집 마감 D-n →
 * 썸네일(2026-08-05 시안 — 체험자 체험권 화면과 동일 88×66 4:3) + 캠페인명(2줄)·매장명
 * → 타일 2개(방문 예정|예약 확인 필요 · 사용 완료 n/총).
 * 기자단은 이 브랜치에서 코드째 제거라 미노출. 카드 = 캠페인 관리 진입.
 */
export interface HomeCampaignItem {
  id: string;
  kind: "visit" | "delivery";
  reserveRequired: boolean;
  title: string;
  storeName: string;
  thumb: string; // 캠페인 대표 썸네일 (coverForCampaign — 서버에서 계산)
  daysLeft: number; // 모집 마감까지 (일)
  pendingLabel: string; // "방문 예정" | "예약 확인 필요" | "발송 대기"
  pendingCount: number;
  usedCount: number;
  totalQuota: number;
}

export default function HomeCampaigns({
  items,
  showDelivery,
}: {
  items: HomeCampaignItem[];
  showDelivery: boolean;
}) {
  const [filter, setFilter] = useState<"all" | "visit" | "delivery">("all");
  const chips = [
    { key: "all" as const, label: "전체" },
    { key: "visit" as const, label: "방문형" },
    ...(showDelivery ? [{ key: "delivery" as const, label: "배송형" }] : []),
  ];
  const visible = items.filter((it) => filter === "all" || it.kind === filter);

  return (
    <div>
      <div className="px-5 flex gap-1.5 overflow-x-auto scrollbar-none">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            aria-pressed={filter === c.key}
            className={`cp-action h-9 px-4 rounded-pill text-[13px] whitespace-nowrap shrink-0 ${
              filter === c.key
                ? "border border-brand text-brand font-bold"
                : "border border-hairline text-ink2 font-medium"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="px-5 mt-3 space-y-3">
        {visible.map((it) => (
          <Link key={it.id} href={`/o/campaign/${it.id}`} className="cp-action block rounded-lg border border-hairline bg-canvas p-4">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-xs bg-ink text-white text-[11px] font-semibold shrink-0">
                {it.kind === "delivery" ? "배송형" : "방문형"}
              </span>
              {it.kind === "visit" && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-xs text-[11px] font-semibold shrink-0 ${
                    it.reserveRequired ? "bg-warningSoft text-ink" : "bg-successSoft text-successStrong"
                  }`}
                >
                  {it.reserveRequired ? "예약 필수" : "즉시 입장"}
                </span>
              )}
              <span className="ml-auto text-[12px] text-muted tabular-nums shrink-0">모집 마감 {it.daysLeft}일 전</span>
            </div>
            {/* 썸네일 + 캠페인명·매장명 (2026-08-05 — 체험권 화면과 동일 88×66 비율) */}
            <div className="mt-2.5 flex items-center gap-3">
              <div className="w-[88px] h-[66px] shrink-0 rounded-md overflow-hidden bg-sunken">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.thumb} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[16px] font-bold text-ink leading-[1.35] line-clamp-2">{it.title}</div>
                <div className="mt-0.5 text-[13px] text-muted truncate">{it.storeName}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-sm bg-sunken px-3.5 py-3 flex items-center justify-between">
                <span className="text-[12px] text-muted">{it.pendingLabel}</span>
                <span className="text-[16px] font-bold text-ink tabular-nums">{it.pendingCount}</span>
              </div>
              <div className="rounded-sm bg-sunken px-3.5 py-3 flex items-center justify-between">
                <span className="text-[12px] text-muted">사용 완료</span>
                <span className="text-[16px] font-bold text-ink tabular-nums">
                  {it.usedCount} / {it.totalQuota}
                </span>
              </div>
            </div>
          </Link>
        ))}
        {visible.length === 0 &&
          (items.length === 0 ? (
            <Link href="/o/campaign/new" className="block rounded-md border border-dashed border-hairline p-6 text-center text-muted text-[14px]">
              + 첫 체험단 캠페인 만들기
            </Link>
          ) : (
            <div className="rounded-md border border-dashed border-hairline p-6 text-center text-muted text-[14px]">
              해당 유형의 진행 중 캠페인이 없어요.
            </div>
          ))}
      </div>
    </div>
  );
}
