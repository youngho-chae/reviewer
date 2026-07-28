"use client";
import { useRouter } from "next/navigation";

/**
 * 홈 헤더 매장 스위처 (2026-07-28 홈 개편) — 로고 옆 ▾. 매장이 2개 이상일 때만
 * 셀렉터로 동작하고, 선택은 ?store=로 홈 전체(현황·캠페인 리스트)를 필터링한다.
 */
export default function StoreSwitcher({
  stores,
  current,
}: {
  stores: Array<{ id: string; name: string }>;
  current: string; // "all" | storeId
}) {
  const router = useRouter();
  if (stores.length <= 1) return null;
  return (
    <div className="relative inline-flex items-center">
      <select
        value={current}
        onChange={(e) => router.push(e.target.value === "all" ? "/o/home" : `/o/home?store=${e.target.value}`)}
        aria-label="매장 선택"
        className="appearance-none bg-transparent pr-5 text-[14px] font-semibold text-ink"
      >
        <option value="all">전체 매장</option>
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-0 text-[11px] text-ink">▾</span>
    </div>
  );
}
