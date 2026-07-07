import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import Icon from "@/components/Icon";
import LiveCounter from "./LiveCounter";
import ReferralBoxCard from "./ReferralBoxCard";
import { snapshotCounter, defaultInviteStats, rewardEmoji } from "@/lib/referral";
import { SBUI } from "@/lib/storyboard";
import type { Invite } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const me = await getCurrentReviewer();
  const db = await getDBAsync();

  // 바이럴 인벤토리 ──
  const inviteStats = me.inviteStats ?? defaultInviteStats();
  const myRewards = (db.rewards ?? []).filter((r) => r.ownerUserId === me.id);
  const counter = snapshotCounter(db);

  // 내가 발송한 초대 — 최근 5건
  const myInvites: Invite[] = (db.invites ?? [])
    .filter((i) => i.referrerId === me.id)
    .slice(0, 5);

  const unread = db.notifications.filter((n) => n.role === "reviewer" && n.userId === me.id && !n.read).length;

  return (
    <div className="pb-24 bg-canvas">
      {/* top-app-bar — 화이트 52px */}
      <div className="sticky top-0 z-30 bg-canvas">
        <div className="h-[52px] px-5 flex items-center justify-between">
          <h1 className="text-[18px] font-bold text-ink tracking-title">혜택</h1>
          <Link
            href="/r/notifications"
            className="cp-action relative w-10 h-10 rounded-full flex items-center justify-center text-ink"
            aria-label="알림"
          >
            <Icon name="bell" variant={unread > 0 ? "bold" : "border"} size={22} />
            {unread > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand" />}
          </Link>
        </div>
      </div>

      {/* 헤더 — B급 톤. 수치는 실제 발행된 보상만 집계 (조작 없음) */}
      <section className="px-5 pt-3">
        <div className="text-[12px] text-muted">친구와 같이 받는 박스</div>
        {counter.todayBoxCount > 0 ? (
          <>
            <h2 className="text-[20px] font-bold text-ink tracking-title leading-[1.3] mt-1">
              오늘 박스 <span className="text-brand">{SBUI.liveCount}</span>개가 열렸어요
            </h2>
            <p className="text-[13px] text-muted mt-1">내 박스는 안 와요?</p>
          </>
        ) : (
          <>
            <h2 className="text-[20px] font-bold text-ink tracking-title leading-[1.3] mt-1">
              오늘 첫 박스의 주인공, <span className="text-brand">아직 없음</span>
            </h2>
            <p className="text-[13px] text-muted mt-1">친구를 초대하면 둘 다 박스를 받아요.</p>
          </>
        )}
      </section>

      {/* 라이브 카운터 — 실제 이벤트만 표시 */}
      {counter.liveStream.length > 0 && (
        <section className="px-5 mt-4">
          <LiveCounter initial={counter} />
        </section>
      )}

      {/* 친구 초대 박스 카드 — 바이럴 핵심 모듈 */}
      <section className="px-5 mt-4">
        <ReferralBoxCard stats={inviteStats} myKind="reviewer" />
      </section>

      {/* 내 보상 — 받은 박스/쿠폰 인벤토리 */}
      <section className="px-5 mt-8">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-[18px] font-bold text-ink tracking-title">내 보상</h2>
            <div className="text-[12px] text-muted mt-0.5">미사용 {SBUI.count} · 사용 {SBUI.count}</div>
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
                <span className="w-10 h-10 rounded-md bg-sunken flex items-center justify-center text-[20px]" aria-hidden>
                  {rewardEmoji(r)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-ink truncate">{SBUI.reward}</div>
                  <div className="text-[11px] text-muted mt-0.5">
                    {r.source === "referee_welcome" ? "환영 박스" : r.source === "referrer_box" ? "행운 박스" : "마일스톤"}
                    <span className="opacity-70"> · {SBUI.matrix}</span>
                    <span className="opacity-70"> · {SBUI.date}</span>
                  </div>
                </div>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-pill ${
                    r.usedAt ? "bg-sunken text-muted" : "bg-successSoft text-successStrong"
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
      <section className="px-5 mt-8">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-[18px] font-bold text-ink tracking-title">보낸 초대</h2>
            <div className="text-[12px] text-muted mt-0.5">
              발송 {SBUI.count} · 클릭 {SBUI.count} · 가입 {SBUI.count}
            </div>
          </div>
          <Link href="/r/invite/new" className="cp-action h-9 px-3.5 rounded-md border border-hairline bg-canvas text-ink text-[13px] font-semibold inline-flex items-center">
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
          className="cp-action flex items-center gap-3 p-4 rounded-md border border-hairline bg-canvas"
        >
          <span className="w-10 h-10 rounded-md bg-brandTint text-brand flex items-center justify-center">
            <Icon name="trophy" variant="bold" size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold text-ink">등급 혜택은 따로 모아뒀어요</div>
            <div className="text-[12px] text-muted mt-0.5">내 지원금 배율 / 최대 지원금 / 등급별 혜택 표 → 등급 탭</div>
          </div>
          <Icon name="chevron-right" variant="border" size={14} className="text-muted" />
        </Link>
      </section>
    </div>
  );
}

function InviteRow({ inv, divider }: { inv: Invite; divider: boolean }) {
  const statusLabel: Record<typeof inv.status, { text: string; tone: "muted" | "brand" | "success" | "error" }> = {
    issued: { text: "발송", tone: "muted" },
    clicked: { text: "열람", tone: "brand" },
    signed_up: { text: "✓ 가입", tone: "success" },
    expired: { text: "만료", tone: "error" },
  };
  const status = statusLabel[inv.status];
  return (
    <div className={`flex items-center gap-3 px-3 py-3 ${divider ? "border-t border-hairlineSoft" : ""}`}>
      <span className="w-9 text-[11px] font-semibold text-muted text-center">{SBUI.matrix}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-mono text-ink truncate">{SBUI.token}</div>
        <div className="text-[11px] text-muted mt-0.5">
          {SBUI.reward} · {SBUI.date}
        </div>
      </div>
      <span
        className={`text-[11px] font-semibold px-2 py-0.5 rounded-pill shrink-0 ${
          status.tone === "success"
            ? "bg-successSoft text-successStrong"
            : status.tone === "brand"
              ? "bg-brandSoft text-brand"
              : status.tone === "error"
                ? "bg-errorSoft text-error"
                : "bg-sunken text-muted"
        }`}
      >
        {status.text}
      </span>
    </div>
  );
}
