"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { REGIONS, findSido } from "@/lib/regions";
import Icon from "@/components/Icon";

/**
 * 현위치 설정 (2026-07-08 레퍼런스 반영)
 *  - 상단: 현재 선택 지역 + [현위치로 설정](GPS) — 탭 시 지역 선택 해제(현 위치 기준 복귀)
 *  - 좌측 레일: 도·특별시·광역시 (1차 필터)
 *  - 우측 리스트: 전체 + 일반 시·군·구 (2차 선택) — 선택 즉시 /r/home?area= 이동
 */
export default function RegionPicker({ current }: { current?: string }) {
  const router = useRouter();
  const [sido, setSido] = useState<string>(() => findSido(current) ?? REGIONS[0].sido);
  const region = REGIONS.find((r) => r.sido === sido) ?? REGIONS[0];

  function pick(area: string | null) {
    router.push(area ? `/r/home?area=${encodeURIComponent(area)}` : "/r/home");
  }

  return (
    <div className="fixed inset-0 z-40 mx-auto max-w-[480px] bg-canvas flex flex-col">
      {/* top-app-bar — 뒤로 + 중앙 타이틀 */}
      <div className="shrink-0 h-[52px] px-3 grid grid-cols-[40px_1fr_40px] items-center">
        <button
          type="button"
          onClick={() => router.back()}
          className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink"
          aria-label="뒤로"
        >
          <Icon name="chevron-left" variant="border" size={22} />
        </button>
        <h1 className="text-[16px] font-bold text-ink tracking-title text-center">현위치 설정</h1>
        <span />
      </div>

      {/* 현재 지역 + 현위치로 설정 */}
      <div className="shrink-0 px-5 pb-3">
        <div className="h-12 px-4 rounded-md bg-sunken flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 min-w-0">
            <Icon name="pin" variant="bold" size={16} className="text-muted shrink-0" />
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
        <div className="flex-1 overflow-y-auto pb-24" role="list" aria-label="시·군·구">
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
            const active = current === g;
            return (
              <button
                key={g}
                type="button"
                onClick={() => pick(g)}
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
  );
}
