import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import GradeBadge from "@/components/GradeBadge";
import LogoutButton from "@/components/LogoutButton";
import { getDBAsync } from "@/lib/db";

export const dynamic = "force-dynamic";

const ch_label: any = {
  naver_blog: "네이버 블로그",
  instagram: "인스타그램",
  youtube: "유튜브",
  tiktok: "틱톡",
};
const ch_metric: any = {
  naver_blog: "일방문자",
  instagram: "팔로워",
  youtube: "구독자",
  tiktok: "팔로워",
};
const ALL_CH = ["naver_blog", "instagram", "youtube", "tiktok"];

export default async function Me() {
  const me = await getCurrentReviewer();
  const db = await getDBAsync();
  const completed = db.passes.filter((p) => p.reviewerId === me.id && p.status === "completed").length;
  const totalSupport = db.passes
    .filter((p) => p.reviewerId === me.id && p.supportApplied)
    .reduce((s, p) => s + (p.supportApplied || 0), 0);
  const unread = db.notifications.filter((n) => n.role === "reviewer" && n.userId === me.id && !n.read).length;

  return (
    <div className="pb-24">
      <div className="px-5 pt-12 pb-5">
        <h1 className="text-[28px] font-extrabold tracking-tight">MY</h1>
      </div>

      <div className="px-5">
        {/* 프로필 카드 */}
        <div className="rounded-md border border-hairline p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-surfaceSoft border border-hairline grid place-items-center text-[22px] font-bold text-muted">
            {me.nickname.slice(0, 1)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[17px] font-bold">{me.nickname}</span>
              <GradeBadge grade={me.grade} size="sm" />
            </div>
            <div className="text-[12px] text-muted mt-1">{me.email}</div>
          </div>
        </div>

        {/* 통계 strip */}
        <div className="mt-3.5 p-5 rounded-md bg-ink text-white flex justify-around">
          <div className="text-center">
            <div className="text-[22px] font-extrabold tracking-tight">{completed}</div>
            <div className="text-[11px] text-white/60 mt-1">완료 리뷰</div>
          </div>
          <div className="text-center">
            <div className="text-[22px] font-extrabold tracking-tight">{me.qualityScore || "-"}</div>
            <div className="text-[11px] text-white/60 mt-1">리뷰 점수</div>
          </div>
          <div className="text-center">
            <div className="text-[22px] font-extrabold tracking-tight">₩{Math.round(totalSupport / 1000)}K</div>
            <div className="text-[11px] text-white/60 mt-1">누적 혜택</div>
          </div>
        </div>

        {/* 연동 채널 */}
        <h2 className="mt-6 text-[14px] font-bold text-muted">연동된 채널</h2>
        <div className="mt-2.5 rounded-md border border-hairline overflow-hidden divide-y divide-hairline">
          {ALL_CH.map((k) => {
            const linked = me.sns.find((s) => s.kind === k);
            return (
              <div key={k} className="px-4 py-3.5 flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-semibold">{ch_label[k]}</div>
                  <div className="text-[12px] text-muted mt-0.5">
                    {linked ? `${ch_metric[k]} ${linked.influence.toLocaleString()}명` : "연동 안 됨"}
                  </div>
                </div>
                {linked ? (
                  <span className="text-[11px] font-bold text-success px-2.5 py-1 bg-success/10 rounded-full">연동됨</span>
                ) : (
                  <button className="text-[12px] font-semibold px-3 py-1.5 bg-ink text-white rounded-full">연동</button>
                )}
              </div>
            );
          })}
        </div>

        {/* 메뉴 */}
        <div className="mt-5 rounded-md border border-hairline overflow-hidden divide-y divide-hairline">
          <Link href="/r/passes" className="flex items-center justify-between px-4 py-3.5 active:bg-surfaceSoft text-[14px] font-medium">
            <span>이용한 매장 / 작성한 리뷰</span>
            <span className="text-mutedSoft">→</span>
          </Link>
          <Link href="/r/notifications" className="flex items-center justify-between px-4 py-3.5 active:bg-surfaceSoft text-[14px] font-medium">
            <span className="flex items-center gap-2">
              알림 설정
              {unread > 0 && <span className="text-[10px] bg-error text-white px-1.5 py-0.5 rounded-full">{unread}</span>}
            </span>
            <span className="text-mutedSoft">→</span>
          </Link>
          <div className="flex items-center justify-between px-4 py-3.5 text-[14px] font-medium text-muted">
            <span>리뷰어 프로필 공개 설정</span>
            <span className="text-mutedSoft">→</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5 text-[14px] font-medium text-muted">
            <span>고객센터</span>
            <span className="text-mutedSoft">→</span>
          </div>
        </div>

        <div className="mt-8">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
