"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { REGIONS, findSido, regionLabel } from "@/lib/regions";
import { RECENT_REGIONS_KEY, getRecent, pushRecent, removeRecent, clearRecent } from "@/lib/recent-local";
import Icon from "@/components/Icon";

/**
 * 현위치 설정 바텀시트 (2026-07-08 레퍼런스 반영 — 기존 /r/location 전체 페이지에서 전환)
 *  - 헤더(타이틀+✕) · 퍼플 틴트 안내 배너 · 현재 지역 바 + [현위치로 설정]
 *  - 최근 선택: localStorage 칩(개별 삭제·전체 삭제) — 기기 로컬 전용
 *  - 하단 2단: 좌 시도 레일(1차) / 우 전체+시군구(2차) — 선택 즉시 /r/home?area= 이동
 */
export default function LocationSheet({
  current,
  onClose,
  onPick,
  title = "현위치 설정",
}: {
  current?: string;
  onClose: () => void;
  // 지정 시 라우팅 대신 콜백으로 선택값 전달 — 탐색 필터 시트 등에서 재사용 (홈 기본 동작 무영향)
  onPick?: (area: string | null) => void;
  title?: string;
}) {
  const router = useRouter();
  const [sido, setSido] = useState<string>(() => findSido(current) ?? REGIONS[0].sido);
  const [recent, setRecent] = useState<string[]>([]);
  const region = REGIONS.find((r) => r.sido === sido) ?? REGIONS[0];

  useEffect(() => {
    setRecent(getRecent(RECENT_REGIONS_KEY));
  }, []);

  function pick(area: string | null) {
    if (area) setRecent(pushRecent(RECENT_REGIONS_KEY, area, 5));
    onClose();
    if (onPick) {
      onPick(area);
      return;
    }
    router.push(area ? `/r/home?area=${encodeURIComponent(area)}` : "/r/home");
  }

  return (
    <div className="fixed inset-0 bg-ink/45 z-50 flex items-end" onClick={onClose}>
      <div
        className="bg-canvas w-full max-w-[480px] mx-auto rounded-t-xl flex flex-col"
        style={{ maxHeight: "85dvh", height: "85dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 — 타이틀 + 닫기 */}
        <div className="shrink-0 px-5 pt-5 pb-3 flex items-center justify-between">
          <h2 className="text-[18px] font-bold text-ink tracking-title">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="cp-action w-9 h-9 -mr-2 rounded-full flex items-center justify-center text-ink"
            aria-label="닫기"
          >
            <Icon name="x" variant="border" size={20} />
          </button>
        </div>

        {/* 안내 배너 — 퍼플 틴트 */}
        <div className="shrink-0 px-5">
          <div className="rounded-md bg-brandSoft py-2.5 text-center text-[13px] text-brand font-medium">
            위치를 설정하면 가까운 체험을 추천해드릴게요
          </div>
        </div>

        {/* 현재 지역 + 현위치로 설정 */}
        <div className="shrink-0 px-5 pt-3">
          <div className="h-12 px-4 rounded-md bg-sunken flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <Icon name="pin" variant="bold" size={16} className="text-brand shrink-0" />
              <span className="text-[15px] font-semibold text-ink truncate">{current ?? "현재 위치"}</span>
            </span>
            <button
              type="button"
              onClick={() => pick(null)}
              className="cp-action shrink-0 inline-flex items-center gap-1 text-[13px] font-semibold text-brand"
              aria-label="현위치로 설정"
            >
              <Icon name="crosshair" variant="border" size={15} />
              현위치로 설정
            </button>
          </div>
        </div>

        {/* 최근 선택 — localStorage 칩 (기기 로컬 전용) */}
        <div className="shrink-0 px-5 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-ink">최근 선택</h3>
            {recent.length > 0 && (
              <button
                type="button"
                onClick={() => setRecent(clearRecent(RECENT_REGIONS_KEY))}
                className="cp-action text-[12px] text-muted"
              >
                전체 삭제
              </button>
            )}
          </div>
          {recent.length === 0 ? (
            <p className="mt-2.5 text-[14px] text-mutedSoft">최근 선택한 지역이 없습니다.</p>
          ) : (
            <div className="mt-2.5 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {recent.map((r) => (
                <span
                  key={r}
                  className="shrink-0 inline-flex items-center gap-1.5 h-9 pl-3.5 pr-2.5 rounded-pill border border-hairline bg-canvas text-[14px] text-ink"
                >
                  <button type="button" onClick={() => pick(r)} className="cp-action font-medium">
                    {r}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecent(removeRecent(RECENT_REGIONS_KEY, r))}
                    aria-label={`${r} 삭제`}
                    className="cp-action text-muted"
                  >
                    <Icon name="x" variant="border" size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 1차(시도) 레일 + 2차(시군구) 리스트 */}
        <div className="flex-1 min-h-0 flex border-t border-hairlineSoft">
          <div className="w-[108px] shrink-0 bg-sunken overflow-y-auto" role="tablist" aria-label="도·특별시·광역시">
            {REGIONS.map((r) => {
              const active = r.sido === sido;
              return (
                <button
                  key={r.sido}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSido(r.sido)}
                  className={`w-full h-[52px] px-4 text-left text-[15px] ${
                    active ? "bg-canvas text-brand font-bold" : "text-ink2 font-medium"
                  }`}
                >
                  {r.sido}
                </button>
              );
            })}
          </div>
          <div className="flex-1 overflow-y-auto pb-10" role="list" aria-label="시·군·구">
            <button
              type="button"
              onClick={() => pick(region.sido)}
              className={`w-full h-[52px] px-5 text-left text-[15px] ${
                current === region.sido ? "text-brand font-bold" : "text-ink font-medium"
              }`}
            >
              전체
            </button>
            {region.gugun.map((g) => {
              // 지역 표기 규칙 (2026-07-12): 시군구명이 시도 간 중복(부산/대구 "중구" 등)이면
              // "{시도} {시군구}" 복합 표기, 전국 유일한 단독 지명이면 시군구만 표기 (regions.ts
              // regionLabel). 어느 쪽이든 regionCenter가 기준 좌표를 해석한다 (geo.ts).
              const label = regionLabel(region.sido, g);
              const active = current === label || current === g || current === `${region.sido} ${g}`;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => pick(label)}
                  className={`w-full h-[52px] px-5 text-left text-[15px] ${
                    active ? "text-brand font-bold" : "text-ink font-medium"
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
