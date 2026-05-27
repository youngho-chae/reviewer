import { Grade } from "@/lib/types";

// Apple-style grade badge — quiet grayscale ladder, SF Pro Display 600.
// No decorative serif, no glow. S anchors the system in ink; the ladder
// descends through ink → ink-muted-80 → ink-muted-48 → hairline.
const PAL: Record<Grade, { bg: string; fg: string; border?: string }> = {
  S: { bg: "#1d1d1f", fg: "#ffffff" },
  A: { bg: "#333333", fg: "#ffffff" },
  B: { bg: "#7a7a7a", fg: "#ffffff" },
  C: { bg: "#cccccc", fg: "#1d1d1f" },
  N: { bg: "#ffffff", fg: "#1d1d1f", border: "1px solid #1d1d1f" },
};

const INVERTED = { bg: "#ffffff", fg: "#1d1d1f", border: "1px solid rgba(255,255,255,0.4)" };

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
      className="inline-flex items-center justify-center rounded-full flex-shrink-0"
      style={{
        width: px,
        height: px,
        background: p.bg,
        color: p.fg,
        border: (p as any).border || "none",
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
        fontSize: px * 0.46,
        letterSpacing: "-0.022em",
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {grade}
    </span>
  );
}
