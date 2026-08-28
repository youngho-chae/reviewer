import Link from "next/link";
import { DELIVERY_ENABLED } from "@/lib/flags";
import { getCurrentReviewer } from "@/lib/server-helpers";
import LogoutButton from "@/components/LogoutButton";
import GradeBadge, { GRADE_TEXT_CLS } from "@/components/GradeBadge";
import Icon, { type IconName } from "@/components/Icon";
import ChannelIcons from "@/components/ChannelIcons";
import WinWinBadge from "@/components/WinWinBadge";
import { getDBAsync } from "@/lib/db";
import { effectiveChannelState } from "@/lib/sns-cookie";
import { pointBalance } from "@/lib/points";
import { SUPPORT_MULTIPLIER } from "@/lib/grade";
import { CHANNEL_ORDER } from "@/lib/channels";
import { SBUI, sbNum } from "@/lib/storyboard";
import ProfileAvatar from "./ProfileAvatar";

export const dynamic = "force-dynamic";

// 체험자 마이 (2026-08-18 와이어프레임 개편 — 구 2026-08-05 카드 병합판 대체)
//  · 헤더 = "마이" + 검색·벨 · 프로필 플랫(아바타+닉네임+[수정] → /r/me/edit — 사진 변경도 수정 화면)
//  · 스탯 바(sunken) = 완료 리뷰 | 누적 혜택
//  · 등급 카드(퍼플 아웃라인) = "{등급}등급으로 지원금 n% 받고 있어요" + 우상단 [채널 관리]
//    + 연동된 채널(배지) / 연동 가능한 채널(배지) 2열 — 미연동 "연동 필요"·완료 "연동 모두 완료"
//  · 메뉴 = 플랫 아이콘 행 (사장님 마이 v2 문법) · 로그아웃 아웃라인 풀폭 + 회원 탈퇴 텍스트
export default async function Me() {
  const me = await getCurrentReviewer();
  const db = await getDBAsync();
  // 인스턴스 불일치 스톱갭 — 연동/해제 직후 본인 시점 최신 상태 (sns-cookie.ts)
  const eff = await effectiveChannelState(me);
  const completed = db.passes.filter((p) => p.reviewerId === me.id && p.status === "completed").length;
  const totalSupport = db.passes
    .filter((p) => p.reviewerId === me.id && p.supportApplied)
    .reduce((s, p) => s + (p.supportApplied || 0), 0);
  const unread = db.notifications.filter((n) => n.role === "reviewer" && n.userId === me.id && !n.read).length;
  const points = pointBalance(db, me.id);

  const linked = CHANNEL_ORDER.filter((ch) => eff.sns.some((s) => s.kind === ch));
  const unlinked = CHANNEL_ORDER.filter((ch) => !linked.includes(ch));
  const supportPct = Math.round((SUPPORT_MULTIPLIER[eff.grade] ?? 0) * 100);

  const MENU: { icon: IconName; label: string; href: string; external?: boolean; sub?: string; dot?: boolean }[] = [
    { icon: "trophy", label: "내 등급/등급별 혜택", href: "/r/grade" },
    { icon: "ticket", label: "내 체험권", href: "/r/passes" },
    { icon: "heart", label: "관심 목록", href: "/r/interests" },
    { icon: "clipboard", label: "작성한 리뷰", href: "/r/passes?tab=review" },
    // 체험 포인트 — 배송형 리뷰 승인 적립·출금 경로 (P5 — 와이어프레임 외이지만 실사용 경로 유지)
    ...(DELIVERY_ENABLED
      ? [{ icon: "gift" as IconName, label: "체험 포인트", href: "/r/me/points", sub: sbNum(SBUI.pointBalance, `${points.toLocaleString()}P`) }]
      : []),
    { icon: "bell", label: "알림함", href: "/r/notifications", dot: unread > 0 },
    { icon: "chat", label: "고객센터/문의", href: "mailto:help@catchrank.co.kr?subject=[CATCHPASS] 체험자 문의", external: true },
    { icon: "list", label: "약관", href: "/legal/terms" },
  ];

  return (
    <div className="pb-24 bg-canvas">
      {/* 헤더 — "마이" + 검색·알림 (탐색·체험권과 동일 문법) */}
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-5 flex items-center justify-between">
          <h1 className="text-[20px] font-bold text-ink tracking-title">마이</h1>
          <div className="flex items-center gap-1">
            <Link href="/r/search" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="검색">
              <Icon name="search" variant="border" size={22} />
            </Link>
            <Link href="/r/notifications" className="cp-action relative w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="알림">
              <Icon name="bell" variant={unread > 0 ? "bold" : "border"} size={22} />
              {unread > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand" />}
            </Link>
          </div>
        </div>
      </div>

      {/* 프로필 — 플랫 (사진 변경은 회원 정보 수정 화면에서) · 상생 리뷰어는 닉네임 아래 pill (2026-08-18 시안) */}
      <div className="px-5 pt-2 flex items-center gap-4">
        <ProfileAvatar image={me.profileImage} initial={me.nickname.slice(0, 1)} />
        <div className="flex-1 min-w-0">
          <h2 className="text-[18px] font-bold text-ink tracking-title truncate">{me.nickname}</h2>
          {/* winwin.png = 텍스트 포함 pill 일체형 (2026-08-18) — 별도 래퍼 없이 단독 렌더 */}
          {me.winWinBadge && <WinWinBadge size={26} className="mt-1.5" />}
        </div>
        <Link
          href="/r/me/edit"
          className="cp-action shrink-0 inline-flex items-center h-9 px-4 rounded-pill border border-hairline bg-canvas text-[13px] font-semibold text-ink"
        >
          수정
        </Link>
      </div>

      {/* 스탯 바 — 완료 리뷰 | 누적 혜택 */}
      <div className="mx-5 mt-4 rounded-md bg-sunken px-4 py-3.5 grid grid-cols-[1fr_auto_1.2fr] items-center">
        <div className="flex items-baseline justify-between pr-4">
          <span className="text-[13px] text-muted">완료 리뷰</span>
          <span className="text-[16px] font-bold text-ink tabular-nums">{completed}</span>
        </div>
        <span className="w-px h-5 bg-borderStrong/50" aria-hidden />
        <div className="flex items-baseline justify-between pl-4">
          <span className="text-[13px] text-muted">누적 혜택</span>
          <span className="text-[16px] font-bold text-ink tabular-nums">{sbNum(SBUI.support, `${totalSupport.toLocaleString()}원`)}</span>
        </div>
      </div>

      {/* 등급 카드 — 등급·배율 + 연동/미연동 채널 2열 */}
      <div className="mx-5 mt-3 rounded-lg border-[1.5px] border-brand bg-canvas p-4">
        <div className="flex items-start justify-between gap-2">
          {/* 등급 표기 방침 (2026-08-18) — 등급 배지 + 등급 고유색 텍스트 */}
          <div className="text-[17px] text-ink leading-[1.45]">
            <span className="inline-flex items-center gap-1.5 align-middle">
              <GradeBadge grade={eff.grade} size="md" />
              <b className={GRADE_TEXT_CLS[eff.grade]}>{eff.grade}등급</b>
            </span>{" "}
            으로
            <br />
            지원금 <b className="text-[#FF6B00]">{supportPct}%</b> 받고 있어요
          </div>
          <Link href="/r/me/channels" className="cp-action shrink-0 inline-flex items-center gap-0.5 text-[13px] text-ink2 font-medium mt-0.5">
            채널 관리 <Icon name="chevron-right" variant="border" size={14} />
          </Link>
        </div>
        <div className="mt-3.5 pt-3.5 border-t border-hairlineSoft grid grid-cols-2 gap-3">
          <div>
            <div className="text-[13px] text-ink">
              연동된 채널 <b className="tabular-nums">{linked.length}</b>
            </div>
            <div className="mt-2 min-h-[22px]">
              {linked.length > 0 ? <ChannelIcons channels={linked} /> : <span className="text-[13px] text-mutedSoft">연동 필요</span>}
            </div>
          </div>
          <div>
            <div className="text-[13px] text-ink">
              연동 가능한 채널 <b className="tabular-nums">{unlinked.length}</b>
            </div>
            <div className="mt-2 min-h-[22px]">
              {unlinked.length > 0 ? (
                <ChannelIcons channels={unlinked} />
              ) : (
                <span className="text-[13px] text-mutedSoft">연동 모두 완료</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 메뉴 — 플랫 아이콘 행 */}
      <div className="px-5 mt-4 divide-y divide-hairlineSoft">
        {MENU.map((m) =>
          m.external ? (
            <a key={m.label} href={m.href} className="cp-action flex items-center gap-3.5 py-4">
              <Icon name={m.icon} variant="border" size={22} className="shrink-0 text-ink" />
              <span className="flex-1 text-[15px] font-medium text-ink">{m.label}</span>
              <Icon name="chevron-right" variant="border" size={16} className="shrink-0 text-mutedSoft" />
            </a>
          ) : (
            <Link key={m.label} href={m.href} className="cp-action flex items-center gap-3.5 py-4">
              <span className="relative shrink-0">
                <Icon name={m.icon} variant="border" size={22} className="text-ink" />
                {m.dot && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-error" />}
              </span>
              <span className="flex-1 text-[15px] font-medium text-ink">{m.label}</span>
              {m.sub && <span className="shrink-0 text-[14px] font-bold text-ink tabular-nums">{m.sub}</span>}
              <Icon name="chevron-right" variant="border" size={16} className="shrink-0 text-mutedSoft" />
            </Link>
          ),
        )}
      </div>

      <div className="px-5 mt-6">
        <LogoutButton />
      </div>
      <div className="px-5 mt-5 flex items-center gap-4">
        {/* 탈퇴 = 전용 화면 (2026-08-18) · 개인정보처리방침 = 법적 상시 링크 */}
        <Link href="/r/me/delete" className="cp-action text-[13px] text-muted underline">
          회원 탈퇴
        </Link>
        <Link href="/legal/privacy" className="text-[12px] text-muted underline">
          개인정보처리방침
        </Link>
      </div>
    </div>
  );
}
