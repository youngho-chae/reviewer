import { after } from "next/server";
import Link from "next/link";
import Image from "next/image";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync, persistNaverRefresh } from "@/lib/db";
import { channelOffers, bestEligibleSupport } from "@/lib/grade";
import type { SnsKind } from "@/lib/types";
import { photoForStore } from "@/lib/store-photo";
import { SBUI, sbNum } from "@/lib/storyboard";
import Icon from "@/components/Icon";
import ChannelIcons from "@/components/ChannelIcons";
import HomeLocationChip from "./HomeLocationChip";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 결정론적 도보 시간 mock (storeId 해시 기반)
function walkMinutes(storeId: string): number {
  let h = 0;
  for (let i = 0; i < storeId.length; i++) h = (h * 31 + storeId.charCodeAt(i)) >>> 0;
  return 3 + (h % 10);
}

interface HomeCard {
  storeId: string;
  campaignId: string;
  name: string;
  area: string;
  category: string;
  supportAmount: number;
  requiredChannels: SnsKind[];
  remain: number;
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

  // [P1] 등급은 참여 자격이 아님 — 금액만 내 채널 등급 기준 개인화.
  const cards: HomeCard[] = visitCampaigns.map((c) => {
    const store = db.stores.find((s) => s.id === c.storeId)!;
    const offers = channelOffers(c.requiredChannels, me.channelGrades, c.supportAmount);
    const myBest = bestEligibleSupport(offers);
    const totalQ = c.quota.S + c.quota.A + c.quota.B + c.quota.C;
    const usedQ = c.used.S + c.used.A + c.used.B + c.used.C;
    return {
      storeId: store.id,
      campaignId: c.id,
      name: store.name,
      area: store.area,
      category: store.category,
      supportAmount: myBest > 0 ? myBest : c.supportAmount,
      requiredChannels: c.requiredChannels,
      remain: totalQ - usedQ,
      walkMin: walkMinutes(store.id),
    };
  });

  // stat-strip — 내 활동 3종 (전부 실데이터 집계 — P4)
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
  const myPasses = db.passes.filter((p) => p.reviewerId === me.id);
  const savedThisMonth = myPasses
    .filter((p) => p.usedAt && p.usedAt >= monthStart && typeof p.supportApplied === "number")
    .reduce((s, p) => s + (p.supportApplied || 0), 0);
  const pendingReviews = myPasses.filter((p) => p.status === "used").length;
  const upcoming = myPasses.filter((p) => p.status === "active").length;

  // 걸어서 갈 수 있어요 — 도보 가까운 순 4개 · 전체 리스트 — 내 혜택 큰 순
  const nearby = [...cards].sort((a, b) => a.walkMin - b.walkMin).slice(0, 4);
  const all = [...cards].sort((a, b) => b.supportAmount - a.supportAmount);

  const repArea = cards[0] ? cards[0].area : "내 동네";
  const unread = db.notifications.filter((n) => n.role === "reviewer" && n.userId === me.id && !n.read).length;

