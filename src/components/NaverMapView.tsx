"use client";
import Script from "next/script";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { photoForStore } from "@/lib/store-photo";
import { SBUI, STORYBOARD, sbNum } from "@/lib/storyboard";
import { mockDistanceM, walkMinutes } from "@/lib/distance-mock";

export interface MapStorePin {
  storeId: string;
  campaignId: string;
  name: string;
  area: string;
  category: string;
  lat: number;
  lng: number;
  supportAmount: number;
  remain: number;
  coverEmoji: string;
  requiredChannels?: import("@/lib/types").SnsKind[];
}

declare global {
  interface Window {
    naver?: any;
  }
}

// map-marker-pill (DESIGN.md v2) — 흰 pill 2줄(매장명/최대 금액).
// 기본 보더 #D4D4D4, 선택 시 퍼플(#9333EA) 보더 + Purple 10 배경.
// [P1] 등급은 참여 자격이 아니므로 핀에 등급을 인코딩하지 않는다.
const PIN_BORDER = "#D4D4D4";
const PIN_SELECTED = "#9333EA";
const PIN_SELECTED_BG = "#FAF5FF";

function markerAmount(p: MapStorePin): string {
  return STORYBOARD ? "최대 지원금액" : `최대 ${p.supportAmount.toLocaleString()}원`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]
  );
}

// Web Mercator → 픽셀 변환 (Static Map 폴백용)
function lngLatToPixel(
  lng: number, lat: number, centerLng: number, centerLat: number,
  level: number, width: number, height: number
): { x: number; y: number } {
  const scale = Math.pow(2, level) * 256;
  const projX = (l: number) => (l + 180) / 360;
  const projY = (la: number) => {
    const sin = Math.sin((la * Math.PI) / 180);
    return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
  };
  const dx = (projX(lng) - projX(centerLng)) * scale;
  const dy = (projY(lat) - projY(centerLat)) * scale;
  return { x: width / 2 + dx, y: height / 2 + dy };
}

