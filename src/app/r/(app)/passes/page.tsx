import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import GradeBadge from "@/components/GradeBadge";
import PassesTabs from "./PassesTabs";
import PassPendingBanner from "./PassPendingBanner";

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
  active: "text-brand",
  used: "text-ink",
  review_submitted: "text-muted",
  completed: "text-brand",
  expired: "text-mutedSoft",
  rejected: "text-error",
} as any)[s] || "text-muted";

export default async function MyPasses({ searchParams }: { searchParams: Promise<{ pending?: string }> }) {
  const me = await getCurrentReviewer();
  const { pending } = await searchParams;
  const db = await getDBAsync();

  // pending=passId가 있으면 우리 인스턴스에서 보이는지 확인 후 발견 시 적절한 상세로 즉시 이동.
  // 방문형 → /r/passes/{id} (QR 티켓), 기자단 → /r/press/{campaignId}/write?pass={id}
  if (pending) {
    const found = db.passes.find((p) => p.id === pending && p.reviewerId === me.id);
    if (found) {
      const camp = db.campaigns.find((x) => x.id === found.campaignId);
      if (camp?.kind === "press") {
        redirect(`/r/press/${camp.id}/write?pass=${found.id}`);
      }
      redirect(`/r/passes/${found.id}`);
    }
  }

  const allPasses = db.passes
    .filter((p) => p.reviewerId === me.id)
    .sort((a, b) => b.issuedAt - a.issuedAt);

  const now = Date.now();
  for (const p of allPasses) {
    if (p.status === "active" && now > p.expiresAt) p.status = "expired";
  }

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

  return (
    <div className="pb-24 bg-canvas">
      {/* Sub-nav */}
      <div className="sticky top-0 z-10 frosted-parchment border-b border-hairlineSoft">
        <div className="h-13 px-5 flex items-center">
          <h1 className="text-[21px] font-semibold text-ink tracking-[-0.011em]">내 체험권</h1>
        </div>
      </div>

      {pending && <PassPendingBanner pendingId={pending} />}

      <PassesTabs
        visitCount={visit.length}
        pressCount={press.length}
        visitView={
          <div className="px-6 mt-6 space-y-3 pb-8">
            {visitItems.map(({ p, store, c, days, hours }) => (
              <Link
                key={p.id}
                href={`/r/passes/${p.id}`}
                className="cp-action block bg-canvas border border-hairline rounded-lg p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <GradeBadge grade={p.reviewerGrade} size="sm" />
                    <span className="text-[12px] tracking-[0.18em] uppercase text-muted">{p.reviewerGrade}등급</span>
                  </div>
                  <span className={`text-[13px] font-medium ${statusCls(p.status)}`}>{statusLabel(p.status)}</span>
                </div>
                <h3 className="font-display text-[24px] leading-[1.14] text-ink">{store?.name}</h3>
                <p className="text-[14px] text-muted mt-1">{store?.area} · {store?.category}</p>
                <div className="flex items-end justify-between mt-5 pt-4 border-t border-dashed border-hairline">
                  <div>
                    <div className="text-[12px] text-muted">할인 금액</div>
                    <div className="text-[22px] font-semibold text-ink tracking-[-0.022em] leading-none mt-1">
                      ₩{c?.supportAmount.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[12px] text-muted">유효기간</div>
                    <div className="text-[14px] text-ink mt-1">
                      {p.status === "active" ? `${days}일 ${hours}시간` : statusLabel(p.status)}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            {visit.length === 0 && (
              <div className="py-16 text-center">
                <p className="text-[17px] text-muted">아직 발급된 방문형 체험권이 없어요.</p>
                <Link href="/r/home" className="cp-action inline-block mt-4 text-[15px] text-brand">홈에서 체험권 받기 →</Link>
              </div>
            )}
          </div>
        }
        pressView={
          <div>
            {/* Stat strip — Apple parchment utility row */}
            <div className="mx-6 mt-6 p-5 bg-parchment border border-hairline rounded-lg grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-[19px] font-semibold tracking-[-0.022em] text-ink leading-none">{press.filter((p) => p.status === "active").length}</div>
                <div className="text-[11px] text-muted mt-2">작성 중</div>
              </div>
              <div className="text-center border-l border-r border-hairline">
                <div className="text-[19px] font-semibold tracking-[-0.022em] text-ink leading-none">{press.filter((p) => p.status === "review_submitted").length}</div>
                <div className="text-[11px] text-muted mt-2">검수 중</div>
              </div>
              <div className="text-center">
                <div className="text-[15px] font-semibold tracking-[-0.022em] text-ink leading-none">₩{Math.round(pendingPay / 1000)}K</div>
                <div className="text-[11px] text-muted mt-2">정산 예정</div>
              </div>
            </div>

            <div className="px-6 mt-5 space-y-3 pb-8">
              {pressItems.map(({ p, store, c }) => {
                const actionable = p.status === "active";
                return (
                  <div key={p.id} className="bg-canvas border border-hairline rounded-lg p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <GradeBadge grade={p.reviewerGrade} size="sm" />
                        <span className="text-[12px] tracking-[0.18em] uppercase text-muted">기자단</span>
                      </div>
                      <span className={`text-[13px] font-medium ${statusCls(p.status)}`}>
                        {p.status === "active" ? "자료 수령" : statusLabel(p.status)}
                      </span>
                    </div>
                    <h3 className="font-display text-[22px] leading-[1.14] text-ink">{store?.name}</h3>
                    <p className="text-[14px] text-muted mt-1">{store?.area} · {store?.category}</p>

                    <div className="mt-4 pt-4 border-t border-hairline">
                      <div className="text-[12px] text-muted">정산 예정금</div>
                      <div className="text-[26px] font-semibold text-ink tracking-[-0.022em] leading-none mt-1">
                        ₩{c?.supportAmount.toLocaleString()}
                      </div>
                      <div className="text-[12px] text-muted mt-1">3.3% 원천징수 후 입금</div>
                    </div>

                    {actionable ? (
                      <Link
                        href={`/r/press/${c?.id}/write?pass=${p.id}`}
                        className="cp-action block mt-5 h-11 rounded-pill bg-brand text-white grid place-items-center text-[15px]"
                      >
                        작성 시작 →
                      </Link>
                    ) : p.status === "review_submitted" ? (
                      <div className="mt-5 p-3 bg-parchment rounded-sm text-[13px] text-muted text-center">
                        사장님 검수 중 · 최대 72시간
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {press.length === 0 && (
                <div className="py-16 text-center">
                  <p className="text-[17px] text-muted">진행 중인 기자단이 없어요.</p>
                  <Link href="/r/home" className="cp-action inline-block mt-4 text-[15px] text-brand">홈 기자단 탭에서 신청 →</Link>
                </div>
              )}
            </div>
          </div>
        }
      />
    </div>
  );
}
