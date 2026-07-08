"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { photoForStore } from "@/lib/store-photo";
import { SBUI, STORYBOARD, sbNum } from "@/lib/storyboard";
import { mockDistanceM, formatDistance } from "@/lib/distance-mock";
import type { MapStorePin } from "./NaverMapView";

/**
 * 임시(데모) 지도 뷰 — Naver 지도 SDK/키가 없어도 지도뷰 UI·인터랙션을 완결 제공 (2026-07-08).
 * 좌표(lat/lng)를 뷰포트에 투영한 가짜 맵 위에서:
 *  - 핀 선택 → 하단 카드 캐러셀 노출
 *  - 카드 좌우 스와이프 → 다른 매장으로 포커스 전환(맵 팬 이동) + 핀 강조, 순서 = 현 위치 거리순
 *  - 현 위치 파란 점 + GPS 리센터(전체 보기로 복귀)
 * 실 키가 주입되면 ExploreView가 NaverMapView를 렌더하므로 이 컴포넌트는 폴백 전용이다.
 */
function markerAmount(p: MapStorePin): string {
  return STORYBOARD ? "최대 지원금액" : `최대 ${p.supportAmount.toLocaleString()}원`;
}

// 핀 좌표를 [pad, 100-pad] % 범위로 정규화 (동일 좌표/단일 핀은 중앙 근처로)
function project(pins: MapStorePin[]) {
  const pad = 14;
  const span = 100 - pad * 2;
  const lats = pins.map((p) => p.lat);
  const lngs = pins.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const dLat = maxLat - minLat || 1;
  const dLng = maxLng - minLng || 1;
  return pins.map((p) => ({
    x: pins.length <= 1 ? 50 : pad + ((p.lng - minLng) / dLng) * span,
    y: pins.length <= 1 ? 50 : pad + ((maxLat - p.lat) / dLat) * span, // 위도 반전
  }));
}

