"use client";
import Script from "next/script";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { photoForStore } from "@/lib/store-photo";

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
  grade: "S" | "A" | "B" | "C";
  accessible: boolean;
  coverEmoji: string;
}

declare global {
  interface Window {
    naver?: any;
  }
}

// Apple 팔레트와 일치 — 등급별 강조 컬러 (어두운 톤 위주)
const GRADE_COLOR: Record<string, string> = {
  S: "#1d1d1f",
  A: "#0066cc",
  B: "#5b6e6a",
  C: "#9aa6a3",
};

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
  const [selected, setSelected] = useState<MapStorePin | null>(null);

  // 선택 상태가 변하면 부모에 알림 (FAB 위치 조정 등)
  useEffect(() => {
    onSelectionChange?.(!!selected);
  }, [selected, onSelectionChange]);

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
      const color = p.accessible ? GRADE_COLOR[p.grade] || "#6a6a6a" : "#9aa6a3";
      const name = escapeHtml(p.name);
      // 단일 섹션 — grade letter · 매장명 · 지원금 한 줄, 보더 컬러로 등급 인코딩
      const html = `
        <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
          <div style="display:inline-flex;align-items:center;gap:6px;padding:5px 11px;background:#ffffff;border:1.5px solid ${color};border-radius:9999px;box-shadow:0 3px 10px rgba(0,18,14,.18);font-size:11.5px;line-height:1.3;font-weight:600;white-space:nowrap;max-width:240px;">
            <span style="color:${color};font-weight:700;flex-shrink:0;">${p.grade}</span>
            <span style="color:#cccccc;flex-shrink:0;">·</span>
            <span style="color:#1d1d1f;overflow:hidden;text-overflow:ellipsis;min-width:0;">${name}</span>
            <span style="color:#cccccc;flex-shrink:0;">·</span>
            <span style="color:#1d1d1f;font-weight:700;flex-shrink:0;">${p.supportAmount.toLocaleString()}원</span>
          </div>
          <svg width="14" height="10" viewBox="0 0 14 10" style="margin-top:-1px;display:block;"><path d="M7 10 L0 0 L14 0 Z" fill="#ffffff" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" /><path d="M2 1 L12 1" stroke="#ffffff" stroke-width="2" /></svg>
        </div>`;
      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(p.lat, p.lng),
        map: mapRef.current,
        icon: { content: html, anchor: new naver.maps.Point(120, 36) },
      });
      naver.maps.Event.addListener(marker, "click", () => setSelected(p));
      markersRef.current.push(marker);
    }

    // 핀 집합 바뀌면 중심도 따라감
    if (pins.length > 0) {
      const avg = pins.reduce(
        (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
        { lat: 0, lng: 0 }
      );
      try {
        mapRef.current.setCenter(
          new naver.maps.LatLng(avg.lat / pins.length, avg.lng / pins.length)
        );
      } catch {}
    }
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
          <StaticMapFallback pins={pins} onSelect={setSelected} fullscreen={fullscreen} />
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
          <div className="absolute left-0 right-0 bottom-0 mx-auto max-w-[480px] p-3" onClick={() => setSelected(null)}>
            <div className="rounded-lg bg-white shadow-card overflow-hidden border border-hairline" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-stretch">
                <div className="w-24 bg-parchment relative">
                  <Image
                    src={photoForStore(selected.storeId, selected.category)}
                    alt={selected.name}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 p-3 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold truncate">{selected.name}</div>
                      <div className="text-[12px] text-muted mt-0.5 truncate">{selected.area} · {selected.category}</div>
                    </div>
                    <button onClick={() => setSelected(null)} className="text-muted text-[12px] px-2 flex-shrink-0">닫기</button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-[13px] font-medium truncate">지원 ₩{selected.supportAmount.toLocaleString()} · 잔여 {selected.remain}매</div>
                    {selected.accessible ? (
                      <Link href={`/r/store/${selected.storeId}?campaign=${selected.campaignId}`} className="text-[12px] bg-ink text-white px-3 py-1.5 rounded-full whitespace-nowrap">매장 상세 →</Link>
                    ) : (
                      <span className="text-[11px] text-error whitespace-nowrap">{selected.grade}등급부터 가능</span>
                    )}
                  </div>
                </div>
              </div>
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
          const color = p.accessible ? GRADE_COLOR[p.grade] || "#6a6a6a" : "#9aa6a3";
          return (
            <button
              key={p.storeId}
              onClick={() => onSelect(p)}
              className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center"
              style={{ left: `${x}px`, top: `${y}px` }}
            >
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white shadow-sm border text-[11px] font-semibold max-w-[220px] whitespace-nowrap"
                style={{ borderColor: color }}
              >
                <span style={{ color, fontWeight: 700 }}>{p.grade}</span>
                <span className="text-mutedSoft">·</span>
                <span className="text-ink truncate min-w-0">{p.name}</span>
                <span className="text-mutedSoft">·</span>
                <span className="text-ink font-bold">{p.supportAmount.toLocaleString()}원</span>
              </div>
              <div className="text-[14px] -mt-0.5 leading-none">▼</div>
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
