"use client";
import { useEffect, useState } from "react";
import type { ViralCounter } from "@/lib/types";

/**
 * 혜택 탭 상단의 라이브 N명 카운터 — 사회적 증거 + FOMO.
 * 1.8초 주기로 /api/referral/counter 폴링.
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
        if (!cancelled) timer = setTimeout(tick, 1800);
      }
    }
    timer = setTimeout(tick, 1800);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const top = c.liveStream[0];

  return (
    <div className="rounded-md bg-ink text-white px-4 py-3 flex items-center gap-3">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inset-0 rounded-full bg-[#ff453a] animate-ping opacity-70" />
        <span className="relative rounded-full h-2 w-2 bg-[#ff453a]" />
      </span>
      <div className="text-[12px] leading-[1.45] flex-1 min-w-0">
        오늘 이 박스로{" "}
        <span className="font-semibold tabular-nums">{c.todayBoxCount.toLocaleString()}</span>명이 평균{" "}
        <strong className="text-[#ffd60a]">₩{c.todayAvgReward.toLocaleString()}</strong> 받았어요
        {top && (
          <div className="text-[11px] text-white/70 mt-0.5 truncate">
            방금 {top.nickname}이(가) ₩{top.reward.toLocaleString()} 받음
            <span className="opacity-60"> · {top.matrix}</span>
          </div>
        )}
      </div>
    </div>
  );
}
