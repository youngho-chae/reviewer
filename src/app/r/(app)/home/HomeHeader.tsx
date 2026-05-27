"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import GradeBadge from "@/components/GradeBadge";
import Icon from "@/components/Icon";
import { Grade } from "@/lib/types";

interface Props {
  nickname: string;
  grade: Grade;
  tierDesc: string;
  completedReviews: number;
  qualityScore: number;
  activeNow: number;
  search: string;
  onSearchChange: (v: string) => void;
}

type LocState =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; lat: number; lng: number; label?: string }
  | { state: "denied" }
  | { state: "unsupported" };

// Naver reverse geocode through our server proxy (no client key exposed).
// Returns short label like "서울 종로구 가회동" or null on failure.
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(`/api/map/reverse-geocode?lat=${lat}&lng=${lng}`);
    if (!res.ok) return null;
    const j = await res.json();
    return j.label || null;
  } catch {
    return null;
  }
}

export default function HomeHeader({
  nickname,
  grade,
  tierDesc,
  completedReviews,
  qualityScore,
  activeNow,
  search,
  onSearchChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loc, setLoc] = useState<LocState>({ state: "idle" });
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLoc({ state: "unsupported" });
      return;
    }
    setLoc({ state: "loading" });
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const lat = p.coords.latitude;
        const lng = p.coords.longitude;
        const label = await reverseGeocode(lat, lng);
        setLoc({ state: "ok", lat, lng, label: label || undefined });
      },
      () => setLoc({ state: "denied" }),
      { maximumAge: 60000, timeout: 8000 }
    );
  }, []);

  function locText() {
    if (loc.state === "loading") return "현재 위치 확인 중...";
    if (loc.state === "ok") return loc.label || `GPS 위치 · ${loc.lat.toFixed(3)}, ${loc.lng.toFixed(3)}`;
    if (loc.state === "denied") return "위치 권한이 꺼져 있어요";
    if (loc.state === "unsupported") return "위치 정보를 사용할 수 없어요";
    return "위치 확인 안 됨";
  }

  return (
    <>
      {/* Accordion — collapsed by default. Header row reads "내 정보 보기" */}
      <section className="bg-parchment border-b border-hairlineSoft">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="cp-profile-panel"
          className="w-full px-6 py-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <GradeBadge grade={grade} size="sm" />
            <span className="text-[15px] text-ink">내 정보 보기</span>
            <span className="text-[12px] text-muted">{grade}등급 · 완료 {completedReviews}건</span>
          </div>
          <Icon
            name="chevron-down"
            variant={open ? "bold" : "border"}
            size={16}
            className={`transition-transform duration-200 text-muted ${open ? "rotate-180 text-ink" : ""}`}
          />
        </button>

        {open && (
          <div id="cp-profile-panel" className="px-6 pt-2 pb-10 text-center border-t border-hairlineSoft">
            <div className="flex justify-center mb-4 mt-6">
              <GradeBadge grade={grade} size="xl" />
            </div>
            <h1 className="font-display text-[40px] leading-[1.07] text-ink">{grade}등급</h1>
            <p className="mt-2 text-[19px] text-ink2 leading-[1.4]">{tierDesc}</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/r/grade"
                className="cp-action inline-flex items-center h-11 px-5 rounded-pill bg-brand text-white text-[17px]"
              >
                등급 자세히 보기
              </Link>
            </div>

            <div className="mt-10 max-w-[360px] mx-auto grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-[28px] font-semibold text-ink tracking-[-0.022em] leading-none">{completedReviews}</div>
                <div className="text-[12px] text-muted mt-1.5">완료 리뷰</div>
              </div>
              <div className="text-center border-l border-r border-hairline">
                <div className="text-[28px] font-semibold text-ink tracking-[-0.022em] leading-none">{qualityScore || "—"}</div>
                <div className="text-[12px] text-muted mt-1.5">리뷰 점수</div>
              </div>
              <div className="text-center">
                <div className="text-[28px] font-semibold text-ink tracking-[-0.022em] leading-none">{activeNow}</div>
                <div className="text-[12px] text-muted mt-1.5">진행 중</div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Greeting */}
      <div className="px-6 pt-10">
        <h2 className="font-display text-[28px] leading-[1.14] text-ink">안녕하세요, {nickname}님.</h2>

        {/* GPS location chip — GPS 획득 시 bold, 그 외 border */}
        <div className="mt-2 flex items-center gap-1.5 text-[14px] text-muted">
          <Icon
            name="pin"
            variant={loc.state === "ok" ? "bold" : "border"}
            size={14}
            className={loc.state === "ok" ? "text-brand" : ""}
          />
          <span>{locText()}</span>
          {loc.state === "denied" && (
            <button
              type="button"
              onClick={() => searchRef.current?.focus()}
              className="ml-1 text-brand"
            >
              지역 직접 검색
            </button>
          )}
        </div>
      </div>

      {/* Search input — search 아이콘은 focus/입력 시 bold */}
      <div className="px-6 mt-4">
        <div className="relative">
          <Icon
            name="search"
            variant={search ? "bold" : "border"}
            size={16}
            className={`absolute left-4 top-1/2 -translate-y-1/2 ${search ? "text-ink" : "text-muted"}`}
          />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="동네·지역명 또는 매장명 검색 (예: 한남동)"
            className="w-full h-11 pl-11 pr-10 rounded-pill bg-parchment border border-hairline text-[15px] focus:border-brand focus:bg-canvas focus:outline-none transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="검색어 지우기"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-mutedSoft/40 flex items-center justify-center text-ink"
            >
              <Icon name="x" variant="bold" size={10} />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
