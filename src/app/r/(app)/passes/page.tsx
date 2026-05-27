import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import GradeBadge from "@/components/GradeBadge";
import PassesTabs from "./PassesTabs";

export const dynamic = "force-dynamic";

const statusLabel = (s: string) => ({
  active: "사용 가능",
  used: "리뷰 작성 대기",
  review_submitted: "검수 대기",
  completed: "완료",
  expired: "만료",
  rejected: "반려",
} as any)[s] || s;

const statusCls = (s: string) => ({
  active: "bg-success/15 text-success",
  used: "bg-ink text-white",
  review_submitted: "bg-surfaceStrong text-ink",
  completed: "bg-success text-white",
  expired: "bg-surfaceStrong text-muted",
  rejected: "bg-error/15 text-error",
} as any)[s] || "bg-surfaceStrong text-muted";

export default async function MyPasses() {
  const me = await getCurrentReviewer();
  const db = await getDBAsync();
  const allPasses = db.passes
    .filter((p) => p.reviewerId === me.id)
    .sort((a, b) => b.issuedAt - a.issuedAt);

  const now = Date.now();
  for (const p of allPasses) {
    if (p.status === "active" && now > p.expiresAt) p.status = "expired";
  }

  // 방문형 vs 기자단 분리
  const visit = allPasses.filter((p) => {
    const c = db.campaigns.find((x) => x.id === p.campaignId);
    return c?.kind !== "press";
  });
  const press = allPasses.filter((p) => {
    const c = db.campaigns.find((x) => x.id === p.campaignId);
    return c?.kind === "press";
  });

  const visitItems = visit.map((p) => {
    const store = db.stores.find((s) => s.id === p.storeId);
    const c = db.campaigns.find((c) => c.id === p.campaignId);
    const remainMs = p.expiresAt - now;
    const days = Math.max(0, Math.floor(remainMs / 86400000));
    const hours = Math.max(0, Math.floor((remainMs / 3600000) % 24));
    return { p, store, c, days, hours };
  });

  const pressItems = press.map((p) => {
    const store = db.stores.find((s) => s.id === p.storeId);
    const c = db.campaigns.find((c) => c.id === p.campaignId);
    return { p, store, c };
  });

  const pendingPay = press
    .filter((p) => p.status === "review_submitted")
    .reduce((s, p) => {
      const c = db.campaigns.find((x) => x.id === p.campaignId);
      return s + (c?.supportAmount || 0);
    }, 0);
  const settledThisMonth = press
    .filter((p) => p.status === "completed")
    .reduce((s, p) => {
      const c = db.campaigns.find((x) => x.id === p.campaignId);
      return s + (c?.supportAmount || 0);
    }, 0);

  return (
    <div className="pb-24">
      <div className="px-5 pt-12 pb-3">
        <h1 className="text-[26px] font-extrabold tracking-tight">내 체험권</h1>
      </div>
      <PassesTabs
        visitCount={visit.length}
        pressCount={press.length}
        visitView={
          <div className="px-5 mt-3 space-y-3">
            {visitItems.map(({ p, store, c, days, hours }) => (
              <Link key={p.id} href={`/r/passes/${p.id}`} className="block bg-white border border-hairline rounded-md p-4">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <GradeBadge grade={p.reviewerGrade} size="sm" />
                  <span className="text-[11px] font-bold tracking-wider text-muted">CATCHPASS · {p.reviewerGrade}등급</span>
                  <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCls(p.status)}`}>{statusLabel(p.status)}</span>
                </div>
                <div className="text-[17px] font-extrabold tracking-tight">{store?.name}</div>
                <div className="text-[12px] text-muted mb-3">{store?.area} · {store?.category}</div>
                <div className="flex items-end justify-between pt-2.5 border-t border-dashed border-hairline">
                  <div>
                    <div className="text-[10px] font-semibold text-muted">할인 금액</div>
                    <div className="text-[18px] font-extrabold tracking-tight">{c?.supportAmount.toLocaleString()}<span className="text-[11px] font-semibold">원</span></div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-semibold text-muted">유효기간</div>
                    {p.status === "active" ? (
                      <div className="text-[12px] font-bold text-ink2">{days}일 {hours}시간 남음</div>
                    ) : (
                      <div className="text-[12px] font-bold text-muted">{statusLabel(p.status)}</div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
            {visit.length === 0 && (
              <div className="py-12 text-center text-muted text-[14px]">
                아직 발급된 방문형 체험권이 없어요.<br />
                <Link href="/r/home" className="text-ink underline mt-1 inline-block">홈에서 체험권 받기 →</Link>
              </div>
            )}
          </div>
        }
        pressView={
          <div>
            {/* 정산 stat strip */}
            <div className="mx-5 mt-3 p-4 bg-ink text-white rounded-md flex justify-around">
              <div className="text-center">
                <div className="text-[15px] font-extrabold tracking-tight">{press.filter((p) => p.status === "active").length}</div>
                <div className="text-[10px] text-white/60 mt-0.5">작성 중</div>
              </div>
              <div className="text-center">
                <div className="text-[15px] font-extrabold tracking-tight">{press.filter((p) => p.status === "review_submitted").length}</div>
                <div className="text-[10px] text-white/60 mt-0.5">검수 중</div>
              </div>
              <div className="text-center">
                <div className="text-[15px] font-extrabold tracking-tight">{pendingPay.toLocaleString()}원</div>
                <div className="text-[10px] text-white/60 mt-0.5">정산 예정</div>
              </div>
              <div className="text-center">
                <div className="text-[15px] font-extrabold tracking-tight">{settledThisMonth.toLocaleString()}원</div>
                <div className="text-[10px] text-white/60 mt-0.5">이번 달 입금</div>
              </div>
            </div>

            <div className="px-5 mt-4 space-y-3">
              {pressItems.map(({ p, store, c }) => {
                const actionable = p.status === "active";
                return (
                  <div key={p.id} className="bg-white border-[1.5px] border-hairline rounded-md p-4">
                    <div className="flex items-start justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <GradeBadge grade={p.reviewerGrade} size="sm" />
                        <div>
                          <div className="text-[16px] font-bold tracking-tight">{store?.name}</div>
                          <div className="text-[11px] text-muted">{store?.area} · {store?.category}</div>
                        </div>
                      </div>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${statusCls(p.status)}`}>
                        {p.status === "active" ? "자료 수령" : statusLabel(p.status)}
                      </span>
                    </div>

                    <div className="flex items-end justify-between mb-3">
                      <div>
                        <div className="text-[11px] font-semibold text-muted">정산 예정금</div>
                        <div className="text-[22px] font-extrabold tracking-tight">{c?.supportAmount.toLocaleString()}<span className="text-[13px] font-semibold">원</span></div>
                        <div className="text-[10px] text-mutedSoft">3.3% 원천징수 후 입금</div>
                      </div>
                    </div>

                    {actionable ? (
                      <Link
                        href={`/r/press/${c?.id}/write?pass=${p.id}`}
                        className="block w-full h-11 rounded-full bg-ink text-white text-[14px] font-bold grid place-items-center"
                      >
                        작성 시작하기
                      </Link>
                    ) : p.status === "review_submitted" ? (
                      <div className="p-3 bg-surfaceSoft rounded-md text-[12px] text-muted text-center font-semibold">
                        사장님 검수 중 · 최대 72시간
                      </div>
                    ) : p.status === "completed" ? (
                      <div className="p-3 bg-success/10 border border-success/20 rounded-md text-[12px] text-success text-center font-semibold">
                        정산 완료
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {press.length === 0 && (
                <div className="py-12 text-center text-muted text-[14px]">
                  진행 중인 기자단이 없어요.<br />
                  <Link href="/r/home" className="text-ink underline mt-1 inline-block">홈 기자단 탭에서 신청하기 →</Link>
                </div>
              )}
            </div>
          </div>
        }
      />
    </div>
  );
}
