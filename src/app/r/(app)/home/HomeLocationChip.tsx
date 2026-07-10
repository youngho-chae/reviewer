"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { STORYBOARD } from "@/lib/storyboard";
import Icon from "@/components/Icon";
import LocationSheet from "./LocationSheet";

interface Props {
  fallbackArea: string;
  /** 현재 선택된 지역 (?area= 쿼리) — 없으면 현재 위치 기준 */
  selectedArea?: string;
}

/**
 * 홈 상단 현재 위치 영역 (2026-07-08 레퍼런스 반영):
 *  - {지역명 ⌄} 탭 → 현위치 설정 **바텀시트**(LocationSheet) — 시도 1차 → 시군구 2차 + 최근 선택
 *  - 구분선 우측 GPS(크로스헤어) 아이콘 탭 → 선택 지역 해제 + 현 위치로 갱신
 *  - '걸어서 갈 수 있어요'만 선택 지역 기준으로 변경(탐색은 진입 시 현재 위치 기본값)
 */
export default function HomeLocationChip({ fallbackArea, selectedArea }: Props) {
  const router = useRouter();
  const [gpsArea, setGpsArea] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function locate() {
    // [스토리보드] fallbackArea("지역")를 GPS로 덮어쓰지 않음
    if (STORYBOARD) return;
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
            setGpsArea(parts[parts.length - 1] || j.label);
          }
        } catch {}
      },
      () => {},
      { maximumAge: 60000, timeout: 8000 },
    );
  }

  useEffect(() => {
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const label = selectedArea ?? gpsArea ?? fallbackArea;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="cp-action inline-flex items-center gap-1 text-[18px] font-bold text-ink tracking-title"
        aria-label="지역 변경 — 현위치 설정 열기"
      >
        <span className="text-ink">{label}</span>
        <Icon name="chevron-down" variant="border" size={16} className="text-muted" />
      </button>
      <span className="w-px h-4 bg-hairline" aria-hidden />
      <button
        type="button"
        onClick={() => {
          locate();
          router.push("/r/home"); // 선택 지역 해제 → 현 위치 기준 복귀
        }}
        className="cp-action w-8 h-8 rounded-full flex items-center justify-center text-ink"
        aria-label="현 위치로 갱신"
      >
        <Icon name="crosshair" variant="border" size={19} />
      </button>

      {sheetOpen && <LocationSheet current={label} onClose={() => setSheetOpen(false)} />}
    </div>
  );
}
