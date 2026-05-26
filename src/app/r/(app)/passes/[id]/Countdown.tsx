"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Countdown({ expiresAt }: { expiresAt: number }) {
  const router = useRouter();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // 매 5초 마다 서버 상태 갱신 (사장님이 사용 처리 시 화면이 바뀌도록)
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [router]);

  const ms = Math.max(0, expiresAt - now);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms / 60000) % 60);
  const s = Math.floor((ms / 1000) % 60);
  if (ms === 0) return <div className="text-error font-semibold">⌛ 만료되었습니다</div>;
  return (
    <div className="rounded-md bg-brandSoft text-brand p-4 text-center font-semibold">
      남은 시간 <span className="text-[22px] tracking-wider">{String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</span>
    </div>
  );
}
