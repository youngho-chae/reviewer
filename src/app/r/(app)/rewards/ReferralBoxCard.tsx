"use client";
import Link from "next/link";
import type { BoxGrade, InviteStats } from "@/lib/types";
import { SBUI } from "@/lib/storyboard";

interface Props {
  stats: InviteStats;
  myKind: "reviewer" | "owner";
}

const MILESTONES = [
  { at: 0, end: 3, label: "일반 박스", grade: "basic" as BoxGrade, ic: "🎁" },
  { at: 3, end: 5, label: "실버 박스", grade: "silver" as BoxGrade, ic: "🥈" },
  { at: 5, end: 10, label: "골드 박스", grade: "gold" as BoxGrade, ic: "🥇" },
];

export default function ReferralBoxCard({ stats, myKind }: Props) {
  const cur = MILESTONES.find((m) => stats.accepted >= m.at && stats.accepted < m.end) ?? MILESTONES[2];
  const progress = Math.min(1, (stats.accepted - cur.at) / Math.max(1, cur.end - cur.at));
  const next = MILESTONES.find((m) => m.at > stats.accepted);
  const remaining = next ? next.at - stats.accepted : 0;

  return (
    <div className="rounded-2xl p-5 bg-gradient-to-br from-brand to-[#0040a0] text-white relative overflow-hidden">
      <div className="absolute -right-6 -top-6 text-[120px] opacity-15 select-none" aria-hidden>
        {cur.ic}
      </div>
      <div className="relative">
        <div className="text-[11px] tracking-[0.14em] uppercase opacity-80">친구와 동시에 박스 받기</div>
        <div className="font-display text-[26px] leading-[1.1] mt-1.5 tracking-[-0.022em]">
          박스 등급{" "}
          <span className="text-[#ffd60a]">{cur.label}</span>
        </div>
        <div className="text-[12px] opacity-90 mt-1.5">
          누적 성공 초대 <strong>{SBUI.count}</strong> · 보너스 캐시{" "}
          <strong>{SBUI.reward}</strong>
        </div>

        {/* 진행 바 */}
        <div className="mt-4">
          <div className="h-1.5 rounded-pill bg-white/20 overflow-hidden">
            <div
              className="h-full bg-[#ffd60a] rounded-pill transition-[width] duration-500"
              style={{ width: `${Math.max(8, progress * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] mt-1.5 opacity-85">
            <span>발송 {SBUI.count} · 클릭 {SBUI.count}</span>
            <span>{next ? `다음 박스까지 친구 ${SBUI.count}` : "최고 등급 달성"}</span>
          </div>
        </div>

        <Link
          href="/r/invite/new"
          className="cp-action mt-4 inline-flex items-center justify-center h-11 px-5 rounded-pill bg-white text-ink text-[14px] font-semibold w-full"
        >
          🎁 친구에게 쏘기 →
        </Link>
        <div className="text-[10.5px] opacity-75 mt-2 leading-[1.4]">
          {myKind === "reviewer"
            ? "친구가 가입하면 친구는 첫 캠페인 +50% 지원금, 나는 박스 즉시 오픈"
            : "동료 사장님이 가입하면 양쪽 모두 첫 달 멤버십 50% 할인 + 모집 한도 보너스"}
        </div>
      </div>
    </div>
  );
}
