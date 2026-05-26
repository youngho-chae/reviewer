import { getCurrentReviewer } from "@/lib/server-helpers";
import GradeBadge from "@/components/GradeBadge";
import LogoutButton from "@/components/LogoutButton";
import { getDB } from "@/lib/db";

export const dynamic = "force-dynamic";

const ch_label: any = {
  naver_blog: "네이버 블로그",
  instagram: "인스타그램",
  youtube: "유튜브",
  tiktok: "틱톡",
};

export default async function Me() {
  const me = await getCurrentReviewer();
  const db = getDB();
  const completed = db.passes.filter((p) => p.reviewerId === me.id && p.status === "completed").length;
  const totalSupport = db.passes
    .filter((p) => p.reviewerId === me.id && p.supportApplied)
    .reduce((s, p) => s + (p.supportApplied || 0), 0);

  return (
    <div className="pb-24">
      <div className="px-5 pt-12 pb-3">
        <h1 className="text-[22px] font-bold">MY</h1>
      </div>

      <div className="px-5">
        <div className="rounded-md border border-hairline p-5 flex items-center gap-4">
          <GradeBadge grade={me.grade} size="lg" />
          <div className="flex-1">
            <div className="text-[16px] font-semibold">{me.nickname}</div>
            <div className="text-[12px] text-muted">{me.email}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 rounded-md border border-hairline p-4 text-center">
          <div>
            <div className="text-[11px] text-muted">완료 리뷰</div>
            <div className="text-[18px] font-bold">{completed}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted">리뷰 점수</div>
            <div className="text-[18px] font-bold">{me.qualityScore || "-"}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted">누적 혜택</div>
            <div className="text-[18px] font-bold">₩{totalSupport.toLocaleString()}</div>
          </div>
        </div>

        <h2 className="mt-6 text-[16px] font-bold">연동 채널</h2>
        <div className="mt-3 space-y-2">
          {me.sns.length === 0 ? (
            <div className="rounded-md border border-dashed border-hairline p-4 text-center text-[13px] text-muted">
              연동된 채널이 없습니다. 연동하면 등급이 자동 산정됩니다.
            </div>
          ) : me.sns.map((s) => (
            <div key={s.kind} className="rounded-md border border-hairline p-3">
              <div className="flex items-center justify-between">
                <div className="text-[14px] font-medium">{ch_label[s.kind]}</div>
                <div className="text-[12px] text-muted">{s.influence.toLocaleString()}</div>
              </div>
              <div className="text-[12px] text-muted truncate mt-1">{s.url}</div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