export default function NaverMapView({
  pins,
  clientId,
  fullscreen = false,
  onSelectionChange,
}: {
  pins: MapStorePin[];
  clientId: string;
  fullscreen?: boolean;
  onSelectionChange?: (hasSelection: boolean) => void;
}) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  // 재진입 안전: window.naver.maps가 이미 로드돼 있으면 즉시 ready
  const [sdkReady, setSdkReady] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !!window.naver?.maps;
  });
  const [sdkFailed, setSdkFailed] = useState(false);

  // ── 선택 카드 캐러셀 (2026-07-07 회의) ──
  // 지도에서 매장을 선택하면 카드가 뜨고, 좌우 스와이프로 다른 매장을 볼 수 있다.
  // 카드 순서 = 사용자 현재 위치 기준 거리순 (프로토타입은 mock 거리).
  const sortedPins = useMemo(
    () => [...pins].sort((a, b) => mockDistanceM(a.storeId) - mockDistanceM(b.storeId)),
    [pins],
  );
  const [selIdx, setSelIdx] = useState<number | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const scrollRaf = useRef<number>(0);
  const selected: MapStorePin | null = selIdx != null ? sortedPins[selIdx] ?? null : null;

  // 핀 클릭 → 해당 카드로 선택 + 캐러셀 위치 동기화
  function selectPin(p: MapStorePin) {
    const i = sortedPins.findIndex((s) => s.storeId === p.storeId);
    if (i < 0) return;
    setSelIdx(i);
    requestAnimationFrame(() => {
      const el = carouselRef.current;
      if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "auto" });
    });
  }

  // 스와이프 → 스냅된 카드 인덱스로 선택 갱신 (선택 핀 강조 이동)
  function onCarouselScroll() {
    cancelAnimationFrame(scrollRaf.current);
    scrollRaf.current = requestAnimationFrame(() => {
      const el = carouselRef.current;
      if (!el || el.clientWidth === 0) return;
      const i = Math.round(el.scrollLeft / el.clientWidth);
      setSelIdx((prev) => (prev === i ? prev : Math.min(sortedPins.length - 1, Math.max(0, i))));
    });
  }

  // 선택 상태가 변하면 부모에 알림 (FAB 위치 조정 등)
  useEffect(() => {
    onSelectionChange?.(!!selected);
  }, [selected, onSelectionChange]);

  // 핀 집합이 바뀌면 선택 해제 (없어진 핀 참조 방지)
  useEffect(() => {
    setSelIdx(null);
  }, [pins]);

  // SDK 인증 실패 글로벌 콜백
  useEffect(() => {
    (window as any).navermap_authFailure = () => setSdkFailed(true);
  }, []);

  // SDK 로드 폴링 (Next.js Script가 cached load에서 onLoad 미발화하는 경우 보완)
  useEffect(() => {
    if (sdkReady || sdkFailed) return;
    if (typeof window !== "undefined" && window.naver?.maps) {
      setSdkReady(true);
      return;
    }
    const poll = setInterval(() => {
      if (window.naver?.maps) {
        setSdkReady(true);
        clearInterval(poll);
      }
    }, 120);
    const failTimer = setTimeout(() => {
      if (!window.naver?.maps) setSdkFailed(true);
    }, 6000);
    return () => {
      clearInterval(poll);
      clearTimeout(failTimer);
    };
  }, [sdkReady, sdkFailed]);

  // 지도 초기화 — 마운트당 1회
  useEffect(() => {
    if (!sdkReady || sdkFailed) return;
    if (!mapEl.current || !window.naver?.maps) return;
    if (mapRef.current) return;
    try {
      const naver = window.naver;
      const avg = pins.reduce(
        (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
        { lat: 0, lng: 0 }
      );
      const center = pins.length
        ? new naver.maps.LatLng(avg.lat / pins.length, avg.lng / pins.length)
        : new naver.maps.LatLng(37.5665, 126.978);

      mapRef.current = new naver.maps.Map(mapEl.current, {
        center,
        zoom: 12,
        mapTypeControl: false,
        logoControl: true,
        scaleControl: false,
        zoomControl: true,
        zoomControlOptions: {
          position: naver.maps.Position.RIGHT_CENTER,
          style: naver.maps.ZoomControlStyle.SMALL,
        },
      });
    } catch {
      setSdkFailed(true);
    }
    // pins는 마커 갱신 effect에서 처리; 여기서는 deps에 넣지 않음
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkReady, sdkFailed]);

  // 마커 동기화 — pins 또는 mapRef 준비 시점에 갱신
  useEffect(() => {
    if (!sdkReady || sdkFailed) return;
    if (!mapRef.current || !window.naver?.maps) return;
    const naver = window.naver;

    // 기존 마커 정리
    for (const m of markersRef.current) {
      try { m.setMap(null); } catch {}
    }
    markersRef.current = [];

    for (const p of pins) {
      const isSel = selected?.storeId === p.storeId;
      const border = isSel ? PIN_SELECTED : PIN_BORDER;
      const bg = isSel ? PIN_SELECTED_BG : "#ffffff";
      const name = escapeHtml(p.name);
      // map-marker-pill — 2줄 (매장명 / 최대 금액), 선택 시 퍼플 강조
      const html = `
        <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
          <div style="display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 14px;background:${bg};border:${isSel ? "1.5px" : "1px"} solid ${border};border-radius:9999px;box-shadow:0 3px 10px rgba(0,0,0,.14);line-height:1.25;white-space:nowrap;max-width:220px;">
            <span style="color:#171717;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;max-width:190px;">${name}</span>
            <span style="color:#171717;font-size:12px;font-weight:700;">${markerAmount(p)}</span>
          </div>
          <svg width="14" height="9" viewBox="0 0 14 9" style="margin-top:-1px;display:block;"><path d="M7 9 L1 0 L13 0 Z" fill="${bg}" stroke="${border}" stroke-width="1" stroke-linejoin="round" /><path d="M3 1 L11 1" stroke="${bg}" stroke-width="2.5" /></svg>
        </div>`;
      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(p.lat, p.lng),
        map: mapRef.current,
        icon: { content: html, anchor: new naver.maps.Point(110, 48) },
      });
      naver.maps.Event.addListener(marker, "click", () => selectPin(p));
      markersRef.current.push(marker);
    }

    // selectPin은 sortedPins에서 파생되며 pins 변경 시 함께 갱신됨
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, selected, sdkReady, sdkFailed]);

  // 핀 집합이 바뀌면 중심 재계산 (선택 변경으로는 이동하지 않음)
  useEffect(() => {
    if (!sdkReady || sdkFailed || !mapRef.current || !window.naver?.maps) return;
    if (pins.length === 0) return;
    const naver = window.naver;
    const avg = pins.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
      { lat: 0, lng: 0 }
    );
    try {
      mapRef.current.setCenter(new naver.maps.LatLng(avg.lat / pins.length, avg.lng / pins.length));
    } catch {}
  }, [pins, sdkReady, sdkFailed]);

  // unmount 시 마커/맵 정리
  useEffect(() => {
    const markers = markersRef;
    const map = mapRef;
    return () => {
      for (const m of markers.current) {
        try { m.setMap(null); } catch {}
      }
      markers.current = [];
      try { (map.current as any)?.destroy?.(); } catch {}
      map.current = null;
    };
  }, []);

  return (
    <>
      <Script
        id="naver-maps-sdk"
        strategy="afterInteractive"
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`}
        onReady={() => {
          if (typeof window !== "undefined" && window.naver?.maps) setSdkReady(true);
        }}
        onLoad={() => setSdkReady(true)}
        onError={() => setSdkFailed(true)}
      />
      <div className={fullscreen ? "relative w-full h-full" : "relative"}>
        {sdkFailed ? (
          <StaticMapFallback pins={pins} onSelect={selectPin} fullscreen={fullscreen} />
        ) : (
          <div
            ref={mapEl}
            className="w-full bg-parchment"
            style={fullscreen ? { height: "100%" } : { height: "calc(100dvh - 240px)", minHeight: 400 }}
          />
        )}
        {!sdkReady && !sdkFailed && (
          <div className="absolute inset-0 grid place-items-center bg-parchment text-muted text-[13px] pointer-events-none">
            지도를 불러오는 중...
          </div>
        )}
        {selected && (
          /* map-bottom-card 캐러셀 (2026-07-07 회의) — 좌우 스와이프로 거리순 다음 매장 탐색.
             카드 정보 = 매장명·카테고리·거리·지원금만 (채널·마감일·등급은 과도한 정보로 미노출). */
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
                        <Image
                          src={photoForStore(p.storeId, p.category)}
                          alt={p.name}
                          fill
                          sizes="88px"
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-semibold text-ink truncate">{p.name}</div>
                        <div className="mt-1 text-[13px] text-muted truncate">
                          {p.category} · {sbNum(SBUI.distance, `도보 ${walkMinutes(p.storeId)}분`)}
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
                <span
                  key={p.storeId}
                  className={`w-1.5 h-1.5 rounded-full ${i === Math.min(selIdx ?? 0, 7) ? "bg-ink" : "bg-borderStrong"}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// SDK 로드 실패 시 Static Map 폴백
function StaticMapFallback({
  pins,
  onSelect,
  fullscreen = false,
}: {
  pins: MapStorePin[];
  onSelect: (p: MapStorePin) => void;
  fullscreen?: boolean;
}) {
  const [size, setSize] = useState({ w: 800, h: 600 });
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const r = e.contentRect;
        setSize({ w: Math.max(320, Math.floor(r.width)), h: Math.max(360, Math.floor(r.height)) });
      }
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const avg = pins.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
  const centerLat = pins.length ? avg.lat / pins.length : 37.5665;
  const centerLng = pins.length ? avg.lng / pins.length : 126.978;
  const level = 11;

  const markerParams = pins
    .slice(0, 15)
    .map((p, i) => {
      const labelChar = String.fromCharCode(65 + i);
      return `marker=${encodeURIComponent(`type:t|size:mid|pos:${p.lng} ${p.lat}|label:${labelChar}`)}`;
    })
    .join("&");
  const staticUrl = `/api/map/static?center=${centerLng},${centerLat}&level=${level}&w=${Math.min(size.w, 1024)}&h=${Math.min(size.h, 1024)}&${markerParams}`;

  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden bg-parchment"
      style={fullscreen ? { height: "100%" } : { height: "calc(100dvh - 240px)", minHeight: 400 }}
    >
      <img
        src={staticUrl}
        alt="매장 위치 지도"
        className="absolute inset-0 w-full h-full object-cover"
        loading="eager"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
      <div className="absolute inset-0">
        {pins.map((p) => {
          const { x, y } = lngLatToPixel(p.lng, p.lat, centerLng, centerLat, level, size.w, size.h);
          return (
            <button
              key={p.storeId}
              onClick={() => onSelect(p)}
              className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center"
              style={{ left: `${x}px`, top: `${y}px` }}
            >
              <div
                className="flex flex-col items-center px-3.5 py-1.5 rounded-pill bg-white shadow-sm border max-w-[200px] whitespace-nowrap leading-tight"
                style={{ borderColor: PIN_BORDER }}
              >
                <span className="text-ink text-[12px] font-semibold truncate max-w-[180px]">{p.name}</span>
                <span className="text-ink text-[12px] font-bold">{markerAmount(p)}</span>
              </div>
              <div className="text-[12px] -mt-0.5 leading-none text-borderStrong">▼</div>
            </button>
          );
        })}
      </div>
      <div className="absolute top-2 left-2 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-[11px] text-muted shadow-sm">
        🗺️ 정적 지도 모드 · NCP 도메인 등록 시 인터랙티브 전환
      </div>
    </div>
  );
}
