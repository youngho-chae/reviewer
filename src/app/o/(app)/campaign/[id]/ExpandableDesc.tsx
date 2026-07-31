"use client";
import { useState } from "react";

// 매장소개 접기/더보기 (2026-07-31 시안) — 긴 소개만 [더보기] 풀폭 버튼 노출.
export default function ExpandableDesc({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 140 || text.split("\n").length > 8;

  return (
    <div>
      <p className={`text-[13px] text-ink2 leading-[1.7] whitespace-pre-line ${open ? "" : "line-clamp-[10]"}`}>{text}</p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="cp-action mt-3 w-full h-10 rounded-md border border-hairline bg-canvas text-[13px] font-semibold text-ink"
        >
          {open ? "접기" : "더보기"}
        </button>
      )}
    </div>
  );
}
