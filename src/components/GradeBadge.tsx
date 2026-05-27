import { Grade } from "@/lib/types";

// V3 prototype palette — circular badge, serif glyph
const PAL: Record<Grade, { bg: string; fg: string; border?: string }> = {
  S: { bg: "#002720", fg: "#E1FF51" },
  A: { bg: "#002720", fg: "#FFFFFF" },
  B: { bg: "#5B6E6A", fg: "#FFFFFF" },
  C: { bg: "#9AA6A3", fg: "#FFFFFF" },
  N: { bg: "#FFFFFF", fg: "#002720", border: "1px solid #002720" },
};

const INVERTED = { bg: "#E1FF51", fg: "#002720" };

export default function GradeBadge({
  grade,
  size = "md",
  inverted = false,
}: {
  grade: Grade;
  size?: "sm" | "md" | "lg" | "xl";
  inverted?: boolean;
}) {
  const px = size === "xl" ? 88 : size === "lg" ? 44 : size === "sm" ? 22 : 32;
  const p = inverted ? INVERTED : PAL[grade];
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold flex-shrink-0"
      style={{
        width: px,
        height: px,
        background: p.bg,
        color: p.fg,
        border: (p as any).border || "none",
        fontFamily: '"Times New Roman", "Noto Serif KR", Georgia, serif',
        fontSize: px * 0.5,
        letterSpacing: "0.01em",
        fontWeight: 700,
      }}
    >
      {grade}
    </span>
  );
}
