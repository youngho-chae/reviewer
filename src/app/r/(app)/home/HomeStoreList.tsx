"use client";
import { useState, type ReactNode } from "react";
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
  header,
}: {
  cards: StoreCardData[];
  mapClientId: string;
  header: ReactNode;
}) {
  const [mode, setMode] = useState<"list" | "map">("list");

  return (
    <>
      {mode === "list" ? (
        <div>
          {header}
          <div className="px-5 mt-6 mb-3">
            <h2 className="text-[18px] font-bold">
              방문 가능한 매장{" "}
              <span className="text-[12px] text-muted font-normal ml-1">{cards.length}곳</span>
            </h2>
          </div>
          <div className="px-5 space-y-3 pb-32">
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
        </div>
      ) : (
        // 풀스크린 지도 — 상단 헤더/등급카드 모두 숨김, 바텀 네비 위까지 채움
        <div className="fixed inset-x-0 top-0 z-20 mx-auto max-w-[480px] bg-white" style={{ bottom: "var(--bottom-nav-h, 72px)" }}>
          {mapClientId ? (
            <NaverMapView pins={cards} clientId={mapClientId} fullscreen />
          ) : (
            <div className="px-5 py-16 text-center text-error text-[14px]">
              지도 클라이언트 ID가 설정되지 않았습니다.
            </div>
          )}
        </div>
      )}

      {/* 중앙 하단 FAB 토글 — 바텀 네비 바로 위 */}
      <button
        type="button"
        onClick={() => setMode((m) => (m === "list" ? "map" : "list"))}
        className="fixed left-1/2 -translate-x-1/2 z-30 bg-ink text-white text-[13px] font-semibold px-5 py-3 rounded-full shadow-lg flex items-center gap-1.5 active:scale-95 transition"
        style={{ bottom: "calc(var(--bottom-nav-h, 72px) + 12px)" }}
        aria-label={mode === "list" ? "지도 보기로 전환" : "리스트 보기로 전환"}
      >
        {mode === "list" ? (
          <>
            <span>🗺️</span>
            <span>지도 보기</span>
          </>
        ) : (
          <>
            <span>📋</span>
            <span>리스트 보기</span>
          </>
        )}
      </button>
    </>
  );
}
