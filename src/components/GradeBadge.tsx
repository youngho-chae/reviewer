import { Grade } from "@/lib/types";
import { gradeBg } from "@/lib/grade";

export default function GradeBadge({ grade, size = "md" }: { grade: Grade; size?: "sm" | "md" | "lg" }) {
  const px = size === "lg" ? "w-12 h-12 text-[18px]" : size === "sm" ? "w-6 h-6 text-[11px]" : "w-8 h-8 text-[13px]";
  return (
    <span className={`inline-flex items-center justify-center rounded-full font-bold ${px} ${gradeBg[grade]}`}>{grade}</span>
  );
}
