import { SnsKind } from "@/lib/types";
import { CHANNEL_ORDER, CHANNEL_LABEL } from "@/lib/channels";

// SNS 배지 (디자인 시스템 v2 `sns-badge`) — 파스텔 bg + 컬러 텍스트 사각(4px) 칩.
// 시그니처 아이덴티티: 블로그(그린) → 인스타(핑크) → 틱톡(시안) 순서 고정.
const BADGE: Record<SnsKind, { label: string; cls: string }> = {
  naver_blog: { label: "블로그", cls: "bg-snsBlogBg text-snsBlogText" },
  instagram: { label: "인스타", cls: "bg-snsInstaBg text-snsInstaText" },
  tiktok: { label: "틱톡", cls: "bg-snsTiktokBg text-snsTiktokText" },
};

export default function ChannelIcons({
  channels,
  size = 18,
  className = "",
}: {
  channels: SnsKind[];
  size?: number; // v1 호환 — 18 미만이면 소형 배지
  className?: string;
}) {
  const ordered = CHANNEL_ORDER.filter((c) => channels.includes(c));
  if (ordered.length === 0) return null;
  const small = size < 16;
  return (
    <div
      className={`flex items-center gap-1 ${className}`}
      aria-label={`참여 가능 채널: ${ordered.map((c) => CHANNEL_LABEL[c]).join(", ")}`}
    >
      {ordered.map((c) => (
        <span
          key={c}
          title={CHANNEL_LABEL[c]}
          className={`inline-flex items-center rounded-xs font-semibold leading-none ${BADGE[c].cls} ${
            small ? "px-1 py-0.5 text-[10px]" : "px-1.5 py-1 text-[12px]"
          }`}
        >
          {BADGE[c].label}
        </span>
      ))}
    </div>
  );
}
