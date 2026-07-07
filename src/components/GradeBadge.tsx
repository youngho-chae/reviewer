import { Grade } from "@/lib/types";

// v2 등급 배지 — grade 토큰 컬러(gradeS..gradeN)의 소형 pill.
// [P1] 등급은 참여 자격이 아니라 혜택 크기만 나타낸다 — 잠금/오버레이 표현 금지.
const CLS: Record<Grade, string> = {
  S: "bg-gradeS text-white",
  A: "bg-gradeA text-white",
  B: "bg-gradeB text-white",
  C: "bg-gradeC text-white",
  N: "bg-gradeN text-white",
};

// 인버스 표면(검정 pill FAB 등 극히 제한적)에서만 사용
const INVERTED_CLS = "bg-canvas text-ink border border-hairline";

const SIZE = {
  sm: { box: 20, text: 11 },
  md: { box: 28, text: 13 },
  lg: { box: 40, text: 18 },
  xl: { box: 56, text: 22 },
} as const;

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
  return (
    <span
      className={`inline-flex items-center justify-center rounded-pill flex-shrink-0 font-bold leading-none ${
        inverted ? INVERTED_CLS : CLS[grade]
      }`}
      style={{ width: s.box, height: s.box, fontSize: s.text }}
    >
      {grade}
    </span>
  );
}
