import Link from "next/link";
import Image from "next/image";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { photoForStore } from "@/lib/store-photo";
import { SBUI, sbNum } from "@/lib/storyboard";
import { walkMinutes } from "@/lib/distance-mock";
import { campaignExposure, campaignRemain, type CampaignExposure } from "@/lib/campaign-visibility";
import Icon from "@/components/Icon";
import ChannelIcons from "@/components/ChannelIcons";

export const dynamic = "force-dynamic";

type Filter = "all" | "open" | "closed";

// 관심 목록 (2026-07-07 회의)
//  - 캠페인 단위 저장, 마이페이지에서 진입
//  - 완전히 종료된 캠페인도 목록에서 유지 + '마감된 체험' 표기 (상세 이동 시 신청 불가)
//  - 필터로 진행 가능 / 마감을 구분해 볼 수 있다
export default async function ReviewerInterests({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const me = await getCurrentReviewer();
  const { f } = await searchParams;
  const filter: Filter = f === "open" || f === "closed" ? f : "all";
  const db = await getDBAsync();
  const now = Date.now();

  const items = (db.interests ?? [])
    .filter((i) => i.reviewerId === me.id)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((i) => {
      const c = db.campaigns.find((x) => x.id === i.campaignId);
      if (!c) return null;
      const store = db.stores.find((s) => s.id === c.storeId);
      if (!store) return null;
      const exposure: CampaignExposure = campaignExposure(c, db.passes, now);
      // '진행 가능' = 지금 발급 신청이 가능한 상태 (open) / 그 외는 '마감'
      const open = exposure === "open";
      return {
        campaignId: c.id,
        storeId: store.id,
        name: store.name,
        category: store.category,
        area: store.area,
        requiredChannels: c.requiredChannels,
        supportAmount: c.supportAmount,
        remain: campaignRemain(c),
        open,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  const openCount = items.filter((x) => x.open).length;
  const closedCount = items.length - openCount;
  const shown = items.filter((x) => (filter === "all" ? true : filter === "open" ? x.open : !x.open));

  const chips: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "전체", count: items.length },
    { key: "open", label: "진행 가능", count: openCount },
    { key: "closed", label: "마감", count: closedCount },
  ];

  return (
    <div className="pb-24 bg-canvas min-h-[100dvh]">
      {/* top-app-bar */}
      <div className="sticky top-0 z-30 bg-canvas">
        <div className="h-[52px] px-3 flex items-center gap-1">
          <Link href="/r/me" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="MY로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
          <h1 className="text-[18px] font-bold text-ink tracking-title">관심 목록</h1>
        </div>
      </div>

      {/* 필터 칩 — 진행 가능 / 마감 구분 */}
      <div className="px-5 mt-2 flex gap-2">
        {chips.map((ch) => {
          const active = filter === ch.key;
          return (
            <Link
              key={ch.key}
              href={ch.key === "all" ? "/r/interests" : `/r/interests?f=${ch.key}`}
              className={`h-10 px-4 rounded-pill text-[14px] bg-canvas inline-flex items-center gap-1.5 whitespace-nowrap ${
                active ? "border-[1.5px] border-ink text-ink font-semibold" : "border border-hairline text-ink2 font-medium"
              }`}
              aria-pressed={active}
            >
              {ch.label}
              <span className="text-muted tabular-nums">{sbNum(SBUI.count, String(ch.count))}</span>
            </Link>
          );
        })}
      </div>

      <div className="px-5 mt-5 space-y-4">
        {shown.map((p) => (
          <Link
            key={p.campaignId}
            href={`/r/store/${p.storeId}?campaign=${p.campaignId}`}
            className={`cp-action flex gap-3 ${p.open ? "" : "opacity-70"}`}
          >
            <div className="relative w-[96px] h-[96px] shrink-0 rounded-md overflow-hidden bg-sunken">
              <Image src={photoForStore(p.storeId, p.category)} alt={p.name} fill sizes="96px" className="object-cover" />
              {!p.open && (
                <div className="absolute inset-0 bg-ink/45 grid place-items-center">
                  <span className="text-white text-[12px] font-semibold">마감된 체험</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <ChannelIcons channels={p.requiredChannels} size={12} />
                {p.open ? (
                  <div className="shrink-0 text-[12px] font-semibold text-ink2 flex items-center gap-1">
                    <span aria-hidden>🎫</span>
                    <span className="tabular-nums">{sbNum(SBUI.remain, `${p.remain}개`)}</span> 남음
                  </div>
                ) : (
                  <span className="shrink-0 text-[12px] font-semibold text-mutedSoft">마감된 체험</span>
                )}
              </div>
              <div className="mt-1 text-[15px] font-semibold text-ink leading-[1.4] line-clamp-2">{p.name}</div>
              <div className="mt-0.5 text-[13px] text-muted">
                {p.category} · {sbNum(SBUI.distance, `도보 ${walkMinutes(p.storeId)}분`)}
              </div>
              <div className="mt-1 text-[16px] font-bold text-ink tabular-nums">최대 {SBUI.support} 지원</div>
            </div>
          </Link>
        ))}
        {shown.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-[15px] text-muted">
              {filter === "closed"
                ? "마감된 관심 체험이 없어요."
                : filter === "open"
                  ? "진행 가능한 관심 체험이 없어요."
                  : "아직 저장한 체험이 없어요. 매장 상세의 ♡를 눌러 담아보세요."}
            </p>
            <Link href="/r/explore" className="cp-action inline-block mt-4 text-[14px] font-semibold text-brand">
              체험 둘러보기 →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
