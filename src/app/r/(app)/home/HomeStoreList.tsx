"use client";
import { useState } from "react";
import Link from "next/link";
import GradeBadge from "@/components/GradeBadge";
import NaverMapView, { MapStorePin } from "@/components/NaverMapView";

export interface StoreCardData extends MapStorePin {
  rating: number;
  reviewCount: number;
}

export default function HomeStoreList({
  cards,
  mapClientId,
}: {
  cards: StoreCardData[];
  mapClientId: string;
}) {
  const [mode, setMode] = useState<"list" | "map">("list");

  return (
    <div>
      <div className="px-5 mt-2 mb-3 flex items-center justify-between">
        <h2 className="text-[18px] font-bold">방문 가능한 매장 <span className="text-[12px] text-muted font-normal ml-1">{cards.length}곳</span></h2>
        <div className="inline-flex bg-surfaceSoft rounded-full p-0.5">
          <button
            onClick={() => setMode("list")}
            className={`px-3 py-1.5 text-[12px] rounded-full font-medium transition ${mode === "list" ? "bg-white shadow-sm text-ink" : "text-muted"}`}
          >
            📋 리스트
          </button>
          <button
            onClick={() => setMode("map")}
            className={`px-3 py-1.5 text-[12px] rounded-full font-medium transition ${mode === "map" ? "bg-white shadow-sm text-ink" : "text-muted"}`}
          >
            🗺️ 지도
          </button>
        </div>
      </div>

      {mode === "list" ? (
        <div className="px-5 space-y-3 pb-24">
          {cards.map((p) => (
            <Link
              key={p.storeId}
              href={p.accessible ? `/r/store/${p.storeId}?campaign=${p.campaignId}` : "/r/me"}
              className={`block rounded-md border border-hairline overflow-hidden ${p.accessible ? "" : "opacity-50"}`}
            >
              <div className="h-36 bg-surfaceSoft flex items-center justify-center text-[56px]">{p.coverEmoji}</div>
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-[15px]">{p.name}</div>
                  <GradeBadge grade={p.grade} size="sm" />
                </div>
                <div className="mt-1 text-[13px] text-muted">
                  {p.area} · {p.category} · ★ {p.rating} ({p.reviewCount.toLocaleString()})
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-[13px] text-ink font-medium">지원금 ₩{p.supportAmount.toLocaleString()}</div>
                  {p.remain <= 3 ? (
                    <span className="text-[11px] bg-ink text-white px-2 py-0.5 rounded-full">🔥 마감 임박 · {p.remain}매</span>
                  ) : (
                    <span className="text-[11px] text-muted">잔여 {p.remain}매</span>
                  )}
                </div>
                {!p.accessible && (
                  <div className="mt-2 text-[12px] text-error">이 매장은 {p.grade}등급부터 이용 가능해요</div>
                )}
              </div>
            </Link>
          ))}
          {cards.length === 0 && (
            <div className="py-12 text-center text-muted text-[14px]">현재 모집 중인 캠페인이 없어요</div>
          )}
        </div>
      ) : (
        <div className="pb-24">
          {mapClientId ? (
            <NaverMapView pins={cards} clientId={mapClientId} />
          ) : (
            <div className="px-5 py-16 text-center text-error text-[14px]">
              지도 클라이언트 ID가 설정되지 않았습니다 (NEXT_PUBLIC_NAVER_MAP_CLIENT_ID).
            </div>
          )}
        </div>
      )}
    </div>
  );
}
