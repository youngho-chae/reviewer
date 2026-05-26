"use client";
import Script from "next/script";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// 지도 마커용 매장 데이터 (홈 페이지에서 전달)
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

export default function NaverMapView({ pins, clientId }: { pins: MapStorePin[]; clientId: string }) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<MapStorePin | null>(null);

  useEffect(() => {
    if (!ready || !mapEl.current || !window.naver?.maps) return;
    if (mapRef.current) return;
    const naver = window.naver;
    // 핀의 중심 좌표 평균
    const avg = pins.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
      { lat: 0, lng: 0 }
    );
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
  }, [ready, pins]);

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`}
        onLoad={() => setReady(true)}
      />
      <Script
        strategy="afterInteractive"
        src={`https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${clientId}`}
        onLoad={() => setReady(true)}
      />
      <div className="relative">
        <div ref={mapEl} className="w-full" style={{ height: "calc(100dvh - 220px)", minHeight: 400 }} />
        {!ready && (
          <div className="absolute inset-0 grid place-items-center bg-surfaceSoft text-muted text-[13px]">
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
