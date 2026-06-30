import { SnsKind } from "@/lib/types";
import { CHANNEL_ORDER, CHANNEL_SHORT, CHANNEL_BADGE_BG, CHANNEL_LABEL } from "@/lib/channels";

// 참여 가능한 채널을 사각 라운드 아이콘(블/인/틱)으로 표기.
// 임시 디자인 — 실제 채널 로고로 교체 예정.
export default function ChannelIcons({
  channels,
  size = 18,
  className = "",
}: {
  channels: SnsKind[];
  size?: number;
  className?: string;
}) {
  const ordered = CHANNEL_ORDER.filter((c) => channels.includes(c));
  if (ordered.length === 0) return null;
  const fontSize = Math.round(size * 0.5);
  return (
    <div className={`flex items-center gap-1 ${className}`} aria-label={`참여 가능 채널: ${ordered.map((c) => CHANNEL_LABEL[c]).join(", ")}`}>
      {ordered.map((c) => (
        <span
          key={c}
          title={CHANNEL_LABEL[c]}
          className={`inline-flex items-center justify-center rounded-[5px] font-bold leading-none ${CHANNEL_BADGE_BG[c]}`}
          style={{ width: size, height: size, fontSize }}
        >
          {CHANNEL_SHORT[c]}
        </span>
      ))}
    </div>
  );
}
