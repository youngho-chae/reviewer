"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { STORYBOARD } from "@/lib/storyboard";
import Icon from "@/components/Icon";

interface Props {
  fallbackArea: string;
  /** 홈에서 선택 가능한 지역 목록 (모집 중 매장 지역) */
  areas: string[];
  /** 현재 선택된 지역 (?area= 쿼리) — 없으면 현재 위치 기준 */
  selectedArea?: string;
}

/**
 * 홈 상단 현재 위치 칩 (2026-07-07 회의):
 *  - 기본은 현재 위치(GPS reverse-geocode, 실패 시 첫 매장 지역)를 노출
 *  - 칩을 누르면 지역 변경 바텀시트가 열리고, 지역을 고르면 홈의
 *    '걸어서 갈 수 있어요' 영역만 해당 지역 기준으로 변경된다 (?area= 쿼리).
 *  - 탐색 페이지는 진입 시 현재 위치를 기본값으로 사용 (이 선택과 무관)
 */
export default function HomeLocationChip({ fallbackArea, areas, selectedArea }: Props) {
  const router = useRouter();
  const [gpsArea, setGpsArea] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
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
  }, []);

  const label = selectedArea ?? gpsArea ?? fallbackArea;

  function pick(area: string | null) {
    setOpen(false);
    router.push(area ? `/r/home?area=${encodeURIComponent(area)}` : "/r/home");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cp-action inline-flex items-center gap-1 text-[18px] font-bold text-ink tracking-title"
        aria-label="지역 변경"
        aria-expanded={open}
      >
        <Icon name="pin" variant="bold" size={18} className="text-ink" />
        <span className="text-ink">{label}</span>
        <Icon name="chevron-down" variant="border" size={16} className="text-muted" />
      </button>

      {/* bottom-sheet — 지역 변경 */}
      {open && (
        <div className="fixed inset-0 bg-ink/45 z-50 flex items-end" onClick={() => setOpen(false)}>
          <div
            className="bg-canvas w-full max-w-[480px] mx-auto rounded-t-xl px-5 pt-3 pb-8 max-h-[70dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pb-3">
              <span className="w-9 h-1 rounded-pill bg-borderStrong" />
            </div>
            <h2 className="text-[18px] font-bold text-ink tracking-title">어느 지역의 체험을 볼까요?</h2>
            <p className="mt-1 text-[13px] text-muted">‘걸어서 갈 수 있어요’가 선택한 지역 기준으로 바뀌어요.</p>
            <div className="mt-4 space-y-1.5">
              <button
                type="button"
                onClick={() => pick(null)}
                className={`w-full h-12 px-4 rounded-md text-left text-[15px] flex items-center justify-between ${
                  !selectedArea ? "border-[1.5px] border-brand text-brand font-semibold" : "border border-hairline text-ink"
                }`}
              >
                <span>📍 현재 위치</span>
                {!selectedArea && <span className="text-[12px] font-semibold">선택됨</span>}
              </button>
              {areas.map((a) => {
                const active = selectedArea === a;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => pick(a)}
                    className={`w-full h-12 px-4 rounded-md text-left text-[15px] flex items-center justify-between ${
                      active ? "border-[1.5px] border-brand text-brand font-semibold" : "border border-hairline text-ink"
                    }`}
                  >
                    <span>{a}</span>
                    {active && <span className="text-[12px] font-semibold">선택됨</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
