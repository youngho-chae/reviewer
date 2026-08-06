import Link from "next/link";
import { DELIVERY_ENABLED } from "@/lib/flags";
import { getCurrentReviewer } from "@/lib/server-helpers";
import GradeBadge from "@/components/GradeBadge";
import LogoutButton from "@/components/LogoutButton";
import DeleteAccountButton from "@/components/DeleteAccountButton";
import { getDBAsync } from "@/lib/db";
import { effectiveChannelState } from "@/lib/sns-cookie";
import { pointBalance } from "@/lib/points";
import { SBUI, sbNum } from "@/lib/storyboard";
import ProfileAvatar from "./ProfileAvatar";

export const dynamic = "force-dynamic";

const ch_label: any = {
  naver_blog: "네이버 블로그",
  instagram: "인스타그램",
  tiktok: "틱톡",
};
const ch_metric: any = {
  naver_blog: "평균방문자", // blog-analyzer visitor_trend.current (표기 확정 2026-07-28)
  instagram: "팔로워",
  tiktok: "팔로워",
};
const ALL_CH = ["naver_blog", "instagram", "tiktok"];

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
  // 체험 포인트 잔액 — append-only 원장 합산 (2026-07-12 레뷰 벤치마크, src/lib/points.ts)
  const points = pointBalance(db, me.id);

  return (
    <div className="pb-24 bg-canvas">
      {/* Sub-nav */}
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-13 px-5 flex items-center">
          <h1 className="text-[21px] font-semibold text-ink tracking-[-0.011em]">MY</h1>
        </div>
      </div>

      {/* 프로필 카드 (2026-08-05 개편) — 구 parchment 히어로(중앙 정렬·과대 여백)와 스탯
          스트립을 한 카드로 병합. 이메일·리뷰 점수(qualityScore — deprecated) 표기 제거,
          아바타는 사진 업로드로 꾸미기 (ProfileAvatar — 미설정 시 첫 글자) */}
      <section className="px-5 pt-2 pb-2">
        <div className="rounded-lg border border-hairline bg-canvas p-4">
          <div className="flex items-center gap-3.5">
            <ProfileAvatar image={me.profileImage} initial={me.nickname.slice(0, 1)} />
            <div className="flex-1 min-w-0">
              <h1 className="text-[17px] font-bold tracking-title text-ink truncate">{me.nickname}</h1>
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                <Link href="/r/grade" className="cp-action inline-flex items-center gap-1.5 px-2.5 py-1 bg-canvas rounded-pill border border-hairline">
                  <GradeBadge grade={eff.grade} size="sm" />
                  <span className="text-[13px] text-ink">{eff.grade}등급</span>
                  <span className="text-[12px] text-brand">자세히 →</span>
                </Link>
                {me.winWinBadge && (
                  // 상생 리뷰어 — 표시용 신뢰 표식 (지원금 배율·참여 조건 무영향)
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-brandSoft text-brand text-[12px] font-semibold">
                    🤝 상생 리뷰어
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3.5 border-t border-hairlineSoft grid grid-cols-2 text-center text-ink">
            <div>
              <div className="text-[18px] font-bold tabular-nums leading-none">{completed}</div>
              <div className="text-[12px] text-muted mt-1.5">완료 리뷰</div>
            </div>
            <div className="border-l border-hairlineSoft">
              <div className="text-[16px] font-bold tabular-nums leading-none">{totalSupport.toLocaleString()}원</div>
              <div className="text-[12px] text-muted mt-1.5">누적 혜택</div>
            </div>
          </div>
        </div>
      </section>

      {/* 체험 포인트 — 배송형 리뷰 승인 적립·출금 (2026-07-12 레뷰 벤치마크) */}
      {DELIVERY_ENABLED && (
      <section className="px-5 py-2">
        <Link
          href="/r/me/points"
          className="cp-action rounded-lg border border-hairline bg-canvas px-5 py-4 flex items-center justify-between"
        >
          <div>
            <div className="text-[12px] text-muted">체험 포인트</div>
            <div className="mt-1 text-[20px] font-bold text-ink tabular-nums leading-none">
              {sbNum(SBUI.pointBalance, `${points.toLocaleString()}P`)}
            </div>
          </div>
          <span className="text-[13px] font-semibold text-brand">내역 · 출금 →</span>
        </Link>
      </section>
      )}

      {/* Light tile — connected channels (관리·본인 인증은 /r/me/channels — 2026-07-10) */}
      <section className="bg-canvas px-6 py-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[12px] tracking-[0.18em] text-muted uppercase">연동된 채널</h2>
          <Link href="/r/me/channels" className="cp-action text-[13px] font-semibold text-brand">
            채널 관리 →
          </Link>
        </div>
        <div className="rounded-lg border border-hairline overflow-hidden">
          {ALL_CH.map((k, i) => {
            const linked = eff.sns.find((s) => s.kind === k);
            return (
              <Link
                href="/r/me/channels"
                key={k}
                className={`cp-action px-5 py-4 flex items-center justify-between ${i < ALL_CH.length - 1 ? "border-b border-hairlineSoft" : ""}`}
              >
                <div>
                  <div className="text-[15px] text-ink flex items-center gap-2">
                    {ch_label[k]}
                    {linked &&
                      (linked.verified ? (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-pill text-[10px] font-semibold ${linked.verifiedVia === "oauth" ? "bg-successSoft text-successStrong" : "bg-brandSoft text-brand"}`}>
                          ✓ {linked.verifiedVia === "oauth" ? "본인 인증" : "데모 인증"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-pill bg-sunken text-muted text-[10px] font-semibold">미인증</span>
                      ))}
                  </div>
                  <div className="text-[13px] text-muted mt-0.5">
                    {linked ? `${ch_metric[k]} ${linked.influence.toLocaleString()}명` : "연동 안 됨"}
                  </div>
                </div>
                {linked ? (
                  <span className="text-[13px] text-brand">연동됨</span>
                ) : (
                  <span className="text-[13px] text-brand font-semibold">연동하기 →</span>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Parchment tile — menu */}
      <section className="bg-parchment px-6 py-12">
        <h2 className="text-[12px] tracking-[0.18em] text-muted uppercase mb-4">내 활동</h2>
        <div className="rounded-lg border border-hairline overflow-hidden bg-canvas mb-8">
          <Link href="/r/grade" className="flex items-center justify-between px-5 py-4 border-b border-hairlineSoft">
            <span className="text-[15px] text-ink flex items-center gap-2">
              <GradeBadge grade={eff.grade} size="sm" />
              내 등급 / 등급별 혜택
            </span>
            <span className="text-brand text-[15px]">→</span>
          </Link>
          <Link href="/r/passes" className="flex items-center justify-between px-5 py-4 border-b border-hairlineSoft">
            <span className="text-[15px] text-ink">내 체험권 (사용 가능 / 신청 내역)</span>
            <span className="text-brand text-[15px]">→</span>
          </Link>
          <Link href="/r/interests" className="flex items-center justify-between px-5 py-4 border-b border-hairlineSoft">
            <span className="text-[15px] text-ink">관심 목록</span>
            <span className="text-brand text-[15px]">→</span>
          </Link>
          <Link href="/r/rewards" className="flex items-center justify-between px-5 py-4">
            <span className="text-[15px] text-ink">친구 초대 / 받은 보상</span>
            <span className="text-brand text-[15px]">→</span>
          </Link>
        </div>

        <h2 className="text-[12px] tracking-[0.18em] text-muted uppercase mb-4">설정</h2>
        <div className="rounded-lg border border-hairline overflow-hidden bg-canvas">
          <Link href="/r/passes" className="flex items-center justify-between px-5 py-4 border-b border-hairlineSoft">
            <span className="text-[15px] text-ink">이용한 매장 / 작성한 리뷰</span>
            <span className="text-brand text-[15px]">→</span>
          </Link>
          <Link href="/r/notifications" className="flex items-center justify-between px-5 py-4 border-b border-hairlineSoft">
            <span className="text-[15px] text-ink flex items-center gap-2">
              알림함
              {unread > 0 && <span className="text-[11px] text-brand">{unread}건</span>}
            </span>
            <span className="text-brand text-[15px]">→</span>
          </Link>
          <div className="flex items-center justify-between px-5 py-4 border-b border-hairlineSoft text-muted">
            <span className="text-[15px]">리뷰어 프로필 공개 설정</span>
            <span className="text-[12px]">준비 중</span>
          </div>
          <a
            href="mailto:help@catchrank.co.kr?subject=[CATCHPASS] 체험자 문의"
            className="cp-action flex items-center justify-between px-5 py-4"
          >
            <span className="text-[15px] text-ink">고객센터</span>
            <span className="text-brand text-[15px]">→</span>
          </a>
        </div>
        <p className="mt-3 text-[12px] text-muted leading-[1.5]">
          SNS 채널 연동·해제는 <Link href="/r/me/channels" className="text-brand font-semibold">채널 관리</Link>에서 직접 할 수 있어요.
        </p>

        {/* 법적 고지 — 가입 전에도 접근 가능한 /legal 문서로 연결 */}
        <div className="mt-6 flex items-center gap-4 text-[12px]">
          <Link href="/legal/terms" className="text-muted underline">이용약관</Link>
          <Link href="/legal/privacy" className="text-muted underline">개인정보처리방침</Link>
        </div>

        <div className="mt-8">
          <LogoutButton />
        </div>
        <div className="mt-6">
          <DeleteAccountButton />
        </div>
      </section>
    </div>
  );
}
