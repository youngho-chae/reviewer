"use client";
import Link from "next/link";
import type { BoxGrade, InviteStats } from "@/lib/types";
import { SBUI, sbNum } from "@/lib/storyboard";

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

  return (
    <div className="rounded-lg p-5 bg-brand text-white relative overflow-hidden">
      <div className="absolute -right-6 -top-6 text-[120px] opacity-15 select-none" aria-hidden>
        {cur.ic}
      </div>
      <div className="relative">
        <div className="text-[11px] tracking-[0.14em] uppercase opacity-80">친구와 동시에 박스 받기</div>
        <div className="text-[20px] font-bold leading-[1.3] mt-1.5 tracking-title">
          박스 등급{" "}
          <span className="text-[#FDE047]">{cur.label}</span>
        </div>
        <div className="text-[12px] opacity-90 mt-1.5">
          누적 성공 초대 <strong>{sbNum(SBUI.count, `${stats.accepted}건`)}</strong> · 박스가 클수록 지원금 부스트 UP
        </div>

        {/* 진행 바 */}
        <div className="mt-4">
          <div className="h-1.5 rounded-pill bg-white/20 overflow-hidden">
            <div
              className="h-full bg-[#FDE047] rounded-pill transition-[width] duration-500"
              style={{ width: `${Math.max(8, progress * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] mt-1.5 opacity-85">
            <span>발송 {sbNum(SBUI.count, `${stats.sent}건`)} · 클릭 {sbNum(SBUI.count, `${stats.clicked}건`)}</span>
            <span>{next ? `다음 박스까지 친구 ${sbNum(SBUI.quota, `${next.at - stats.accepted}명`)}` : "최고 등급 달성"}</span>
          </div>
        </div>

        <Link
          href="/r/invite/new"
          className="cp-action mt-4 inline-flex items-center justify-center h-11 px-5 rounded-md bg-white text-brand text-[15px] font-bold w-full"
        >
          🎁 친구에게 쏘기 →
        </Link>
        <div className="text-[10.5px] opacity-75 mt-2 leading-[1.4]">
          {myKind === "reviewer"
            ? "친구가 가입하면 친구는 첫 체험 지원금 +50%, 나는 다음 체험 지원금 부스트 (일반 +10% / 실버 +20% / 골드 +30%)"
            : "동료 사장님이 가입하면 상대는 첫 달 멤버십 50% 할인, 나는 멤버십 할인 또는 모집 한도 보너스"}
        </div>
      </div>
    </div>
  );
}
