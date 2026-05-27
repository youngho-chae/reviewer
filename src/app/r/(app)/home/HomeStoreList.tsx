"use client";
import { useState, useMemo, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import NaverMapView, { MapStorePin } from "@/components/NaverMapView";
import Icon from "@/components/Icon";
import HomeHeader from "./HomeHeader";
import { photoForStore } from "@/lib/store-photo";
import { Grade } from "@/lib/types";

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

interface Props {
  cards: StoreCardData[];
  pressCards: PressCardData[];
  mapClientId: string;
  topBar: ReactNode;
  // user info — drives HomeHeader
  nickname: string;
  grade: Grade;
  tierDesc: string;
  completedReviews: number;
  qualityScore: number;
  activeNow: number;
}

function matchesSearch(text: string, q: string) {
  if (!q.trim()) return true;
  return text.toLowerCase().includes(q.trim().toLowerCase());
}

export default function HomeStoreList({
  cards,
  pressCards,
  mapClientId,
  topBar,
  nickname,
  grade,
  tierDesc,
  completedReviews,
  qualityScore,
  activeNow,
}: Props) {
  const [mode, setMode] = useState<"list" | "map">("list");
  const [tab, setTab] = useState<"visit" | "press">("visit");
  const [cat, setCat] = useState<string>("전체");
  const [layout, setLayout] = useState<"row" | "grid">("row");
  const [search, setSearch] = useState("");

  const cats = useMemo(
    () => ["전체", ...Array.from(new Set(cards.map((c) => c.category)))],
    [cards]
  );

  // 검색은 매장명·지역·카테고리에서 부분 일치 — 카테고리 chip과 AND로 결합
  const filtered = useMemo(() => {
    return cards.filter((p) => {
      if (cat !== "전체" && p.category !== cat) return false;
      const haystack = `${p.name} ${p.area} ${p.category}`;
      return matchesSearch(haystack, search);
    });
  }, [cards, cat, search]);

  // 기자단도 같은 검색어 적용
  const filteredPress = useMemo(() => {
    return pressCards.filter((p) => {
      const haystack = `${p.storeName} ${p.area} ${p.category}`;
      return matchesSearch(haystack, search);
    });
  }, [pressCards, search]);

  return (
    <>
      {mode === "list" ? (
        <div>
          {topBar}
          <HomeHeader
            nickname={nickname}
            grade={grade}
            tierDesc={tierDesc}
            completedReviews={completedReviews}
            qualityScore={qualityScore}
            activeNow={activeNow}
            search={search}
            onSearchChange={setSearch}
          />

          {/* Mode toggle — Apple configurator-chip grammar */}
          <div className="px-6 mt-7">
            <div className="inline-flex bg-parchment rounded-pill p-1 gap-1 border border-hairline">
              <button
                onClick={() => setTab("visit")}
                className={`px-4 h-9 rounded-pill text-[14px] ${tab === "visit" ? "bg-canvas text-ink" : "text-muted"}`}
              >
                방문형
              </button>
              <button
                onClick={() => setTab("press")}
                className={`px-4 h-9 rounded-pill text-[14px] ${tab === "press" ? "bg-canvas text-ink" : "text-muted"}`}
              >
                기자단
              </button>
            </div>
          </div>

          {tab === "visit" ? (
            <>
              {/* Category chips */}
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
                  <div className="text-[14px] text-muted mt-1">
                    {search ? `“${search}” 검색 결과 ${filtered.length}곳` : `${filtered.length}곳`}
                  </div>
                </div>
                <div className="inline-flex bg-parchment rounded-pill p-1 border border-hairline">
                  <button
                    onClick={() => setLayout("row")}
                    aria-label="리스트 보기"
                    aria-pressed={layout === "row"}
                    className={`w-9 h-9 rounded-pill flex items-center justify-center ${layout === "row" ? "bg-canvas text-ink" : "text-muted"}`}
                  >
                    <Icon name="list" variant={layout === "row" ? "bold" : "border"} size={18} />
                  </button>
                  <button
                    onClick={() => setLayout("grid")}
                    aria-label="그리드 보기"
                    aria-pressed={layout === "grid"}
                    className={`w-9 h-9 rounded-pill flex items-center justify-center ${layout === "grid" ? "bg-canvas text-ink" : "text-muted"}`}
                  >
                    <Icon name="grid" variant={layout === "grid" ? "bold" : "border"} size={18} />
                  </button>
                </div>
              </div>

              {/* Store cards */}
              <div className={`px-6 pb-32 ${layout === "grid" ? "grid grid-cols-2 gap-3" : "space-y-4"}`}>
                {filtered.map((p) => (
                  <Link
                    key={p.storeId}
                    href={p.accessible ? `/r/store/${p.storeId}?campaign=${p.campaignId}` : "/r/grade"}
                    className={`cp-action block bg-canvas border border-hairline rounded-lg overflow-hidden ${p.accessible ? "" : "opacity-50"}`}
                  >
                    <div className="aspect-[4/3] bg-parchment relative overflow-hidden">
                      <Image
                        src={photoForStore(p.storeId)}
                        alt={p.name}
                        fill
                        sizes={layout === "grid" ? "(max-width: 480px) 50vw, 240px" : "(max-width: 480px) 100vw, 480px"}
                        className="object-cover"
                      />
                      {p.remain <= 3 && (
                        <div className="absolute top-2.5 left-2.5">
                          <span className="text-[11px] font-semibold text-white bg-ink/80 px-2 py-1 rounded-pill backdrop-blur-sm">잔여 {p.remain}매</span>
                        </div>
                      )}
                      {!p.accessible && (
                        <div className="absolute inset-0 bg-ink/45 flex items-center justify-center text-white text-[13px] font-semibold gap-1.5">
                          <Icon name="lock" variant="bold" size={14} />
                          <span>등급 부족</span>
                        </div>
                      )}
                    </div>
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
                  <div className={`py-16 text-center text-muted text-[17px] ${layout === "grid" ? "col-span-2" : ""}`}>
                    {search ? `“${search}”에 일치하는 매장이 없어요` : "현재 모집 중인 캠페인이 없어요"}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Press mode */
            <>
              <div className="px-6 mt-8 mb-5">
                <h2 className="font-display text-[28px] leading-[1.14] text-ink">참여 가능한 기자단</h2>
                <div className="text-[14px] text-muted mt-1">
                  {search ? `“${search}” 검색 결과 ${filteredPress.length}건` : `${filteredPress.length}건 · 자료팩 기반 재택 작성`}
                </div>
              </div>
              <div className="px-6 space-y-4 pb-32">
                {filteredPress.map((p) => (
                  <Link
                    key={p.campaignId}
                    href={p.accessible ? `/r/press/${p.campaignId}` : "/r/grade"}
                    className={`cp-action block bg-canvas border border-hairline rounded-lg overflow-hidden ${p.accessible ? "" : "opacity-50"}`}
                  >
                    <div className="aspect-[4/3] bg-parchment relative overflow-hidden">
                      <Image
                        src={photoForStore(p.storeId)}
                        alt={p.storeName}
                        fill
                        sizes="(max-width: 480px) 100vw, 480px"
                        className="object-cover"
                      />
                      {!p.accessible && (
                        <div className="absolute inset-0 bg-ink/45 flex items-center justify-center text-white text-[13px] font-semibold gap-1.5">
                          <Icon name="lock" variant="bold" size={14} />
                          <span>등급 부족</span>
                        </div>
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
                {filteredPress.length === 0 && (
                  <div className="py-16 text-center text-muted text-[17px]">
                    {search ? `“${search}”에 일치하는 기자단이 없어요` : "모집 중인 기자단이 없어요"}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        // Map view — fullscreen + floating search input overlay at top
        <div className="fixed inset-x-0 top-0 z-20 mx-auto max-w-[480px] bg-canvas" style={{ bottom: "var(--bottom-nav-h, 72px)" }}>
          {/* Floating search bar over the map */}
          <div className="absolute top-3 left-3 right-3 z-30">
            <div className="relative">
              <Icon
                name="search"
                variant={search ? "bold" : "border"}
                size={16}
                className={`absolute left-4 top-1/2 -translate-y-1/2 ${search ? "text-ink" : "text-muted"}`}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="동네·지역명 또는 매장명 검색"
                className="w-full h-11 pl-11 pr-10 rounded-pill bg-canvas/95 backdrop-blur border border-hairline text-[15px] focus:border-brand focus:outline-none shadow-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="검색어 지우기"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-mutedSoft/40 flex items-center justify-center text-ink"
                >
                  <Icon name="x" variant="bold" size={10} />
                </button>
              )}
            </div>
            {search && (
              <div className="mt-2 px-3 py-1.5 bg-canvas/95 backdrop-blur rounded-pill border border-hairline text-[12px] text-muted text-center shadow-sm">
                {filtered.length}곳 일치
              </div>
            )}
          </div>

          {mapClientId ? (
            <NaverMapView pins={filtered} clientId={mapClientId} fullscreen />
          ) : (
            <div className="px-5 py-16 text-center text-error text-[14px]">지도 클라이언트 ID가 설정되지 않았습니다.</div>
          )}
        </div>
      )}

      {/* Floating sticky map/list toggle */}
      {tab === "visit" && (
        <button
          type="button"
          onClick={() => setMode((m) => (m === "list" ? "map" : "list"))}
          className="cp-action fixed left-1/2 -translate-x-1/2 z-30 frosted-parchment text-ink text-[14px] font-medium px-5 h-11 rounded-pill flex items-center gap-2 border border-hairline"
          style={{ bottom: "calc(var(--bottom-nav-h, 72px) + 16px)" }}
          aria-label={mode === "list" ? "지도 보기로 전환" : "리스트 보기로 전환"}
        >
          {mode === "list" ? (
            <>
              <Icon name="pin" variant="bold" size={16} />
              <span>지도</span>
            </>
          ) : (
            <>
              <Icon name="list" variant="bold" size={16} />
              <span>리스트</span>
            </>
          )}
        </button>
      )}
    </>
  );
}
