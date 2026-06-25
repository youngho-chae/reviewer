"use client";
import { useEffect, useState } from "react";

interface Props {
  fallbackArea: string;
}

/**
 * 큐레이팅 홈 헤드라인의 지역명 부분만 클라이언트로 처리.
 * GPS 권한이 있으면 reverse-geocode 결과의 동/구 표시, 그렇지 않으면 fallbackArea(첫 매장 지역) 사용.
 */
export default function HomeLocationChip({ fallbackArea }: Props) {
  const [area, setArea] = useState<string>(fallbackArea);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        try {
          const r = await fetch(`/api/map/reverse-geocode?lat=${p.coords.latitude}&lng=${p.coords.longitude}`);
          if (!r.ok) return;
          const j = await r.json();
          if (j.label) {
            // "서울 종로구 가회동" → "가회동" 만 잘라 사용
            const parts = String(j.label).split(/\s+/);
            const last = parts[parts.length - 1] || j.label;
            setArea(last);
          }
        } catch {}
      },
      () => {},
      { maximumAge: 60000, timeout: 8000 },
    );
  }, []);

  return <span className="text-brand">{area}</span>;
}
