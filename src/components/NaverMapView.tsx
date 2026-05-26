"use client";
import Script from "next/script";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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

const GRADE_COLOR: Record<string, string> = {
  S: "#1a1a1a",
  A: "#9333ea",
  B: "#2563eb",
  C: "#16a34a",
};

// Web Mercator → 픽셀 변환 (Naver Static Map 좌표계와 호환)
function lngLatToPixel(
  lng: number,
  lat: number,
  centerLng: number,
  centerLat: number,
  level: number,
  width: number,
  height: number
): { x: number; y: number } {
  // Naver "level"은 zoom 1~14 (level↑ = 확대)
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

export default function NaverMapView({ pins, clientId, fullscreen = false }: { pins: MapStorePin[]; clientId: string; fullscreen?: boolean }) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkFailed, setSdkFailed] = useState(false);
  const [selected, setSelected] = useState<MapStorePin | null>(null);

  // 5초 내 SDK 로드 안 되면 Static Map 폴백
  useEffect(() => {
    const t = setTimeout(() => {
      if (!sdkReady) setSdkFailed(true);
    }, 5000);
    return () => clearTimeout(t);
  }, [sdkReady]);

  // Naver Maps SDK가 인증 실패 시 호출하는 글로벌 콜백 등록
  // (도메인 화이트리스트 미등록 등) → 즉시 Static Map 폴백 전환
  useEffect(() => {
    (window as any).navermap_authFailure = () => {
      // SDK가 띄우는 alert 막기 위해 즉시 폴백
      setSdkFailed(true);
    };
  }, []);

  useEffect(() => {
    if (!sdkReady || sdkFailed) return;
    if (!mapEl.current || !window.naver?.maps) return;
    if (mapRef.current) return;
    try {
      const naver = window.naver;
      const avg = pins.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
      const center = pins.length
        ? new naver.maps.LatLng(avg.lat / pins.length, avg.lng / pins.length)
        : new naver.maps.LatLng(37.5665, 126.978);

      const map = new naver.maps.Map(mapEl.current, {
        center,
        zoom: 12,
        mapTypeControl: false,
        logoControl: true,
        scaleControl: false,
        zoomControl: true,
        zoomControlOptions: { position: naver.maps.Position.RIGHT_CENTER, style: naver.maps.ZoomControlStyle.SMALL },
      });
      mapRef.current = map;

      for (const p of pins) {
        const color = p.accessible ? GRADE_COLOR[p.grade] || "#6a6a6a" : "#929292";
        const html = `
          <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
            <div style="background:${color};color:#fff;font-weight:700;font-size:11px;padding:4px 8px;border-radius:9999px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.18);white-space:nowrap;">
              ${p.grade} · ${p.supportAmount.toLocaleString()}원
            </div>
            <div style="font-size:22px;line-height:1;margin-top:-2px;">📍</div>
          </div>`;
        const marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(p.lat, p.lng),
          map,
          icon: { content: html, anchor: new naver.maps.Point(40, 38) },
        });
        naver.maps.Event.addListener(marker, "click", () => setSelected(p));
      }
    } catch {
      setSdkFailed(true);
    }
  }, [sdkReady, sdkFailed, pins]);

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`}
        onLoad={() => setSdkReady(true)}
        onError={() => setSdkFailed(true)}
      />
      <div className={fullscreen ? "relative w-full h-full" : "relative"}>
        {sdkFailed ? (
          <StaticMapFallback pins={pins} onSelect={setSelected} fullscreen={fullscreen} />
        ) : (
          <div
            ref={mapEl}
            className="w-full bg-surfaceSoft"
            style={fullscreen ? { height: "100%" } : { height: "calc(100dvh - 240px)", minHeight: 400 }}
          />
        )}
        {!sdkReady && !sdkFailed && (
          <div className="absolute inset-0 grid place-items-center bg-surfaceSoft text-muted text-[13px] pointer-events-none">
            지도를 불러오는 중...
          </div>
        )}
        {selected && (
          <div className="absolute left-0 right-0 bottom-0 mx-auto max-w-[480px] p-3" onClick={() => setSelected(null)}>
            <div className="rounded-md bg-white shadow-card overflow-hidden border border-hairline" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-stretch">
                <div className="w-20 bg-surfaceSoft grid place-items-center text-[36px]">{selected.coverEmoji}</div>
                <div className="flex-1 p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[15px] font-semibold">{selected.name}</div>
                      <div className="text-[12px] text-muted mt-0.5">{selected.area} · {selected.category}</div>
                    </div>
                    <button onClick={() => setSelected(null)} className="text-muted text-[12px] px-2">닫기</button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-[13px] font-medium">지원 ₩{selected.supportAmount.toLocaleString()} · 잔여 {selected.remain}매</div>
                    {selected.accessible ? (
                      <Link href={`/r/store/${selected.storeId}?campaign=${selected.campaignId}`} className="text-[12px] bg-ink text-white px-3 py-1.5 rounded-full">매장 상세 →</Link>
                    ) : (
                      <span className="text-[11px] text-error">{selected.grade}등급부터 가능</span>
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

// SDK 로드 실패 시 (도메인 화이트리스트 미등록 등) Static Map 폴백.
// 서버사이드 API 라우트로 Naver Static Maps에 프록시 호출 → PNG 반환.
// 그 위에 마커를 절대 위치로 오버레이.
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
      const labelChar = String.fromCharCode(65 + i); // A,B,C...
      return `marker=${encodeURIComponent(`type:t|size:mid|pos:${p.lng} ${p.lat}|label:${labelChar}`)}`;
    })
    .join("&");
  const staticUrl = `/api/map/static?center=${centerLng},${centerLat}&level=${level}&w=${Math.min(size.w, 1024)}&h=${Math.min(size.h, 1024)}&${markerParams}`;

  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden bg-surfaceSoft"
      style={fullscreen ? { height: "100%" } : { height: "calc(100dvh - 240px)", minHeight: 400 }}
    >
      {/* Static Map 배경 이미지 */}
      <img
        src={staticUrl}
        alt="매장 위치 지도"
        className="absolute inset-0 w-full h-full object-cover"
        loading="eager"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
      {/* 마커 오버레이 (클릭 가능) */}
      <div className="absolute inset-0">
        {pins.map((p, i) => {
          const { x, y } = lngLatToPixel(p.lng, p.lat, centerLng, centerLat, level, size.w, size.h);
          const color = p.accessible ? GRADE_COLOR[p.grade] || "#6a6a6a" : "#929292";
          return (
            <button
              key={p.storeId}
              onClick={() => onSelect(p)}
              className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center"
              style={{ left: `${x}px`, top: `${y}px` }}
            >
              <div
                className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full border-2 border-white shadow"
                style={{ background: color, whiteSpace: "nowrap" }}
              >
                {String.fromCharCode(65 + i)} · {p.grade}
              </div>
              <div className="text-[18px] -mt-0.5 leading-none">📍</div>
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
