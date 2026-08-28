import { Grade } from "@/lib/types";

// 등급 배지 (2026-08-18 표기 방침 확정) — 등급마다 고유 도형·색상:
//  S+ 골드 육각형 · S 레드 오각형 · A 퍼플 다이아몬드 · B 블루 육각형(가로) ·
//  C 그린 원형 · N 그레이 원형. 등급명 텍스트 색은 GRADE_TEXT_CLS로 동반 표기.
// [P1] 등급은 참여 자격이 아니라 혜택 크기만 나타낸다 — 잠금/오버레이 표현 금지.

// 등급명("{g}등급") 텍스트 색 — 배지와 동일 계열
export const GRADE_TEXT_CLS: Record<Grade, string> = {
  "S+": "text-[#F59E0B]",
  S: "text-[#EF4444]",
  A: "text-[#7C3AED]",
  B: "text-[#2563EB]",
  C: "text-[#16A34A]",
  N: "text-[#9CA3AF]",
};

// 도형 path (viewBox 0 0 24 24) — circle류는 별도 렌더
const SHAPE: Record<Grade, { fill: string; d?: string; circle?: boolean }> = {
  "S+": { fill: "#F5B301", d: "M12 1 L21.5 6.5 V17.5 L12 23 L2.5 17.5 V6.5 Z" }, // 골드 육각(세로)
  S: { fill: "#F0554D", d: "M12 1.4 L22.2 9 L18.3 21.6 H5.7 L1.8 9 Z" }, // 레드 오각
  A: { fill: "#8B5CF6" }, // 퍼플 다이아몬드 (rect rotate)
  B: { fill: "#3B82F6", d: "M6.4 2.6 H17.6 L23 12 L17.6 21.4 H6.4 L1 12 Z" }, // 블루 육각(가로)
  C: { fill: "#22A55B", circle: true },
  N: { fill: "#9CA3AF", circle: true },
};

const SIZE = {
  sm: { box: 20, text: 10 },
  md: { box: 28, text: 12 },
  lg: { box: 40, text: 16 },
  xl: { box: 56, text: 21 },
} as const;

const INVERTED_CLS = "bg-canvas text-ink border border-hairline";

export default function GradeBadge({
  grade,
  size = "md",
  inverted = false,
}: {
  grade: Grade;
  size?: "sm" | "md" | "lg" | "xl";
  inverted?: boolean;
}) {
  const s = SIZE[size];
  if (inverted) {
    // 인버스 표면(검정 pill FAB 등 극히 제한적) — 구 pill 렌더 유지
    return (
      <span
        className={`inline-flex items-center justify-center rounded-pill flex-shrink-0 font-bold leading-none ${INVERTED_CLS}`}
        style={{ minWidth: s.box, height: s.box, fontSize: s.text }}
      >
        {grade}
      </span>
    );
  }
  const shape = SHAPE[grade];
  const letterSize = grade === "S+" ? s.text * 0.82 : s.text;
  return (
    <svg
      width={s.box}
      height={s.box}
      viewBox="0 0 24 24"
      className="inline-block flex-shrink-0 align-middle"
      role="img"
      aria-label={`${grade}등급`}
    >
      {shape.circle ? (
        <circle cx="12" cy="12" r="10.8" fill={shape.fill} />
      ) : shape.d ? (
        <path d={shape.d} fill={shape.fill} />
      ) : (
        // A — 라운드 다이아몬드
        <rect x="4.4" y="4.4" width="15.2" height="15.2" rx="3.6" fill={shape.fill} transform="rotate(45 12 12)" />
      )}
      <text
        x="12"
        y="12.6"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontWeight="800"
        fontSize={letterSize}
        style={{ fontFamily: "inherit" }}
      >
        {grade}
      </text>
    </svg>
  );
}
