import { useStore } from "../hooks/useStore";

export default function LiveCounter() {
  const s = useStore();
  const c = s.getCounter();
  return (
    <div className="live-counter">
      <span className="dot" />
      <div className="text">
        오늘 이 박스로 <span className="number">{c.todayBoxCount.toLocaleString()}</span>명이 평균{" "}
        <strong>₩{c.todayAvgReward.toLocaleString()}</strong>을 받았어요
        <div className="live-ticker">
          {c.liveStream.slice(0, 1).map((row, idx) => (
            <span key={row.ts + "-" + idx} className="ticker-item">
              방금 <strong style={{ color: "#fff" }}>{row.nickname}</strong>이(가) ₩{row.reward.toLocaleString()} 받음
              <span style={{ marginLeft: 6, opacity: 0.6 }}>({row.matrix})</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
