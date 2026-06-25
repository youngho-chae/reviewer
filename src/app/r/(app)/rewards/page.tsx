import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { gradeMeets } from "@/lib/grade";
import type { Grade } from "@/lib/types";
import Icon from "@/components/Icon";
import GradeBadge from "@/components/GradeBadge";

export const dynamic = "force-dynamic";

const TIER_DESC: Record<Grade, string> = {
  S: "상위 5% 리뷰어 · 모든 캠페인 + 시그니처 우선 노출",
  A: "검증된 리뷰어 · S 제외 모든 캠페인 접근",
  B: "일반 리뷰어 · B/C 캠페인 + A 일부",
  C: "성장 단계 · C 캠페인 진입 가능",
  N: "검증 전 · SNS 연동 후 등급 산정",
};

const TIER_REQUIRE: Record<Grade, string> = {
  S: "운영팀 부여 영역 (자동 진입 불가)",
  A: "SNS 영향력 가중 합산 50,000 이상",
  B: "SNS 영향력 가중 합산 10,000 이상",
  C: "SNS 영향력 가중 합산 1,000 이상",
  N: "SNS 1개 이상 연동 시 자동 산정",
};

export default async function RewardsPage() {
  const me = await getCurrentReviewer();
  const db = await getDBAsync();
  const now = Date.now();

  // 등급별 접근 가능한 캠페인 수
  const visit = db.campaigns.filter((c) => c.kind === "visit" && c.endAt > now);
  const accessibleCount = visit.filter((c) => {
    const min: "S" | "A" | "B" | "C" =
      c.quota.C > 0 ? "C" : c.quota.B > 0 ? "B" : c.quota.A > 0 ? "A" : "S";
    return gradeMeets(me.grade, min as Grade);
  }).length;
  const totalSupport = visit.reduce((s, c) => s + c.supportAmount, 0);
  const myMaxSupport = visit
    .filter((c) => {
      const min: "S" | "A" | "B" | "C" =
        c.quota.C > 0 ? "C" : c.quota.B > 0 ? "B" : c.quota.A > 0 ? "A" : "S";
      return gradeMeets(me.grade, min as Grade);
    })
    .reduce((m, c) => Math.max(m, c.supportAmount), 0);

  const unread = db.notifications.filter((n) => n.role === "reviewer" && n.userId === me.id && !n.read).length;
  const activePasses = db.passes.filter((p) => p.reviewerId === me.id && (p.status === "active" || p.status === "used")).length;

  const tiers: Grade[] = ["S", "A", "B", "C", "N"];

  return (
    <div className="pb-24 bg-canvas">
      <div className="sticky top-0 z-30 frosted-parchment border-b border-hairlineSoft">
        <div className="h-13 px-5 flex items-center justify-between">
          <div className="text-[15px] font-semibold text-ink">혜택</div>
          <Link
            href="/r/notifications"
            className="cp-action relative w-9 h-9 rounded-full flex items-center justify-center text-ink"
            aria-label="알림"
          >
            <Icon name="bell" variant={unread > 0 ? "bold" : "border"} size={22} />
            {unread > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand" />}
          </Link>
        </div>
      </div>

      {/* 내 등급 카드 */}
      <section className="px-5 pt-6">
        <div className="rounded-2xl bg-ink text-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[12px] text-white/70">현재 등급</div>
              <div className="mt-1 flex items-center gap-2">
                <GradeBadge grade={me.grade} size="md" />
                <span className="font-display text-[28px] leading-none">{me.grade}</span>
              </div>
              <div className="text-[12px] text-white/80 mt-2 max-w-[280px]">{TIER_DESC[me.grade]}</div>
            </div>
            <Link
              href="/r/grade"
              className="cp-action text-[12px] text-white/80 underline decoration-white/30 underline-offset-4"
            >
              상세 →
            </Link>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[20px] font-semibold leading-none">{accessibleCount}</div>
              <div className="text-[10px] text-white/70 mt-1">참여 가능 매장</div>
            </div>
            <div>
              <div className="text-[20px] font-semibold leading-none">₩{myMaxSupport.toLocaleString()}</div>
              <div className="text-[10px] text-white/70 mt-1">최대 지원금</div>
            </div>
            <div>
              <div className="text-[20px] font-semibold leading-none">{activePasses}</div>
              <div className="text-[10px] text-white/70 mt-1">사용 가능 체험권</div>
            </div>
          </div>
        </div>
      </section>

      {/* 내 체험권 entry */}
      <section className="px-5 mt-4">
        <Link
          href="/r/passes"
          className="cp-action flex items-center gap-3 p-4 rounded-md border border-hairline bg-canvas"
        >
          <span className="w-10 h-10 rounded-md bg-brand/12 text-brand flex items-center justify-center">
            <Icon name="ticket" variant="bold" size={20} />
          </span>
          <div className="flex-1">
            <div className="text-[14px] font-semibold text-ink">내 체험권</div>
            <div className="text-[11px] text-muted mt-0.5">발급/사용 가능 {activePasses}개 · 작성 대기/완료 포함</div>
          </div>
          <Icon name="chevron-right" variant="border" size={14} className="text-muted" />
        </Link>
      </section>

      {/* 등급별 혜택 표 */}
      <section className="px-5 mt-8">
        <h2 className="font-display text-[22px] leading-[1.14] text-ink">등급별 혜택</h2>
        <p className="text-[12px] text-muted mt-1">
          등급은 SNS 영향력 합산에 따라 자동 산정됩니다. 상위 등급일수록 더 많은 매장에 우선 노출됩니다.
        </p>
        <div className="mt-4 space-y-2">
          {tiers.map((g) => {
            const isMe = me.grade === g;
            return (
              <div
                key={g}
                className={`flex items-start gap-3 p-3.5 rounded-md border ${
                  isMe ? "border-brand bg-brand/4" : "border-hairline bg-canvas"
                }`}
              >
                <GradeBadge grade={g} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-ink">{g} 등급</span>
                    {isMe && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-pill bg-brand text-white font-semibold">
                        내 등급
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted mt-1">{TIER_DESC[g]}</div>
                  <div className="text-[11px] text-ink2 mt-1.5">진입 조건: {TIER_REQUIRE[g]}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 등급 올리기 가이드 */}
      <section className="px-5 mt-6">
        <Link
          href="/r/grade"
          className="cp-action block rounded-md bg-parchment border border-hairline p-4"
        >
          <div className="text-[13px] font-semibold text-ink">등급 올리고 더 많은 체험 혜택 받으세요!</div>
          <div className="text-[11px] text-muted mt-1">
            진행 중 캠페인 {visit.length}개 · 총 지원금 ₩{totalSupport.toLocaleString()}
          </div>
          <div className="mt-3 inline-flex items-center gap-0.5 h-8 px-3 rounded-pill bg-canvas border border-hairline text-[12px] text-ink">
            등급별 혜택과 조건 자세히
            <Icon name="chevron-right" variant="border" size={12} />
          </div>
        </Link>
      </section>
    </div>
  );
}