  return (
    <div className="pb-24 bg-canvas">
      {/* top-app-bar — 위치 선택 + 검색/알림 */}
      <div className="sticky top-0 z-30 bg-canvas">
        <div className="h-[52px] px-5 flex items-center justify-between">
          <Link href="/r/explore" className="cp-action inline-flex items-center gap-1 text-[18px] font-bold text-ink tracking-title" aria-label="지역 선택">
            <Icon name="pin" variant="bold" size={18} className="text-ink" />
            <HomeLocationChip fallbackArea={repArea} />
            <Icon name="chevron-down" variant="border" size={16} className="text-muted" />
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/r/explore" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="검색">
              <Icon name="search" variant="border" size={22} />
            </Link>
            <Link href="/r/notifications" className="cp-action relative w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="알림">
              <Icon name="bell" variant={unread > 0 ? "bold" : "border"} size={22} />
              {unread > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand" />}
            </Link>
          </div>
        </div>
      </div>

      {/* promo-banner — 마케팅 슬롯 (CMS 연동 전 placeholder 카피) */}
      <section className="px-5 pt-2">
        <div className="relative overflow-hidden rounded-lg bg-info text-white p-5 min-h-[104px]">
          <span className="inline-flex items-center px-2.5 py-1 rounded-pill bg-white/20 text-[11px] font-semibold">
            할인쿠폰
          </span>
          <div className="mt-2 text-[16px] font-bold leading-[1.4]">
            프로모션 배너 타이틀
            <br />
            프로모션 배너 서브카피
          </div>
          <div className="absolute right-4 bottom-4 text-[11px] text-white/70">배너 이미지 영역</div>
        </div>
      </section>

      {/* stat-strip — 이번 달 아낀 금액 / 밀린 리뷰 / 참여 예정 */}
      <section className="px-5 mt-3">
        <div className="rounded-lg border border-hairline bg-canvas grid grid-cols-3">
          <div className="py-4 px-3 text-center">
            <div className="text-[12px] text-muted">이번 달 아낀 금액</div>
            <div className="mt-1 text-[16px] font-bold text-ink tabular-nums">{sbNum(SBUI.saved, `₩${savedThisMonth.toLocaleString()}`)}</div>
          </div>
          <div className="py-4 px-3 text-center border-l border-r border-hairlineSoft">
            <div className="text-[12px] text-muted">밀린 리뷰</div>
            <div className="mt-1 text-[16px] font-bold text-ink tabular-nums">{sbNum(SBUI.count, String(pendingReviews))}</div>
          </div>
          <Link href="/r/passes" className="cp-action py-4 px-3 text-center block">
            <div className="text-[12px] text-brand font-semibold">🎫 참여 예정</div>
            <div className="mt-1 text-[16px] font-bold text-brand tabular-nums">{sbNum(SBUI.count, String(upcoming))}</div>
          </Link>
        </div>
      </section>

      {/* 걸어서 갈 수 있어요 👀 */}
      <section className="px-5 mt-8 mb-3 flex items-end justify-between">
        <h2 className="text-[18px] font-bold text-ink tracking-title">
          걸어서 갈 수 있어요<span aria-hidden>👀</span>
        </h2>
        <Link href="/r/explore" className="cp-action inline-flex items-center text-[13px] text-muted font-medium">
          더 둘러보기
          <Icon name="chevron-right" variant="border" size={14} />
        </Link>
      </section>
      <section className="px-5 grid grid-cols-2 gap-3">
        {nearby.map((p) => (
          <ExperienceCard key={p.storeId} card={p} />
        ))}
        {nearby.length === 0 && (
          <div className="col-span-2 py-12 text-center text-muted text-[13px]">현재 모집 중인 체험이 없어요</div>
        )}
      </section>

      {/* 내가 체험할 수 있는 전체 리스트 👀 */}
      <section className="px-5 mt-9 mb-3 flex items-end justify-between">
        <h2 className="text-[18px] font-bold text-ink tracking-title">
          내가 체험할 수 있는 전체 리스트<span aria-hidden>👀</span>
        </h2>
        <Link href="/r/explore?sort=topSupport" className="cp-action inline-flex items-center text-[13px] text-muted font-medium shrink-0">
          더 둘러보기
          <Icon name="chevron-right" variant="border" size={14} />
        </Link>
      </section>
      <section className="px-5 grid grid-cols-2 gap-x-3 gap-y-6">
        {all.map((p) => (
          <ExperienceCard key={`all-${p.storeId}`} card={p} />
        ))}
        {all.length === 0 && (
          <div className="col-span-2 py-12 text-center text-muted text-[13px]">지금은 동네가 잠깐 쉬는 중</div>
        )}
      </section>
    </div>
  );
}

/* experience-card — 4:3 사진 + SNS 배지 + 🎫 남음 + 가게명 + 최대 ₩N 지원 (DESIGN.md v2) */
function ExperienceCard({ card }: { card: HomeCard }) {
  return (
    <Link href={`/r/store/${card.storeId}?campaign=${card.campaignId}`} className="cp-action block">
      <div className="aspect-[4/3] bg-sunken relative overflow-hidden rounded-md">
        <Image
          src={photoForStore(card.storeId, card.category)}
          alt={card.name}
          fill
          sizes="(max-width: 480px) 50vw, 240px"
          className="object-cover"
        />
      </div>
      <div className="mt-2">
        <ChannelIcons channels={card.requiredChannels} size={12} />
        <div className="mt-1.5 text-[13px] font-semibold text-ink2 flex items-center gap-1">
          <span aria-hidden>🎫</span>
          <span className="tabular-nums">{SBUI.remain}</span> 남음
        </div>
        <div className="mt-0.5 text-[15px] font-semibold text-ink truncate">{card.name}</div>
        <div className="mt-0.5 text-[16px] font-bold text-ink tabular-nums">최대 {SBUI.support} 지원</div>
      </div>
    </Link>
  );
}
