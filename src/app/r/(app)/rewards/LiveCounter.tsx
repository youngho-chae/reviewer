"use client";
import { useEffect, useState } from "react";
import type { ViralCounter } from "@/lib/types";
import { SBUI } from "@/lib/storyboard";

/**
 * 혜택 탭 상단의 라이브 카운터 — 실제 발생한 보상 이벤트만 표시한다 (조작·노이즈 없음).
 * 10초 주기로 /api/referral/counter 폴링.
 */
export default function LiveCounter({ initial }: { initial: ViralCounter }) {
  const [c, setC] = useState<ViralCounter>(initial);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function tick() {
      try {
        const r = await fetch("/api/referral/counter", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as ViralCounter;
        if (!cancelled) setC(j);
      } catch {}
      finally {
        if (!cancelled) timer = setTimeout(tick, 10_000);
      }
    }
    timer = setTimeout(tick, 10_000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const top = c.liveStream[0];
  if (!top) return null;

  return (
    <div className="rounded-md bg-tile1 text-white px-4 py-3 flex items-center gap-3">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inset-0 rounded-full bg-[#ff453a] animate-ping opacity-70" />
        <span className="relative rounded-full h-2 w-2 bg-[#ff453a]" />
      </span>
      <div className="text-[12px] leading-[1.45] flex-1 min-w-0">
        오늘 열린 박스 <span className="font-semibold">{SBUI.liveCount}</span>개
        <div className="text-[11px] text-white/70 mt-0.5 truncate">
          최근: {top.nickname} — <strong className="text-[#FDE047]">{SBUI.reward}</strong>
          <span className="opacity-60"> · {SBUI.matrix}</span>
        </div>
      </div>
    </div>
  );
}
