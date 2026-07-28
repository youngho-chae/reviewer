"use client";
import { useState, type ReactNode } from "react";

/**
 * 캠페인 유형 세그먼트 — 언더라인 탭 (2026-07-28 [관리] 시안).
 * 이 브랜치는 방문형(+플래그에 따라 배송)만 — 기자단(press)은 코드째 제거된 브랜치라 미노출.
 */
export default function CampaignSegments({
  segments,
}: {
  segments: Array<{ key: string; label: string; view: ReactNode }>;
}) {
  const [active, setActive] = useState(segments[0]?.key ?? "");
  const current = segments.find((s) => s.key === active) ?? segments[0];
  return (
    <div>
      <div
        className="grid border-b border-hairlineSoft"
        style={{ gridTemplateColumns: `repeat(${Math.max(segments.length, 1)}, 1fr)` }}
      >
        {segments.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActive(s.key)}
            aria-pressed={active === s.key}
            className={`cp-action h-11 text-[15px] ${
              active === s.key
                ? "font-bold text-brand border-b-2 border-brand -mb-px"
                : "font-medium text-ink2"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="pt-4">{current?.view}</div>
    </div>
  );
}
