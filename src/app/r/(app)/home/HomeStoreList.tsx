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

function getStoreSignal(p: { remain: number; reviewCount: number }) {
  if (p.remain <= 3) return { label: `🔥 마감 임박 · ${p.remain}매`, cls: "bg-ink text-white" };
  if (p.reviewCount > 200) return { label: "⭐ 인기", cls: "bg-[#D97757] text-white" };
  return null;
}

function getPressSignal(p: PressCardData) {
  if (p.slotsLeft <= 2 || p.daysLeft <= 1)
    return { label: `🔥 마감 임박 · ${p.slotsLeft}자리`, cls: "bg-ink text-white" };
  if (p.payout >= 80000) return { label: "⭐ 인기", cls: "bg-[#D97757] text-white" };
  return null;
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

  const cats = ["전체", ...Array.from(new Set(cards.map((c) => c.category)))];
  const filtered = cat === "전체" ? cards : cards.filter((c) => c.category === cat);

  return (
    <>
      {mode === "list" ? (
        <div>
          {header}

          {/* 방문형 / 기자단 모드 토글 */}
          <div className="px-5 mt-5">
            <div className="flex bg-surfaceSoft border border-hairline rounded-md p-1 gap-1">
              <button
                onClick={() => setTab("visit")}
                className={`flex-1 h-10 rounded-sm text-[13px] font-bold flex items-center justify-center gap-1.5 ${tab === "visit" ? "bg-ink text-white" : "text-ink2"}`}
              >
                🍽️ 방문형
                <span className="text-[10px] opacity-65 font-semibold">매장 가기</span>
              </button>
              <button
                onClick={() => setTab("press")}
                className={`flex-1 h-10 rounded-sm text-[13px] font-bold flex items-center justify-center gap-1.5 ${tab === "press" ? "bg-ink text-white" : "text-ink2"}`}
              >
                ✍️ 기자단
                <span className="text-[10px] opacity-65 font-semibold">자료팩 작성</span>
              </button>
            </div>
          </div>

          {tab === "visit" ? (
            <>
              {/* 카테고리 chips */}
              <div className="px-5 mt-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                <div className="flex gap-2 pb-1">
                  {cats.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCat(c)}
                      className={`h-9 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap border ${cat === c ? "bg-ink text-white border-ink" : "bg-white text-ink2 border-hairline"}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* 섹션 헤더 + 리스트/지도 토글 */}
              <div className="px-5 mt-5 mb-3 flex items-center justify-between">
                <h2 className="text-[18px] font-bold tracking-tight">
                  방문 가능한 매장 <span className="text-[12px] text-muted font-semibold ml-1">{filtered.length}곳</span>
                </h2>
                <div className="inline-flex bg-surfaceSoft border border-hairline rounded-full p-1">
                  <button className="h-7 px-3 rounded-full bg-ink text-white text-[11px] font-bold inline-flex items-center gap-1">
                    ☰ 리스트
                  </button>
                  <button onClick={() => setMode("map")} className="h-7 px-3 rounded-full text-ink2 text-[11px] font-bold inline-flex items-center gap-1">
                    📍 지도
                  </button>
                </div>
              </div>

              <div className="px-5 space-y-6 pb-32">
                {filtered.map((p) => {
                  const sig = getStoreSignal(p);
                  return (
                    <Link
                      key={p.storeId}
                      href={p.accessible ? `/r/store/${p.storeId}?campaign=${p.campaignId}` : "/r/grade"}
                      className={`block ${p.accessible ? "" : "opacity-50"}`}
                    >
                      <div className="relative rounded-lg overflow-hidden">
                        <div className="h-44 bg-surfaceSoft flex items-center justify-center text-[64px]">{p.coverEmoji}</div>
                        {sig && (
                          <div className="absolute top-3 left-3">
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${sig.cls}`}>{sig.label}</span>
                          </div>
                        )}
                        {!p.accessible && (
                          <div className="absolute inset-0 bg-ink/50 flex items-center justify-center text-white text-[13px] font-semibold gap-1.5">
                            🔒 등급 부족
                          </div>
                        )}
                      </div>
                      <div className="pt-3.5 px-1">
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-[17px] font-bold text-ink tracking-tight">{p.name}</span>
                          <span className="text-[13px] text-muted">{p.area}</span>
                        </div>
                        <div className="text-[13px] text-muted mb-2.5">
                          {p.area} · {p.category} · ★ {p.rating} <span className="text-mutedSoft">({p.reviewCount.toLocaleString()})</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[11px] text-muted font-medium">멤버십 할인</div>
                            <div className="text-[20px] font-extrabold text-ink tracking-tight leading-none -mt-0.5">
                              {p.supportAmount.toLocaleString()}<span className="text-[14px] font-semibold">원</span>
                            </div>
                          </div>
                          <div className="text-[12px] text-ink2 font-semibold">잔여 {p.remain}매</div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="py-12 text-center text-muted text-[14px]">현재 모집 중인 캠페인이 없어요</div>
                )}
              </div>
            </>
          ) : (
            /* 기자단 모드 */
            <div className="px-5 mt-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[18px] font-bold tracking-tight">
                  참여 가능한 기자단 <span className="text-[12px] text-muted font-semibold ml-1">{pressCards.length}건</span>
                </h2>
                <span className="text-[11px] text-muted font-semibold px-2.5 py-1 bg-surfaceSoft rounded-full border border-hairline">📦 재택 작성</span>
              </div>
              <div className="space-y-4 pb-32">
                {pressCards.map((p) => {
                  const sig = getPressSignal(p);
                  return (
                    <Link
                      key={p.campaignId}
                      href={p.accessible ? `/r/press/${p.campaignId}` : "/r/grade"}
                      className={`block bg-white border-[1.5px] border-hairline rounded-lg p-4 ${p.accessible ? "" : "opacity-55"}`}
                    >
                      <div className="flex items-start justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          {sig && <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${sig.cls}`}>{sig.label}</span>}
                          {!p.accessible && <span className="text-[11px] font-bold text-error">🔒 등급 부족</span>}
                        </div>
                        <span className="text-[11px] font-bold text-muted px-2.5 py-1 bg-surfaceSoft border border-hairline rounded-full">
                          잔여 {p.slotsLeft}/{p.slotsTotal}
                        </span>
                      </div>

                      <div className="text-[17px] font-bold tracking-tight">{p.storeName}</div>
                      <div className="text-[12px] text-muted mb-3">{p.area} · {p.category} · 자료팩 사진 {p.kitPhotos}장</div>

                      <div className="grid grid-cols-4 gap-1 mb-3.5">
                        {[0, 1, 2, 3].map((i) => (
                          <div key={i} className="aspect-square rounded bg-surfaceSoft relative overflow-hidden">
                            {i === 3 && p.kitPhotos > 4 && (
                              <div className="absolute inset-0 bg-ink/45 text-white text-[11px] font-bold flex items-center justify-center">
                                +{p.kitPhotos - 3}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex items-end justify-between pt-3 border-t border-hairline">
                        <div>
                          <div className="text-[11px] text-muted font-medium">정산 예정금</div>
                          <div className="text-[22px] font-extrabold text-ink tracking-tight -mt-0.5">
                            {p.payout.toLocaleString()}<span className="text-[14px] font-semibold">원</span>
                          </div>
                          <div className="text-[10px] text-mutedSoft mt-0.5">3.3% 원천징수 후 입금</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] text-muted font-medium">모집 마감</div>
                          <div className="text-[14px] font-bold text-ink mt-0.5">D-{p.daysLeft}</div>
                          <div className="text-[10px] text-mutedSoft mt-0.5">탭하여 상세 확인 →</div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
                {pressCards.length === 0 && (
                  <div className="py-12 text-center text-muted text-[14px]">모집 중인 기자단이 없어요</div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="fixed inset-x-0 top-0 z-20 mx-auto max-w-[480px] bg-white" style={{ bottom: "var(--bottom-nav-h, 72px)" }}>
          {mapClientId ? (
            <NaverMapView pins={cards} clientId={mapClientId} fullscreen />
          ) : (
            <div className="px-5 py-16 text-center text-error text-[14px]">지도 클라이언트 ID가 설정되지 않았습니다.</div>
          )}
        </div>
      )}

      {tab === "visit" && (
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
      )}
    </>
  );
}
