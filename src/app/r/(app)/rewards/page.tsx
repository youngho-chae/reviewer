import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import Icon from "@/components/Icon";
import LiveCounter from "./LiveCounter";
import ReferralBoxCard from "./ReferralBoxCard";
import { counterWithNoise, defaultInviteStats, matrixOf, refereePreview, rewardEmoji, rewardLabel } from "@/lib/referral";
import type { Invite } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const me = await getCurrentReviewer();
  const db = await getDBAsync();

  // 바이럴 인벤토리 ──
  const inviteStats = me.inviteStats ?? defaultInviteStats();
  const myRewards = (db.rewards ?? []).filter((r) => r.ownerUserId === me.id);
  const usedCount = myRewards.filter((r) => r.usedAt).length;
  const unusedCount = myRewards.length - usedCount;
  const counter = counterWithNoise(db);

  // 내가 발송한 초대 — 최근 5건
  const myInvites: Invite[] = (db.invites ?? [])
    .filter((i) => i.referrerId === me.id)
    .slice(0, 5);

  const unread = db.notifications.filter((n) => n.role === "reviewer" && n.userId === me.id && !n.read).length;

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

      {/* 헤더 — B급 톤 */}
      <section className="px-5 pt-6">
        <div className="text-[12px] text-muted">친구와 같이 받는 박스</div>
        <h1 className="font-display text-[30px] leading-[1.1] text-ink mt-1 tracking-[-0.028em]">
          오늘은 <span className="text-brand">{counter.todayBoxCount.toLocaleString()}</span>명이 받았어요
        </h1>
        <p className="text-[13px] text-muted mt-1.5">평균 ₩{counter.todayAvgReward.toLocaleString()} · 내 박스는 안 와요?</p>
      </section>

      {/* 라이브 카운터 — 사회적 증거 */}
      <section className="px-5 mt-4">
        <LiveCounter initial={counter} />
      </section>

      {/* 친구 초대 박스 카드 — 바이럴 핵심 모듈 */}
      <section className="px-5 mt-4">
        <ReferralBoxCard stats={inviteStats} myKind="reviewer" />
      </section>

      {/* 내 보상 — 받은 박스/쿠폰 인벤토리 */}
      <section className="px-5 mt-6">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="font-display text-[22px] leading-[1.14] text-ink tracking-[-0.022em]">내 보상</h2>
            <div className="text-[11px] text-muted mt-0.5">미사용 {unusedCount}개 · 사용 {usedCount}개</div>
          </div>
        </div>

        {myRewards.length === 0 ? (
          <div className="rounded-md border border-dashed border-hairline p-8 text-center text-[13px] text-muted">
            아직 받은 박스가 없어요.
            <br />
            친구를 초대하거나 친구 링크로 가입하면 박스가 도착해요.
          </div>
        ) : (
          <div className="rounded-md border border-hairline bg-canvas overflow-hidden">
            {myRewards.map((r, idx) => (
              <div
                key={r.id}
                className={`flex items-center gap-3 px-3 py-3 ${idx > 0 ? "border-t border-hairlineSoft" : ""}`}
              >
                <span className="w-10 h-10 rounded-md bg-parchment flex items-center justify-center text-[20px]" aria-hidden>
                  {rewardEmoji(r)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-ink truncate">{rewardLabel(r)}</div>
                  <div className="text-[11px] text-muted mt-0.5">
                    {r.source === "referee_welcome" ? "환영 박스" : r.source === "referrer_box" ? "행운 박스" : "마일스톤"}
                    {r.meta?.matrix && <span className="opacity-70"> · {r.meta.matrix}</span>}
                    <span className="opacity-70">
                      {" · "}
                      {new Date(r.issuedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-pill ${
                    r.usedAt ? "bg-parchment text-muted" : "bg-success/10 text-success"
                  }`}
                >
                  {r.usedAt ? "사용 완료" : "미사용"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 내가 보낸 초대 현황 */}
      <section className="px-5 mt-6">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="font-display text-[22px] leading-[1.14] text-ink tracking-[-0.022em]">보낸 초대</h2>
            <div className="text-[11px] text-muted mt-0.5">
              발송 {inviteStats.sent} · 클릭 {inviteStats.clicked} · 가입 {inviteStats.accepted}
            </div>
          </div>
          <Link href="/r/invite/new" className="cp-action h-9 px-4 rounded-pill bg-ink text-white text-[12px] font-medium inline-flex items-center">
            🎁 또 쏘기
          </Link>
        </div>

        {myInvites.length === 0 ? (
          <div className="rounded-md border border-dashed border-hairline p-6 text-center text-[12px] text-muted">
            아직 보낸 초대가 없어요.
          </div>
        ) : (
          <div className="rounded-md border border-hairline bg-canvas overflow-hidden">
            {myInvites.map((inv, idx) => (
              <InviteRow key={inv.token} inv={inv} divider={idx > 0} />
            ))}
          </div>
        )}
      </section>

      {/* 등급 탭 안내 — 등급 영역이 분리되었음을 알리는 entry */}
      <section className="px-5 mt-8">
        <Link
          href="/r/grade"
          className="cp-action flex items-center gap-3 p-4 rounded-md border border-hairline bg-parchment"
        >
          <span className="w-10 h-10 rounded-md bg-brand/12 text-brand flex items-center justify-center">
            <Icon name="trophy" variant="bold" size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold text-ink">등급 혜택은 따로 모아뒀어요</div>
            <div className="text-[11px] text-muted mt-0.5">참여 가능 매장 / 최대 지원금 / 등급별 혜택 표 → 등급 탭</div>
          </div>
          <Icon name="chevron-right" variant="border" size={14} className="text-muted" />
        </Link>
      </section>
    </div>
  );
}

function InviteRow({ inv, divider }: { inv: Invite; divider: boolean }) {
  const m = matrixOf(inv.referrerKind, inv.targetKind);
  const statusLabel: Record<typeof inv.status, { text: string; tone: "muted" | "brand" | "success" | "error" }> = {
    issued: { text: "발송", tone: "muted" },
    clicked: { text: "열람", tone: "brand" },
    signed_up: { text: "✓ 가입", tone: "success" },
    expired: { text: "만료", tone: "error" },
  };
  const status = statusLabel[inv.status];
  return (
    <div className={`flex items-center gap-3 px-3 py-3 ${divider ? "border-t border-hairlineSoft" : ""}`}>
      <span className="w-9 text-[11px] font-semibold text-muted text-center tabular-nums">{m}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-mono text-ink truncate">{inv.token}</div>
        <div className="text-[11px] text-muted mt-0.5">
          {refereePreview(m)} · {new Date(inv.createdAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
      <span
        className={`text-[10px] px-2 py-0.5 rounded-pill shrink-0 ${
          status.tone === "success"
            ? "bg-success/10 text-success"
            : status.tone === "brand"
              ? "bg-brand/10 text-brand"
              : status.tone === "error"
                ? "bg-error/10 text-error"
                : "bg-parchment text-muted"
        }`}
      >
        {status.text}
      </span>
    </div>
  );
}
