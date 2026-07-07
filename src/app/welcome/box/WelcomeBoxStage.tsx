"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Reward } from "@/lib/types";

interface AcceptResp {
  ok: true;
  referrerReward: Reward;
  refereeReward: Reward;
}

type Stage = "shake" | "spin" | "reveal";

const REELS_POOL = ["🍝", "🍣", "💅", "🏋️", "🐶", "🎁", "🥐", "💎", "💵"];

function SlotReel({ done, finalIc }: { done: boolean; finalIc: string }) {
  return (
    <div
      className={`relative w-[80px] h-[80px] rounded-2xl text-[36px] flex items-center justify-center font-bold overflow-hidden ${done ? "bg-gradient-to-br from-[#ffd60a] to-[#f5a623] text-ink" : "bg-ink text-white"}`}
    >
      {done ? (
        <span>{finalIc}</span>
      ) : (
        <span
          className="absolute inset-0 flex items-center justify-center"
          style={{ animation: "cp-reel-spin 0.12s linear infinite" }}
        >
          {REELS_POOL[Math.floor(Math.random() * REELS_POOL.length)]}
        </span>
      )}
    </div>
  );
}

export default function WelcomeBoxStage({
  token,
  homeHref = "/r/home",
  role = "reviewer",
}: {
  token: string;
  homeHref?: string;
  role?: "reviewer" | "owner";
}) {
  const [stage, setStage] = useState<Stage>("shake");
  const [data, setData] = useState<AcceptResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function go() {
      try {
        const r = await fetch("/api/referral/accept", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token, mode: "accept" }),
        });
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          if (!cancelled) setErr(j.error || "보상 지급 실패");
          return;
        }
        const j = (await r.json()) as AcceptResp;
        if (!cancelled) setData(j);
      } catch (e) {
        if (!cancelled) setErr("네트워크 오류");
      }
    }
    go();
    const t1 = setTimeout(() => !cancelled && setStage("spin"), 700);
    const t2 = setTimeout(() => !cancelled && setStage("reveal"), 2200);
    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [token]);

  return (
    <>
      <style>{`
        @keyframes cp-reel-spin {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes cp-box-shake {
          0%,100% { transform: rotate(0deg); }
          20% { transform: rotate(-8deg) scale(1.05); }
          40% { transform: rotate(8deg) scale(1.05); }
          60% { transform: rotate(-6deg); }
          80% { transform: rotate(6deg); }
        }
        @keyframes cp-confetti-fall {
          to { transform: translateY(420px) rotate(720deg); opacity: 0; }
        }
        @keyframes cp-flip-in {
          from { opacity: 0; transform: rotateX(60deg); }
          to { opacity: 1; transform: rotateX(0); }
        }
      `}</style>

      <div className="mobile-shell min-h-[100dvh] bg-canvas">
        {/* 박스 스테이지 */}
        <div className="relative bg-gradient-to-br from-[#fff9e5] to-parchment pt-12 pb-8 px-6 text-center overflow-hidden">
          {stage === "reveal" && <Confetti />}
          {stage === "shake" && (
            <div className="text-[120px] inline-block" style={{ animation: "cp-box-shake 0.6s ease-in-out infinite" }} aria-hidden>
              🎁
            </div>
          )}
          {stage !== "shake" && (
            <div className="flex justify-center gap-2 mb-4">
              <SlotReel done={stage === "reveal"} finalIc={data?.refereeReward.kind === "membership_discount" ? "💎" : "💰"} />
              <SlotReel done={stage === "reveal"} finalIc="🎁" />
              <SlotReel done={stage === "reveal"} finalIc="🎉" />
            </div>
          )}
          <h1 className="font-display text-[28px] text-ink leading-tight tracking-[-0.022em]">
            {stage === "reveal" ? "축하해요!" : "박스 오픈 중..."}
          </h1>
          <p className="text-[14px] text-muted mt-1">친구가 보낸 환영 박스가 도착했어요</p>
        </div>

        <div className="px-6 pt-2 pb-32">
          {stage === "reveal" && data && (
            <>
              <div
                className="rounded-2xl bg-canvas border border-hairline shadow-product p-6 text-center"
                style={{ animation: "cp-flip-in 0.45s ease-out" }}
              >
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted">확정 보상</div>
                <div className="font-display text-[44px] leading-tight text-ink mt-2 tracking-[-0.028em]">
                  {data.refereeReward.kind === "support_bonus_pct" && `+${data.refereeReward.value}%`}
                  {data.refereeReward.kind === "membership_discount" && `${data.refereeReward.value}% 할인`}
                </div>
                <div className="text-[13px] text-muted mt-1">
                  {data.refereeReward.kind === "support_bonus_pct" && "첫 체험 지원금 부스트 — 체험권 사용 시 자동 적용"}
                  {data.refereeReward.kind === "membership_discount" && "첫 달 멤버십 — 결제 시 자동 적용"}
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <Link
                  href={role === "owner" ? "/o/home" : "/r/explore"}
                  className="cp-action flex-1 h-12 rounded-pill bg-ink text-white flex items-center justify-center text-[15px] font-semibold"
                >
                  {role === "owner" ? "사장님 홈 →" : "지금 사용하러 가기 →"}
                </Link>
                <Link
                  href={role === "owner" ? "/o/me" : "/r/invite/new"}
                  className="cp-action flex-1 h-12 rounded-pill bg-canvas border border-hairline text-ink flex items-center justify-center text-[15px] font-semibold"
                >
                  나도 친구에게 쏘기
                </Link>
              </div>

              <div className="text-center mt-4 text-[11px] text-muted leading-[1.4]">
                보상 유효기간 14일 · 지원금 부스트는 기준 지원금(100%)을 넘지 않는 선에서 가산됩니다
              </div>
            </>
          )}
          {err && (
            <div className="rounded-md border border-error/30 bg-error/4 p-4 text-center">
              <div className="text-[14px] font-semibold text-error">박스 오픈 실패</div>
              <div className="text-[12px] text-muted mt-2">{err}</div>
              <Link href={homeHref} className="cp-action mt-4 inline-flex h-11 px-5 rounded-pill bg-ink text-white items-center text-[14px]">
                홈으로 →
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Confetti() {
  const colors = ["#0066cc", "#ffd60a", "#34c759", "#ff453a", "#bf5af2"];
  return (
    <>
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={i}
          className="absolute top-[-20px] w-2 h-3 rounded-[1px] pointer-events-none"
          style={{
            left: `${(i * 5.4) % 100}%`,
            background: colors[i % colors.length],
            animation: "cp-confetti-fall 2.4s ease-in forwards",
            animationDelay: `${(i % 6) * 0.08}s`,
          }}
        />
      ))}
    </>
  );
}