export default function MockMapView({
  pins,
  onSelectionChange,
}: {
  pins: MapStorePin[];
  onSelectionChange?: (hasSelection: boolean) => void;
}) {
  const sortedPins = useMemo(
    () => [...pins].sort((a, b) => mockDistanceM(a.storeId) - mockDistanceM(b.storeId)),
    [pins],
  );
  const pos = useMemo(() => project(sortedPins), [sortedPins]);

  const [selIdx, setSelIdx] = useState<number | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const scrollRaf = useRef<number>(0);
  const selected = selIdx != null ? sortedPins[selIdx] ?? null : null;

  useEffect(() => { onSelectionChange?.(!!selected); }, [selected, onSelectionChange]);
  useEffect(() => { setSelIdx(null); }, [pins]);

  // 선택 핀을 화면 중앙으로 옮기는 팬 오프셋 (translate %는 요소 자기 크기 기준 = 컨테이너 크기)
  const pan =
    selIdx != null && pos[selIdx]
      ? { x: 50 - pos[selIdx].x, y: 42 - pos[selIdx].y } // 42%: 하단 카드 영역만큼 위로
      : { x: 0, y: 0 };

  function selectPin(i: number) {
    setSelIdx(i);
    requestAnimationFrame(() => {
      const el = carouselRef.current;
      if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "auto" });
    });
  }

  function onCarouselScroll() {
    cancelAnimationFrame(scrollRaf.current);
    scrollRaf.current = requestAnimationFrame(() => {
      const el = carouselRef.current;
      if (!el || el.clientWidth === 0) return;
      const i = Math.round(el.scrollLeft / el.clientWidth);
      setSelIdx((prev) => (prev === i ? prev : Math.min(sortedPins.length - 1, Math.max(0, i))));
    });
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* 데모 맵 배경 — 그리드 + 도로 밴드 (실지도 아님을 명시하는 칩 포함) */}
      <div className="absolute inset-0 bg-[#EAEEF3]" />
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(#dfe4ea 1px, transparent 1px), linear-gradient(90deg, #dfe4ea 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div className="absolute -left-10 top-1/3 w-[140%] h-3 bg-white/70 rotate-[-18deg]" aria-hidden />
      <div className="absolute -left-10 top-2/3 w-[140%] h-4 bg-white/70 rotate-[8deg]" aria-hidden />
      <div className="absolute left-1/3 -top-10 h-[140%] w-3 bg-white/70 rotate-[10deg]" aria-hidden />

      <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-pill bg-white/90 shadow-sm text-[11px] text-muted">
        🗺️ 데모 지도 · 지도 키 연동 시 실지도 전환
      </div>

      {/* 좌표 투영 월드 레이어 — 선택 시 팬 이동 */}
      <div
        className="absolute inset-0 transition-transform duration-300 ease-out"
        style={{ transform: `translate(${pan.x}%, ${pan.y}%)` }}
      >
        {/* 현 위치 파란 점 — 데모상 핀 집합 중심 */}
        <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: "50%", top: "50%" }} aria-hidden>
          <span className="block w-4 h-4 rounded-full bg-info border-[3px] border-white" style={{ boxShadow: "0 0 0 6px rgba(59,130,246,.25)" }} />
        </div>

        {sortedPins.map((p, i) => {
          const isSel = selIdx === i;
          return (
            <button
              key={p.storeId}
              type="button"
              onClick={() => selectPin(i)}
              className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center"
              style={{ left: `${pos[i].x}%`, top: `${pos[i].y}%`, zIndex: isSel ? 30 : 10 }}
              aria-label={`${p.name} 선택`}
              aria-pressed={isSel}
            >
              {/* 미선택 = 단일 라인 금액 칩(밀집 가독성), 선택 = 2줄 강조 pill */}
              {isSel ? (
                <div
                  className="flex flex-col items-center gap-px px-3.5 py-1.5 rounded-pill whitespace-nowrap leading-tight bg-brandSoft border-[1.5px] border-brand"
                  style={{ boxShadow: "0 4px 12px rgba(147,51,234,.22)", maxWidth: 200 }}
                >
                  <span className="text-ink text-[12px] font-semibold truncate max-w-[180px]">{p.name}</span>
                  <span className="text-brand text-[12px] font-bold">{markerAmount(p)}</span>
                </div>
              ) : (
                <div
                  className="px-2.5 py-1 rounded-pill whitespace-nowrap bg-white border border-borderStrong"
                  style={{ boxShadow: "0 2px 6px rgba(0,0,0,.12)" }}
                >
                  <span className="text-ink text-[11px] font-bold">{markerAmount(p)}</span>
                </div>
              )}
              <svg width="12" height="8" viewBox="0 0 14 9" style={{ marginTop: -1 }}>
                <path d="M7 9 L1 0 L13 0 Z" fill={isSel ? "#FAF5FF" : "#fff"} stroke={isSel ? "#9333EA" : "#D4D4D4"} strokeWidth="1" strokeLinejoin="round" />
              </svg>
            </button>
          );
        })}
      </div>

      {/* GPS 리센터 — 전체 보기(선택 해제)로 복귀 */}
      <button
        type="button"
        onClick={() => setSelIdx(null)}
        className="cp-action absolute right-3 z-20 w-10 h-10 rounded-full bg-white shadow-card flex items-center justify-center text-ink"
        style={{ bottom: selected ? 172 : 24 }}
        aria-label="현 위치로 지도 이동"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 18.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M12 13.4a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Z" />
        </svg>
      </button>

      {/* map-bottom-card 캐러셀 — 좌우 스와이프로 거리순 다음 매장 (매장명·카테고리·거리·지원금만) */}
      {selected && (
        <div className="absolute left-0 right-0 bottom-0 mx-auto max-w-[480px]" onClick={() => setSelIdx(null)}>
          <div
            ref={carouselRef}
            onScroll={onCarouselScroll}
            className="flex overflow-x-auto snap-x snap-mandatory"
            style={{ scrollbarWidth: "none" }}
          >
            {sortedPins.map((p) => (
              <div key={p.storeId} className="w-full shrink-0 snap-start p-4">
                <Link
                  href={`/r/store/${p.storeId}?campaign=${p.campaignId}`}
                  className="cp-action block rounded-lg bg-white shadow-card p-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex gap-3 items-center">
                    <div className="relative w-[88px] h-[88px] shrink-0 rounded-md overflow-hidden bg-sunken">
                      <Image src={photoForStore(p.storeId, p.category)} alt={p.name} fill sizes="88px" className="object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-semibold text-ink truncate">{p.name}</div>
                      <div className="mt-1 text-[13px] text-muted truncate">
                        {p.category} · {sbNum(SBUI.distance, formatDistance(mockDistanceM(p.storeId)))}
                      </div>
                      <div className="mt-1.5 text-[16px] font-bold text-ink tabular-nums">
                        최대 {sbNum(SBUI.support, `${p.supportAmount.toLocaleString()}원`)} 지원
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
          <div className="pb-2 flex justify-center gap-1" aria-hidden>
            {sortedPins.slice(0, 8).map((p, i) => (
              <span key={p.storeId} className={`w-1.5 h-1.5 rounded-full ${i === Math.min(selIdx ?? 0, 7) ? "bg-ink" : "bg-borderStrong"}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
