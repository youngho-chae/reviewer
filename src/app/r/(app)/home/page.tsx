import { after } from "next/server";
import Link from "next/link";
import Image from "next/image";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync, persistNaverRefresh } from "@/lib/db";
import { gradeMeets } from "@/lib/grade";
import type { Grade } from "@/lib/types";
import { photoForStore } from "@/lib/store-photo";
import Icon from "@/components/Icon";
import GradeBadge from "@/components/GradeBadge";
import HomeLocationChip from "./HomeLocationChip";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SEVEN_DAYS = 7 * 86400000;

// 결정론적 도보 시간 mock (storeId 해시 기반)
function walkMinutes(storeId: string): number {
  let h = 0;
  for (let i = 0; i < storeId.length; i++) h = (h * 31 + storeId.charCodeAt(i)) >>> 0;
  return 3 + (h % 10);
}

interface NearbyCard {
  storeId: string;
  campaignId: string;
  name: string;
  area: string;
  category: string;
  supportAmount: number;
  rating: number;
  reviewCount: number;
  accessible: boolean;
  walkMin: number;
}

export default async function ReviewerHome() {
  const me = await getCurrentReviewer();
  const db = await getDBAsync();
  if (!db.naverDataFetched) {
    after(async () => {
      await persistNaverRefresh();
    });
  }
  const now = Date.now();

  const visitCampaigns = db.campaigns.filter((c) => c.kind === "visit" && c.endAt > now);

  // 모든 활성 매장 카드 — 큐레이션 컬렉션과 가까운 곳 그리드에 사용
  const cards: NearbyCard[] = visitCampaigns.map((c) => {
    const store = db.stores.find((s) => s.id === c.storeId)!;
    const minNeededGrade: "S" | "A" | "B" | "C" =
      c.quota.C > 0 ? "C" : c.quota.B > 0 ? "B" : c.quota.A > 0 ? "A" : "S";
    return {
      storeId: store.id,
      campaignId: c.id,
      name: store.name,
      area: store.area,
      category: store.category,
      supportAmount: c.supportAmount,
      rating: store.rating,
      reviewCount: store.reviewCount,
      accessible: gradeMeets(me.grade, minNeededGrade as Grade),
      walkMin: walkMinutes(store.id),
    };
  });

  // 3-카드 큐레이션 카운트
  const cafeNew = visitCampaigns.filter(
    (c) => now - c.createdAt < SEVEN_DAYS && (() => {
      const s = db.stores.find((x) => x.id === c.storeId);
      return s?.category === "카페" || s?.category === "디저트";
    })(),
  ).length;
  const popular = visitCampaigns.filter((c) => {
    const s = db.stores.find((x) => x.id === c.storeId);
    return s && s.rating >= 4.5;
  }).length;
  const totalSupportNow = visitCampaigns.length;
  const maxSupport = visitCampaigns.reduce((m, c) => Math.max(m, c.supportAmount), 0);

  // 가까운 곳 그리드 — accessible 우선, 도보 가까운 순 4개
  const nearby = [...cards]
    .sort((a, b) => Number(b.accessible) - Number(a.accessible) || a.walkMin - b.walkMin)
    .slice(0, 4);

  // 헤더 — 시드 사용자 지역 또는 첫 매장 지역으로 대표
  const repArea = me.nickname && cards[0] ? cards[0].area : "내 동네";
  const totalCount = cards.length;
  const unread = db.notifications.filter((n) => n.role === "reviewer" && n.userId === me.id && !n.read).length;

  return (
    <div className="pb-24 bg-canvas">
      {/* Sticky frosted top */}
      <div className="sticky top-0 z-30 frosted-parchment border-b border-hairlineSoft">
        <div className="h-13 px-5 flex items-center justify-between">
          <div className="text-[15px] font-semibold text-ink">CATCHPASS</div>
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

      {/* Hero — "{지역} 어디 가볼까?" + 내 등급 칩 */}
      <section className="px-5 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[32px] leading-[1.1] text-ink tracking-[-0.022em]">
              <HomeLocationChip fallbackArea={repArea} />
              <span> 어디 가볼까?</span>
            </h1>
            <p className="text-[14px] text-ink2 mt-2">
              근처에 가볼 수 있는 곳 <strong className="text-ink">{totalCount}곳</strong>이 있어요
            </p>
          </div>
          <Link
            href="/r/rewards"
            className="cp-action shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-md bg-brand/8 border border-brand/14"
          >
            <GradeBadge grade={me.grade} size="sm" />
            <div className="text-[10px] text-brand font-semibold">혜택 보기</div>
          </Link>
        </div>
      </section>

      {/* 검색 + 지도 */}
      <section className="px-5 mt-5 flex items-center gap-2">
        <Link
          href="/r/explore"
          className="cp-action relative flex-1 h-12 pl-12 pr-4 rounded-pill bg-parchment border border-hairline flex items-center text-[14px] text-muted"
        >
          <Icon name="search" variant="border" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          매장, 메뉴, 지역을 검색해보세요
        </Link>
        <Link
          href="/r/explore?mode=map"
          className="cp-action shrink-0 inline-flex items-center gap-1 h-12 px-4 rounded-pill border border-hairline bg-canvas text-[14px] text-ink"
        >
          <Icon name="pin" variant="border" size={14} />
          지도
        </Link>
      </section>

      {/* 동네 발견 배너 — 큰 일러스트 */}
      <Link
        href="/r/explore?sort=new"
        className="cp-action mx-5 mt-6 rounded-2xl bg-gradient-to-br from-brand/8 to-brand/4 border border-brand/12 overflow-hidden block relative"
      >
        <div className="flex items-center px-5 py-6 gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-[12px] text-brand font-semibold tracking-[0.06em]">동네 발견</div>
            <div className="font-display text-[24px] leading-[1.1] text-ink mt-1.5">
              새로운 공간이<br />
              <span className="text-brand">많이 생겼어요!</span>
            </div>
            <div className="mt-3 inline-flex items-center gap-1 px-3 h-8 rounded-pill bg-canvas border border-hairline text-[12px] text-ink">
              신상 장소 보기
              <Icon name="chevron-right" variant="border" size={12} />
            </div>
          </div>
          <div className="shrink-0 w-[120px] h-[120px] flex items-end justify-center" aria-hidden>
            {/* 도시 이모지 일러스트 */}
            <div className="relative w-full h-full">
              <span className="absolute left-2 top-4 text-[44px] opacity-90">🏢</span>
              <span className="absolute right-2 top-0 text-[36px] opacity-80">🏬</span>
              <span className="absolute left-0 bottom-2 text-[34px]">🏪</span>
              <span className="absolute left-12 top-0 text-[20px]">📍</span>
              <span className="absolute right-0 top-10 text-[18px]">📍</span>
              <span className="absolute right-6 bottom-1 text-[18px]">📍</span>
            </div>
          </div>
        </div>
      </Link>

      {/* 3-카드 큐레이션 */}
      <section className="px-5 mt-4 grid grid-cols-3 gap-2.5">
        <CurationTile
          href="/r/explore?cat=카페&sort=new"
          tint="purple"
          ic="☕"
          title="신상 카페"
          sub="방금 등록됐어요"
          count={cafeNew}
        />
        <CurationTile
          href="/r/explore?sort=topSupport"
          tint="pink"
          ic="🔥"
          title="인기 맛집"
          sub="평점 4.5 이상"
          count={popular}
        />
        <CurationTile
          href="/r/explore?sort=topSupport"
          tint="green"
          ic="💲"
          title="체험 지원 중"
          sub={`최대 ₩${maxSupport.toLocaleString()}`}
          count={totalSupportNow}
        />
      </section>

      {/* 가까운 곳 2단 그리드 */}
      <section className="px-5 mt-8 mb-4 flex items-end justify-between">
        <h2 className="font-display text-[22px] leading-[1.14] text-ink">
          가까운 곳에 좋은 곳이 많아요 <span aria-hidden>👀</span>
        </h2>
        <Link href="/r/explore" className="text-[13px] text-brand">더보기 ›</Link>
      </section>

      <section className="px-5 grid grid-cols-2 gap-3">
        {nearby.map((p) => (
          <Link
            key={p.storeId}
            href={p.accessible ? `/r/store/${p.storeId}?campaign=${p.campaignId}` : "/r/grade"}
            className={`cp-action block bg-canvas border border-hairline rounded-lg overflow-hidden ${p.accessible ? "" : "opacity-50"}`}
          >
            <div className="aspect-[4/3] bg-parchment relative overflow-hidden">
              <Image
                src={photoForStore(p.storeId, p.category)}
                alt={p.name}
                fill
                sizes="(max-width: 480px) 50vw, 240px"
                className="object-cover"
              />
              <div className="absolute top-2 left-2">
                <span className="text-[10px] font-semibold text-ink bg-canvas/90 px-1.5 py-0.5 rounded-pill backdrop-blur-sm">
                  도보 {p.walkMin}분
                </span>
              </div>
            </div>
            <div className="p-3">
              <div className="text-[15px] font-semibold text-ink truncate">{p.name}</div>
              <p className="text-[11px] text-muted mt-0.5 truncate">{p.category} · {p.area}</p>
              <div className="text-[13px] text-success font-semibold mt-1.5">
                체험 지원 ₩{p.supportAmount.toLocaleString()}
              </div>
              <div className="text-[11px] text-muted mt-1">
                <span className="text-[#ffa500]" aria-hidden>★</span>{" "}
                <span className="text-ink font-semibold">{p.rating}</span>{" "}
                <span>({p.reviewCount.toLocaleString()})</span>
              </div>
            </div>
          </Link>
        ))}
        {nearby.length === 0 && (
          <div className="col-span-2 py-12 text-center text-muted text-[13px]">
            현재 모집 중인 매장이 없어요
          </div>
        )}
      </section>

      {/* 등급 혜택 배너 — 이미지 1 하단 */}
      <Link
        href="/r/rewards"
        className="cp-action mx-5 mt-6 flex items-center gap-3 p-4 rounded-md border border-hairline bg-parchment"
      >
        <span className="w-10 h-10 rounded-md bg-brand/12 text-brand flex items-center justify-center">
          <Icon name="ticket" variant="bold" size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-ink">{me.grade} 등급 혜택이 넓어졌어요!</div>
          <div className="text-[11px] text-muted mt-0.5">더 많은 체험 지원 매장을 만나보세요</div>
        </div>
        <span className="inline-flex items-center gap-0.5 h-8 px-3 rounded-pill bg-canvas border border-hairline text-[12px] text-ink">
          혜택 보러가기
          <Icon name="chevron-right" variant="border" size={12} />
        </span>
      </Link>
    </div>
  );
}

function CurationTile({
  href,
  tint,
  ic,
  title,
  sub,
  count,
}: {
  href: string;
  tint: "purple" | "pink" | "green";
  ic: string;
  title: string;
  sub: string;
  count: number;
}) {
  const palette = {
    purple: { bg: "bg-[#f0eeff]", chip: "bg-[#dcd6ff] text-[#5b4cdb]" },
    pink: { bg: "bg-[#ffeae3]", chip: "bg-[#ffd0c2] text-[#d04025]" },
    green: { bg: "bg-[#e2f7ec]", chip: "bg-[#c5edd4] text-[#1f8a4d]" },
  }[tint];
  return (
    <Link href={href} className={`cp-action block p-3 rounded-md ${palette.bg} relative`}>
      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-md text-[16px] ${palette.chip}`}>{ic}</span>
      <div className="text-[12px] font-semibold text-ink mt-2.5">{title}</div>
      <div className="text-[10px] text-muted mt-0.5 truncate">{sub}</div>
      <div className="flex items-end justify-between mt-2">
        <div className="text-[20px] font-bold text-ink leading-none">{count}</div>
        <Icon name="chevron-right" variant="border" size={12} className="text-muted mb-1" />
      </div>
    </Link>
  );
}
