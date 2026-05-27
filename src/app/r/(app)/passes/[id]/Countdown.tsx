"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  expiresAt: number;
  mode?: "hms" | "dhm";
  className?: string;
  // 만료 시 텍스트 커스터마이즈
  expiredText?: string;
}

export default function Countdown({ expiresAt, mode = "hms", className, expiredText = "만료" }: Props) {
  const router = useRouter();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // 주기적으로 RSC 새로고침 (사장님이 사용 처리 → 상태 전환)
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [router]);

  const ms = Math.max(0, expiresAt - now);
  if (ms === 0) {
    return <div className={`text-error text-[14px] ${className || ""}`}>{expiredText}</div>;
  }

  if (mode === "dhm") {
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return (
      <div className={`font-display text-[19px] text-ink tracking-[-0.022em] ${className || ""}`}>
        {d > 0 && <span>{d}일 </span>}
        {h}시간 {m}분
      </div>
    );
  }

  // hms — 24h 이내 카운트다운 (방문형 active 패스)
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms / 60000) % 60);
  const s = Math.floor((ms / 1000) % 60);
  return (
    <div className={`font-display text-[19px] text-ink tracking-[-0.022em] ${className || ""}`}>
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </div>
  );
}
