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
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [router]);

  const ms = Math.max(0, expiresAt - now);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms / 60000) % 60);
  const s = Math.floor((ms / 1000) % 60);
  if (ms === 0) return <div className="text-error text-[14px]">만료</div>;
  return (
    <div className="font-display text-[19px] text-ink tracking-[-0.022em]">
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </div>
  );
}
