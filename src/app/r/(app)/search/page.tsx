"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RECENT_SEARCHES_KEY, getRecent, pushRecent, removeRecent, clearRecent } from "@/lib/recent-local";
import Icon from "@/components/Icon";

/**
 * 검색 화면 (2026-07-08 레퍼런스 반영, R-14)
 *  - 상단 ← + 퍼플 보더 검색 input("어디로 가볼까요?") + 돋보기 제출
 *  - 최근 검색어: localStorage 칩(개별 ✕·전체 삭제) — 기기 로컬 전용
 *  - 제출/칩 탭 → /r/explore?mode=list&q= (탐색 리스트가 지역·매장·키워드 전체 검색 수행)
 */
export default function SearchPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(getRecent(RECENT_SEARCHES_KEY));
  }, []);

  function go(term: string) {
    const v = term.trim();
    if (!v) return;
    pushRecent(RECENT_SEARCHES_KEY, v, 10);
    router.push(`/r/explore?mode=list&q=${encodeURIComponent(v)}`);
  }

  return (
    <div className="fixed inset-0 z-40 mx-auto max-w-[480px] bg-canvas flex flex-col">
      {/* 상단 — 뒤로 + 검색 input */}
      <div className="shrink-0 px-3 pt-3 pb-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => router.back()}
          className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink shrink-0"
          aria-label="뒤로"
        >
          <Icon name="chevron-left" variant="border" size={22} />
        </button>
        <form
          className="flex-1 relative"
          onSubmit={(e) => {
            e.preventDefault();
            go(q);
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            enterKeyHint="search"
            placeholder="어디로 가볼까요?"
            className="w-full h-12 pl-4 pr-12 rounded-pill border-[1.5px] border-brand focus:outline-none text-[15px] bg-canvas"
            aria-label="검색어"
          />
          <button
            type="submit"
            className="cp-action absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-ink"
            aria-label="검색"
          >
            <Icon name="search" variant="border" size={20} />
          </button>
        </form>
      </div>

      {/* 최근 검색어 */}
      <div className="px-5 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-ink">최근 검색어</h2>
          {recent.length > 0 && (
            <button
              type="button"
              onClick={() => setRecent(clearRecent(RECENT_SEARCHES_KEY))}
              className="cp-action text-[12px] text-muted"
            >
              전체 삭제
            </button>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="mt-3 text-[14px] text-mutedSoft">최근 검색어가 없습니다.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {recent.map((r) => (
              <span
                key={r}
                className="inline-flex items-center gap-1.5 h-10 pl-4 pr-3 rounded-pill border border-hairline bg-canvas text-[14px] text-ink"
              >
                <button type="button" onClick={() => go(r)} className="cp-action font-medium">
                  {r}
                </button>
                <button
                  type="button"
                  onClick={() => setRecent(removeRecent(RECENT_SEARCHES_KEY, r))}
                  aria-label={`${r} 삭제`}
                  className="cp-action text-muted"
                >
                  <Icon name="x" variant="border" size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
