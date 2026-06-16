import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../hooks/useStore";
import LiveCounter from "../components/LiveCounter";

// 슬롯 머신 리얼 — 룰렛처럼 회전했다가 멈춤
function SlotReel({ done, finalText }: { done: boolean; finalText: string }) {
  const pool = ["🍝", "🍣", "💅", "🏋️", "🐶", "🎁", "🥐"];
  return (
    <div className={`slot-reel${done ? " done" : ""}`}>
      {done ? finalText : <span className="face">{pool[Math.floor(Math.random() * pool.length)]}</span>}
    </div>
  );
}

export default function WelcomeBox() {
  const s = useStore();
  const nav = useNavigate();
  const loc = useLocation();
  const me = s.getCurrentUser();
  const token = new URLSearchParams(loc.search).get("token");

  // 환영 박스에 표시할 보상 찾기
  const rewards = useMemo(() => {
    if (!me) return [];
    return me.rewards.filter((r) => r.source === "referee_welcome").slice(0, 2);
  }, [me]);

  const [stage, setStage] = useState<"shake" | "spin" | "reveal">("shake");
  useEffect(() => {
    const t1 = setTimeout(() => setStage("spin"), 700);
    const t2 = setTimeout(() => setStage("reveal"), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!me || rewards.length === 0) {
    return (
      <div className="page">
        <div className="card">
          <div className="text-error" style={{ fontWeight: 700 }}>보상을 찾을 수 없어요</div>
          <button className="btn mt-4" onClick={() => nav("/")}>홈으로</button>
        </div>
      </div>
    );
  }

  const main = rewards.find((r) => r.kind !== "cash");
  const cashBonus = rewards.find((r) => r.kind === "cash");

  return (
    <div>
      <div className="box-stage">
        {stage === "reveal" && <Confetti />}
        {stage === "shake" && <div className="box-icon">🎁</div>}
        {(stage === "spin" || stage === "reveal") && (
          <div className="slot-reels">
            <SlotReel done={stage === "reveal"} finalText={main?.kind === "membership_discount" ? "💎" : "💰"} />
            <SlotReel done={stage === "reveal"} finalText={cashBonus ? "💵" : "🎯"} />
            <SlotReel done={stage === "reveal"} finalText="🎉" />
          </div>
        )}
        <h2>{stage === "reveal" ? "축하해요!" : "박스 오픈 중..."}</h2>
        <div className="lead">{me.nickname}님의 환영 박스</div>
      </div>

      <div className="page" style={{ paddingTop: 8 }}>
        {stage === "reveal" && (
          <>
            <LiveCounter />
            {main && (
              <div className="reveal">
                <div className="label">확정 보상</div>
                <div className="amount">
                  {main.kind === "support_bonus_pct" && `+${main.value}%`}
                  {main.kind === "membership_discount" && `${main.value}% 할인`}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {main.kind === "support_bonus_pct" && "첫 캠페인 지원금 가산"}
                  {main.kind === "membership_discount" && "첫 달 멤버십"}
                </div>
                {cashBonus && (
                  <div className="bonus">+ 보너스 캐시 ₩{cashBonus.value.toLocaleString()}</div>
                )}
              </div>
            )}

            <div className="row gap-2 mt-6">
              <button className="btn dark" style={{ flex: 1 }} onClick={() => nav("/invite/new")}>
                나도 친구에게 쏘기 →
              </button>
              <button className="btn secondary" style={{ flex: 1 }} onClick={() => nav("/")}>
                지금 사용 →
              </button>
            </div>
            <div className="muted center mt-4" style={{ fontSize: 11 }}>
              보상 유효기간 14일 · 본 보상은 캐치랭크 마케팅 정책에 따라 지급됩니다 ({token ? `토큰 ${token}` : ""})
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Confetti() {
  const colors = ["#0066cc", "#ffd60a", "#34c759", "#ff453a", "#bf5af2"];
  return (
    <>
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={i}
          className="confetti"
          style={{
            left: `${(i * 5.4) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 6) * 0.08}s`,
          }}
        />
      ))}
    </>
  );
}
