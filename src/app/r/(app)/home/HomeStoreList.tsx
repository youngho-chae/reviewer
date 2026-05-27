"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import NaverMapView, { MapStorePin } from "@/components/NaverMapView";

export interface StoreCardData extends MapStorePin {
  rating: number;
  reviewCount: number;
}

export interface PressCardData {
  campaignId: string;
  storeId: string;
  storeName: string;
  area: string;
  category: string;
  coverEmoji: string;
  payout: number;
  slotsLeft: number;
  slotsTotal: number;
  minGrade: "S" | "A" | "B" | "C";
  accessible: boolean;
  kitPhotos: number;
  daysLeft: number;
}

export default function HomeStoreList({
  cards,
  pressCards,
  mapClientId,
  header,
}: {
  cards: StoreCardData[];
  pressCards: PressCardData[];
  mapClientId: string;
  header: ReactNode;
}) {
  const [mode, setMode] = useState<"list" | "map">("list");
  const [tab, setTab] = useState<"visit" | "press">("visit");
  const [cat, setCat] = useState<string>("전체");
  const [layout, setLayout] = useState<"row" | "grid">("row");

  const cats = ["전체", ...Array.from(new Set(cards.map((c) => c.category)))];
  const filtered = cat === "전체" ? cards : cards.filter((c) => c.category === cat);

  return (
    <>
      {mode === "list" ? (
        <div>
          {header}

          {/* Mode toggle — Apple configurator-chip grammar */}
          <div className="px-6 mt-7">
            <div className="inline-flex bg-parchment rounded-pill p-1 gap-1 border border-hairline">
              <button
                onClick={() => setTab("visit")}
                className={`px-4 h-9 rounded-pill text-[14px] ${tab === "visit" ? "bg-canvas text-ink shadow-sm" : "text-muted"}`}
              >
                방문형
              </button>
              <button
                onClick={() => setTab("press")}
                className={`px-4 h-9 rounded-pill text-[14px] ${tab === "press" ? "bg-canvas text-ink shadow-sm" : "text-muted"}`}
              >
                기자단
              </button>
            </div>
          </div>

          {tab === "visit" ? (
            <>
              {/* Category chips — pill, single Action Blue when selected */}
              <div className="px-6 mt-5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                <div className="flex gap-2 pb-1">
                  {cats.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCat(c)}
                      className={`h-9 px-4 rounded-pill text-[14px] whitespace-nowrap border ${cat === c ? "bg-ink text-white border-ink" : "bg-canvas text-ink border-hairline"}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section heading + row/grid toggle */}
              <div className="px-6 mt-8 mb-5 flex items-end justify-between">
                <div>
                  <h2 className="font-display text-[28px] leading-[1.14] text-ink">방문 가능한 매장</h2>
                  <div className="text-[14px] text-muted mt-1">{filtered.length}곳</div>
                </div>
                <div className="inline-flex bg-parchment rounded-pill p-1 border border-hairline">
                  <button
                    onClick={() => setLayout("row")}
                    aria-label="리스트 보기"
                    aria-pressed={layout === "row"}
                    className={`w-9 h-9 rounded-pill flex items-center justify-center ${layout === "row" ? "bg-canvas text-ink" : "text-muted"}`}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <line x1="4" y1="7" x2="20" y2="7" />
                      <line x1="4" y1="12" x2="20" y2="12" />
                      <line x1="4" y1="17" x2="20" y2="17" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setLayout("grid")}
                    aria-label="그리드 보기"
                    aria-pressed={layout === "grid"}
                    className={`w-9 h-9 rounded-pill flex items-center justify-center ${layout === "grid" ? "bg-canvas text-ink" : "text-muted"}`}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="4" width="7" height="7" rx="1" />
                      <rect x="13" y="4" width="7" height="7" rx="1" />
                      <rect x="4" y="13" width="7" height="7" rx="1" />
                      <rect x="13" y="13" width="7" height="7" rx="1" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Store cards — Apple store-utility-card. layout=row: 1xN, layout=grid: 2xN */}
              <div className={`px-6 pb-32 ${layout === "grid" ? "grid grid-cols-2 gap-3" : "space-y-4"}`}>
                {filtered.map((p) => (
                  <Link
                    key={p.storeId}
                    href={p.accessible ? `/r/store/${p.storeId}?campaign=${p.campaignId}` : "/r/grade"}
                    className={`cp-action block bg-canvas border border-hairline rounded-lg overflow-hidden ${p.accessible ? "" : "opacity-50"}`}
                  >
                    {/* Photo plate — emoji on parchment with product-shadow */}
                    <div className="aspect-[4/3] bg-parchment flex items-center justify-center relative">
                      <span className={`product-shadow leading-none ${layout === "grid" ? "text-[56px]" : "text-[88px]"}`}>{p.coverEmoji}</span>
                      {p.remain <= 3 && (
                        <div className="absolute top-2.5 left-2.5">
                          <span className="text-[11px] font-semibold text-brand">잔여 {p.remain}매</span>
                        </div>
                      )}
                      {!p.accessible && (
                        <div className="absolute top-2.5 right-2.5 text-[11px] text-ink2 bg-canvas/90 px-1.5 py-0.5 rounded-sm">등급 부족</div>
                      )}
                    </div>
                    {/* Card content */}
                    {layout === "grid" ? (
                      <div className="p-4">
                        <div className="text-[10px] text-muted uppercase tracking-wider mb-1">{p.category}</div>
                        <h3 className="font-display text-[17px] leading-[1.2] text-ink truncate">{p.name}</h3>
                        <p className="text-[12px] text-muted mt-0.5 truncate">{p.area} · ★ {p.rating}</p>
                        <div className="mt-3">
                          <div className="text-[10px] text-muted">멤버십 할인</div>
                          <div className="text-[18px] font-semibold text-ink tracking-[-0.022em] leading-none mt-0.5">
                            ₩{p.supportAmount.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6">
                        <div className="text-[12px] text-muted uppercase tracking-wider mb-1">{p.category}</div>
                        <h3 className="font-display text-[24px] leading-[1.14] text-ink">{p.name}</h3>
                        <p className="text-[15px] text-ink2 mt-1">{p.area} · ★ {p.rating} <span className="text-muted">({p.reviewCount.toLocaleString()})</span></p>

                        <div className="flex items-end justify-between mt-5">
                          <div>
                            <div className="text-[12px] text-muted">멤버십 할인</div>
                            <div className="text-[28px] font-semibold text-ink tracking-[-0.022em] leading-none mt-1">
                              ₩{p.supportAmount.toLocaleString()}
                            </div>
                          </div>
                          <span className="text-[15px] text-brand">
                            참여하기 →
                          </span>
                        </div>
                      </div>
                    )}
                  </Link>
                ))}
                {filtered.length === 0 && (
                  <div className={`py-16 text-center text-muted text-[17px] ${layout === "grid" ? "col-span-2" : ""}`}>현재 모집 중인 캠페인이 없어요</div>
                )}
              </div>
            </>
          ) : (
            /* Press mode */
            <>
              <div className="px-6 mt-8 mb-5">
                <h2 className="font-display text-[28px] leading-[1.14] text-ink">참여 가능한 기자단</h2>
                <div className="text-[14px] text-muted mt-1">{pressCards.length}건 · 자료팩 기반 재택 작성</div>
              </div>
              <div className="px-6 space-y-4 pb-32">
                {pressCards.map((p) => (
                  <Link
                    key={p.campaignId}
                    href={p.accessible ? `/r/press/${p.campaignId}` : "/r/grade"}
                    className={`cp-action block bg-canvas border border-hairline rounded-lg overflow-hidden ${p.accessible ? "" : "opacity-50"}`}
                  >
                    <div className="aspect-[4/3] bg-parchment flex items-center justify-center relative">
                      <span className="text-[80px] product-shadow leading-none">{p.coverEmoji}</span>
                      {!p.accessible && (
                        <div className="absolute top-3 right-3 text-[12px] text-ink2 bg-canvas/90 px-2 py-1 rounded-sm">등급 부족</div>
                      )}
                    </div>
                    <div className="p-6">
                      <div className="text-[12px] text-muted uppercase tracking-wider mb-1">기자단 · {p.category}</div>
                      <h3 className="font-display text-[24px] leading-[1.14] text-ink">{p.storeName}</h3>
                      <p className="text-[15px] text-ink2 mt-1">{p.area} · 자료팩 {p.kitPhotos}장 · 잔여 {p.slotsLeft}/{p.slotsTotal}</p>

                      <div className="flex items-end justify-between mt-5">
                        <div>
                          <div className="text-[12px] text-muted">정산 예정금</div>
                          <div className="text-[28px] font-semibold text-ink tracking-[-0.022em] leading-none mt-1">
                            ₩{p.payout.toLocaleString()}
                          </div>
                          <div className="text-[12px] text-muted mt-1">3.3% 원천징수 후 입금</div>
                        </div>
                        <span className="text-[15px] text-brand">
                          신청하기 →
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
                {pressCards.length === 0 && (
                  <div className="py-16 text-center text-muted text-[17px]">모집 중인 기자단이 없어요</div>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="fixed inset-x-0 top-0 z-20 mx-auto max-w-[480px] bg-canvas" style={{ bottom: "var(--bottom-nav-h, 72px)" }}>
          {mapClientId ? (
            <NaverMapView pins={cards} clientId={mapClientId} fullscreen />
          ) : (
            <div className="px-5 py-16 text-center text-error text-[14px]">지도 클라이언트 ID가 설정되지 않았습니다.</div>
          )}
        </div>
      )}

      {/* Floating sticky bar — Apple floating-sticky-bar */}
      {tab === "visit" && (
        <button
          type="button"
          onClick={() => setMode((m) => (m === "list" ? "map" : "list"))}
          className="cp-action fixed left-1/2 -translate-x-1/2 z-30 frosted-parchment text-ink text-[14px] font-medium px-5 h-11 rounded-pill flex items-center gap-2 border border-hairline"
          style={{ bottom: "calc(var(--bottom-nav-h, 72px) + 16px)" }}
          aria-label={mode === "list" ? "지도 보기로 전환" : "리스트 보기로 전환"}
        >
          {mode === "list" ? "📍 지도" : "☰ 리스트"}
        </button>
      )}
    </>
  );
}
