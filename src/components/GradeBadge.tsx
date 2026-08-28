import Image from "next/image";
import { Grade } from "@/lib/types";

// 등급 배지 (2026-08-18 표기 방침 · 2차: 업로드 이미지 에셋으로 교체 — 구 SVG 도형 폐기)
// 정본 에셋 = public/grade-*.png (S+ 골드 육각 · S 레드 오각 · A 퍼플 다이아 ·
// B 블루 육각 · C 그린 원 · N 그레이 원). 등급명 텍스트 색은 GRADE_TEXT_CLS로 동반 표기.
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

const IMG: Record<Grade, string> = {
  "S+": "/grade-splus.png",
  S: "/grade-s.png",
  A: "/grade-a.png",
  B: "/grade-b.png",
  C: "/grade-c.png",
  N: "/grade-n.png",
};

const SIZE = { sm: 20, md: 28, lg: 40, xl: 56 } as const;

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
  const box = SIZE[size];
  if (inverted) {
    // 인버스 표면(검정 pill FAB 등 극히 제한적) — 구 pill 렌더 유지
    return (
      <span
        className={`inline-flex items-center justify-center rounded-pill flex-shrink-0 font-bold leading-none ${INVERTED_CLS}`}
        style={{ minWidth: box, height: box, fontSize: Math.round(box * 0.45) }}
      >
        {grade}
      </span>
    );
  }
  // 원본이 정확한 정사각이 아니라(96~104px) object-contain으로 비율 유지
  return (
    <Image
      src={IMG[grade]}
      alt={`${grade}등급`}
      width={box}
      height={box}
      className="inline-block flex-shrink-0 object-contain align-middle"
    />
  );
}
