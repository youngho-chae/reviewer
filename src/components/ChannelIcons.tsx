import Image from "next/image";
import { SnsKind } from "@/lib/types";
import { CHANNEL_ORDER, CHANNEL_LABEL, CHANNEL_ICON_SRC } from "@/lib/channels";

// SNS 채널 아이콘 (2026-08-18 — 구 파스텔 텍스트 배지("블로그/인스타/틱톡" 칩) 대체).
// 실제 브랜드 아이콘 PNG(정본 CHANNEL_ICON_SRC — channels.ts)를 렌더, 시그니처
// 순서 고정: 블로그 → 인스타 → 틱톡. size = 아이콘 한 변(px), 기본 18.
// (체험권 상세의 채널 컬러 배너 박스는 배지가 아니라 유지 — snsBlogBg 계열 토큰 존치)

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
  return (
    <div
      className={`flex items-center gap-1 ${className}`}
      aria-label={`참여 가능 채널: ${ordered.map((c) => CHANNEL_LABEL[c]).join(", ")}`}
    >
      {ordered.map((c) => (
        <Image
          key={c}
          src={CHANNEL_ICON_SRC[c]}
          alt={CHANNEL_LABEL[c]}
          title={CHANNEL_LABEL[c]}
          width={size}
          height={size}
          className="shrink-0 rounded-[4px]"
        />
      ))}
    </div>
  );
}
