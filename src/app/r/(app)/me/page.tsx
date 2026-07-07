import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import GradeBadge from "@/components/GradeBadge";
import LogoutButton from "@/components/LogoutButton";
import DeleteAccountButton from "@/components/DeleteAccountButton";
import { getDBAsync } from "@/lib/db";

export const dynamic = "force-dynamic";

const ch_label: any = {
  naver_blog: "네이버 블로그",
  instagram: "인스타그램",
  tiktok: "틱톡",
};
const ch_metric: any = {
  naver_blog: "일방문자",
  instagram: "팔로워",
  tiktok: "팔로워",
};
const ALL_CH = ["naver_blog", "instagram", "tiktok"];

export default async function Me() {
  const me = await getCurrentReviewer();
  const db = await getDBAsync();
  const completed = db.passes.filter((p) => p.reviewerId === me.id && p.status === "completed").length;
  const totalSupport = db.passes
    .filter((p) => p.reviewerId === me.id && p.supportApplied)
    .reduce((s, p) => s + (p.supportApplied || 0), 0);
  const unread = db.notifications.filter((n) => n.role === "reviewer" && n.userId === me.id && !n.read).length;

  return (
    <div className="pb-24 bg-canvas">
      {/* Sub-nav */}
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-13 px-5 flex items-center">
          <h1 className="text-[21px] font-semibold text-ink tracking-[-0.011em]">MY</h1>
        </div>
      </div>

      {/* Parchment profile hero */}
      <section className="bg-parchment px-6 pt-12 pb-10 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-canvas border border-hairline flex items-center justify-center mb-4">
          <span className="text-[22px] font-bold text-ink leading-none">{me.nickname.slice(0, 1)}</span>
        </div>
        <h1 className="text-[20px] font-bold tracking-title leading-[1.3] text-ink">{me.nickname}</h1>
        <p className="mt-2 text-[15px] text-ink2">{me.email}</p>
        <Link href="/r/grade" className="cp-action mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-canvas rounded-pill border border-hairline">
          <GradeBadge grade={me.grade} size="sm" />
          <span className="text-[14px] text-ink">{me.grade}등급</span>
          <span className="text-[13px] text-brand">자세히 →</span>
        </Link>
      </section>

      {/* stat-strip — 내 활동 요약 (v2) */}
      <section className="px-5 py-2">
        <div className="rounded-lg border border-hairline bg-canvas px-4 py-5 grid grid-cols-3 gap-3 text-center text-ink">
          <div>
            <div className="text-[18px] font-bold tabular-nums leading-none">{completed}</div>
            <div className="text-[12px] text-muted mt-2">완료 리뷰</div>
          </div>
          <div className="border-l border-r border-hairlineSoft">
            <div className="text-[18px] font-bold tabular-nums leading-none">{me.qualityScore || "—"}</div>
            <div className="text-[12px] text-muted mt-2">리뷰 점수</div>
          </div>
          <div>
            <div className="text-[16px] font-bold tabular-nums leading-none">₩{Math.round(totalSupport / 1000)}K</div>
            <div className="text-[12px] text-muted mt-2">누적 혜택</div>
          </div>
        </div>
      </section>

      {/* Light tile — connected channels */}
      <section className="bg-canvas px-6 py-12">
        <h2 className="text-[12px] tracking-[0.18em] text-muted uppercase mb-4">연동된 채널</h2>
        <div className="rounded-lg border border-hairline overflow-hidden">
          {ALL_CH.map((k, i) => {
            const linked = me.sns.find((s) => s.kind === k);
            return (
              <div key={k} className={`px-5 py-4 flex items-center justify-between ${i < ALL_CH.length - 1 ? "border-b border-hairlineSoft" : ""}`}>
                <div>
                  <div className="text-[15px] text-ink">{ch_label[k]}</div>
                  <div className="text-[13px] text-muted mt-0.5">
                    {linked ? `${ch_metric[k]} ${linked.influence.toLocaleString()}명` : "연동 안 됨"}
                  </div>
                </div>
                {linked ? (
                  <span className="text-[13px] text-brand">연동됨</span>
                ) : (
                  <span className="text-[13px] text-muted">미연동</span>
                )}
              </div>
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
              <GradeBadge grade={me.grade} size="sm" />
              내 등급 / 등급별 혜택
            </span>
            <span className="text-brand text-[15px]">→</span>
          </Link>
          <Link href="/r/passes" className="flex items-center justify-between px-5 py-4 border-b border-hairlineSoft">
            <span className="text-[15px] text-ink">내 체험권 (사용 가능 / 신청 내역)</span>
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
          SNS 채널 추가·변경은 고객센터(help@catchrank.co.kr)로 문의해주세요.
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
