import { after } from "next/server";
import Link from "next/link";
import Image from "next/image";
import { getReviewerOrNull } from "@/lib/server-helpers";
import { getDBAsync, persistNaverRefresh } from "@/lib/db";
import { channelOffers, bestEligibleSupport } from "@/lib/grade";
import type { SnsKind } from "@/lib/types";
import { photoForStore } from "@/lib/store-photo";
import { SBUI, sbNum } from "@/lib/storyboard";
import { mockDistanceM, walkMinutes, NEARBY_RADIUS_M } from "@/lib/distance-mock";
import { haversineM, regionCenter } from "@/lib/geo";
import { regionFromAddress } from "@/lib/regions";
import { compareRecommended } from "@/lib/recommend";
import { effectiveChannelState } from "@/lib/sns-cookie";
import { PLAN_RANK } from "@/lib/plan-policy";
import { isCampaignVisible, campaignExposure, campaignRemain } from "@/lib/campaign-visibility";
import { DELIVERY_ENABLED } from "@/lib/flags";
import Icon from "@/components/Icon";
import ChannelIcons from "@/components/ChannelIcons";
import HomeLocationChip from "./HomeLocationChip";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface HomeCard {
  storeId: string;
  campaignId: string;
  name: string;
  area: string;
  category: string;
  supportAmount: number;
  requiredChannels: SnsKind[];
  remain: number;
  soldOut: boolean; // 발급 소진(살아있는 체험권만 남음) — 노출 유지 + 발급 마감 표시
  walkMin: number;
  distanceM: number;
  lat?: number;
  lng?: number;
  createdAt: number;
  planRank: number; // 사장님 멤버십 랭크 — 추천순 (§4)
  // [2026-07-12 회의 §4-3·§6-2] 전체 리스트 카드는 잔여 수 대신 지역(1차·2차) 정보 우선
  region: string;
}

export default async function ReviewerHome({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>;
}) {
  // 게스트 브라우징 (2026-07-24) — 미로그인도 홈 열람 허용. 개인화 값은 마스크.
  const me = await getReviewerOrNull();
  // 인스턴스 불일치 스톱갭 — 연동 직후 금액 개인화가 최신 채널 등급 기준으로 (sns-cookie.ts)
  const eff = me ? await effectiveChannelState(me) : { sns: [], channelGrades: {}, grade: "N" as const };
  const { area: areaParam } = await searchParams;
  const db = await getDBAsync();
  if (!db.naverDataFetched) {
    after(async () => {
      await persistNaverRefresh();
    });
  }
  const now = Date.now();

  // [노출 정책] 발급 소진 ≠ 종료 — 살아있는 체험권이 남은 캠페인은 계속 노출 (2026-07-07 회의)
  const visitCampaigns = db.campaigns.filter(
    (c) => c.kind === "visit" && isCampaignVisible(c, db.passes, now),
  );

  // [추천순 §4] 사장님 멤버십 플랜 랭크 — 조회 시점 조인 (리뷰어 등급 아님 · P1 무관)
  const ownerPlanRank = new Map(db.owners.map((o) => [o.id, PLAN_RANK[o.plan] ?? 0]));
  // [2026-07-12 회의 §1-3] 카드 '참여 중' 배지 삭제 — 신청 상태는 상세 CTA로 구분

  // [P1] 등급은 참여 자격이 아님 — 금액만 내 채널 등급 기준 개인화.
  const cards: HomeCard[] = visitCampaigns.map((c) => {
    const store = db.stores.find((s) => s.id === c.storeId)!;
    const offers = channelOffers(c.requiredChannels, eff.channelGrades, c.supportAmount);
    const myBest = bestEligibleSupport(offers);
    return {
      storeId: store.id,
      campaignId: c.id,
      name: store.name,
      area: store.area,
      category: store.category,
      supportAmount: myBest > 0 ? myBest : c.supportAmount,
      requiredChannels: c.requiredChannels,
      remain: campaignRemain(c),
      soldOut: campaignExposure(c, db.passes, now) === "issued_out",
      walkMin: walkMinutes(store.id),
      distanceM: mockDistanceM(store.id),
      lat: store.lat,
      lng: store.lng,
      createdAt: c.createdAt,
      planRank: ownerPlanRank.get(store.ownerId) ?? 0,
      region: regionFromAddress(store.address, store.area),
    };
  });

  // stat-strip — 내 활동 3종 (전부 실데이터 집계 — P4)
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
  const myPasses = me ? db.passes.filter((p) => p.reviewerId === me.id) : [];
  const savedThisMonth = myPasses
    .filter((p) => p.usedAt && p.usedAt >= monthStart && typeof p.supportApplied === "number")
    .reduce((s, p) => s + (p.supportApplied || 0), 0);
  const pendingReviews = myPasses.filter((p) => p.status === "used").length;
  const upcoming = myPasses.filter((p) => p.status === "active").length;

  // 지역 변경(2026-07-07 회의) — 홈에서 지역을 바꾸면 '걸어서 갈 수 있어요'만 해당 지역 기준으로 변경.
  // 전국 체험단 리스트(아래 전체 리스트)는 영향받지 않는다.
  // 2026-07-08: 지역 선택은 /r/location(시도→시군구) 페이지에서 — 임의 지역 라벨을 그대로 수용.
  const selectedArea = areaParam || undefined;

  // 걸어서 갈 수 있어요 — 기준 지점 반경 3km 이내, 가까운 순 최대 10개 · 1단 캐러셀.
  // 지역 선택 시: 그 지역의 기준 좌표(regionCenter)에서 반경 3km 실좌표(하버사인) 필터 (확정 정책 1-3).
  // (기존 area 문자열 정확 일치 방식은 지역 선택 페이지 라벨과 시드 area가 달라 항상 빈 결과였음 — 좌표 기준으로 정정)
  const areaCenter = selectedArea ? regionCenter(selectedArea) : null;
  const nearby = (
    areaCenter
      ? cards
          .filter((p) => p.lat != null && p.lng != null && haversineM(areaCenter, { lat: p.lat!, lng: p.lng! }) <= NEARBY_RADIUS_M)
          .sort(
            (a, b) =>
              haversineM(areaCenter, { lat: a.lat!, lng: a.lng! }) -
              haversineM(areaCenter, { lat: b.lat!, lng: b.lng! }),
          )
      : cards.filter((p) => p.distanceM <= NEARBY_RADIUS_M).sort((a, b) => a.distanceM - b.distanceM)
  ).slice(0, 10);
  // 전국 체험단 전체 리스트 — 추천순(사장님 멤버십 랭크 → 최신순) · 최대 30개 (2026-07-10 §6-3)
  const all = [...cards].sort(compareRecommended).slice(0, 30);

  // 집으로 배송받는 체험 (2026-07-12 레뷰 벤치마크) — 배송형 캠페인 · 추천순 최대 10개 · 1단 캐러셀
  const deliveryHome = DELIVERY_ENABLED
    ? db.campaigns
        .filter((c) => c.kind === "delivery" && isCampaignVisible(c, db.passes, now))
        .map((c) => {
          const store = db.stores.find((s) => s.id === c.storeId)!;
          return {
            storeId: store.id,
            campaignId: c.id,
            name: store.name,
            // 상품 카테고리 우선 (2026-07-12 정정 — 배송형은 플레이스 분류가 아님)
            category: c.productCategory ?? store.category,
            requiredChannels: c.requiredChannels,
            remain: campaignRemain(c),
            soldOut: campaignExposure(c, db.passes, now) === "issued_out",
            pointReward: c.pointReward ?? 0,
            createdAt: c.createdAt,
            planRank: ownerPlanRank.get(store.ownerId) ?? 0,
          };
        })
        .sort(compareRecommended)
        .slice(0, 10)
    : [];

  // 동적 섹션 타이틀 (§6-1) — 특정 지역 선택 시 2차 행정구역명으로: "마포구에서 갈 수 있어요"
  // (라벨 마지막 토큰 = 시군구. STORYBOARD에서는 area 라벨 자체가 "지역"이라 자연 마스킹)
  const walkTitleArea = selectedArea ? selectedArea.trim().split(/\s+/).pop() : null;

  const repArea = cards[0] ? cards[0].area : "내 동네";
  const unread = me ? db.notifications.filter((n) => n.role === "reviewer" && n.userId === me.id && !n.read).length : 0;

  return (
    <div className="pb-24 bg-canvas">
      {/* top-app-bar — 위치 선택 + 검색/알림 */}
      <div className="sticky top-0 z-30 bg-canvas">
        <div className="h-[52px] px-5 flex items-center justify-between">
          <HomeLocationChip fallbackArea={repArea} selectedArea={selectedArea} />
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

      {/* stat-strip — 이번 달 아낀 금액 / 밀린 리뷰 / 참여 예정 (확정 정책 1-1 · 라벨 2026-07-17)
          게스트는 3종 공통 "회원 전용" 표기 (2026-07-24 게스트 브라우징) */}
      <section className="px-5 mt-3">
        <div className="rounded-lg border border-hairline bg-canvas grid grid-cols-3">
          <div className="py-4 px-3 text-center">
            <div className="text-[12px] text-muted">이번 달 아낀 금액</div>
            <div className={`mt-1 text-[16px] font-bold tabular-nums ${me ? "text-ink" : "text-mutedSoft"}`}>
              {me ? sbNum(SBUI.saved, `${savedThisMonth.toLocaleString()}원`) : "회원 전용"}
            </div>
          </div>
          <div className="py-4 px-3 text-center border-l border-r border-hairlineSoft">
            <div className="text-[12px] text-muted">밀린 리뷰</div>
            <div className={`mt-1 text-[16px] font-bold tabular-nums ${me ? "text-ink" : "text-mutedSoft"}`}>
              {me ? sbNum(SBUI.count, `${pendingReviews}건`) : "회원 전용"}
            </div>
          </div>
          <Link href={me ? "/r/passes" : "/r/login?next=%2Fr%2Fhome"} className="cp-action py-4 px-3 text-center block">
            <div className="text-[12px] text-brand font-semibold">🎫 참여 예정</div>
            <div className={`mt-1 text-[16px] font-bold tabular-nums ${me ? "text-brand" : "text-mutedSoft"}`}>
              {me ? sbNum(SBUI.count, `${upcoming}건`) : "회원 전용"}
            </div>
          </Link>
        </div>
      </section>

      {/* 걸어서 갈 수 있어요 👀 — 지역 선택 시 "{시군구}에서 갈 수 있어요" (§6-1) */}
      <section className="px-5 mt-8 mb-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[18px] font-bold text-ink tracking-title truncate">
            {walkTitleArea ? `${walkTitleArea}에서 갈 수 있어요` : "걸어서 갈 수 있어요"}
            <span aria-hidden>👀</span>
          </h2>
          {/* 서브 타이틀 제거 (2026-07-17 지시) — 반경·직선거리 고지는 홈에서 미노출 */}
        </div>
        <Link
          href={`/r/explore?mode=list&sort=distance${selectedArea ? `&area=${encodeURIComponent(selectedArea)}` : ""}`}
          className="cp-action inline-flex items-center text-[13px] text-muted font-medium shrink-0"
        >
          더 둘러보기
          <Icon name="chevron-right" variant="border" size={14} />
        </Link>
      </section>
      {/* 1단 가로 캐러셀 — 최대 10개, 스냅 스크롤 (2026-07-08 회의).
          scrollPaddingLeft 20px: snap-start 기준점을 좌측 패딩 안쪽으로 — 없으면 초기 스냅이 패딩을 침범한다 */}
      <section className="overflow-x-auto snap-x" style={{ scrollbarWidth: "none", scrollPaddingLeft: 20 }}>
        <div className="flex gap-3 px-5">
          {nearby.map((p) => (
            <div key={p.storeId} className="w-[168px] shrink-0 snap-start">
              <ExperienceCard card={p} guest={!me} />
            </div>
          ))}
          {nearby.length === 0 && (
            <div className="w-full py-12 text-center text-muted text-[13px]">
              {selectedArea ? `${selectedArea}에는 지금 모집 중인 체험이 없어요` : "현재 모집 중인 체험이 없어요"}
            </div>
          )}
        </div>
      </section>

      {/* 집으로 배송받는 체험 📦 — 배송형 (2026-07-12 레뷰 벤치마크) */}
      {deliveryHome.length > 0 && (
        <>
          <section className="px-5 mt-9 mb-3 flex items-end justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-[18px] font-bold text-ink tracking-title truncate">
                집으로 배송받는 체험<span aria-hidden>📦</span>
              </h2>
              {/* 서브 타이틀 제거 (2026-07-17 지시) */}
            </div>
            <Link
              href="/r/explore?mode=list&tab=delivery"
              className="cp-action inline-flex items-center text-[13px] text-muted font-medium shrink-0"
            >
              더 둘러보기
              <Icon name="chevron-right" variant="border" size={14} />
            </Link>
          </section>
          <section className="overflow-x-auto snap-x" style={{ scrollbarWidth: "none", scrollPaddingLeft: 20 }}>
            <div className="flex gap-3 px-5">
              {deliveryHome.map((p) => (
                <div key={p.campaignId} className="w-[168px] shrink-0 snap-start">
                  <Link href={`/r/store/${p.storeId}?campaign=${p.campaignId}`} className="cp-action block">
                    <div className="aspect-[4/3] bg-sunken relative overflow-hidden rounded-md">
                      <Image
                        src={photoForStore(p.storeId, p.category)}
                        alt={p.name}
                        fill
                        sizes="168px"
                        className="object-cover"
                      />
                      <span className="absolute left-2 top-2 inline-flex items-center px-1.5 py-0.5 rounded-xs bg-canvas/90 text-brand text-[11px] font-semibold">
                        📦 배송
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="flex items-center gap-1.5">
                        <ChannelIcons channels={p.requiredChannels} size={12} />
                      </div>
                      {p.soldOut ? (
                        <div className="mt-1.5 text-[13px] font-semibold text-mutedSoft">발급 마감 · 체험 진행 중</div>
                      ) : (
                        <div className="mt-1.5 text-[13px] font-semibold text-ink2 flex items-center gap-1">
                          <span aria-hidden>🎫</span>
                          <span className="tabular-nums">{sbNum(SBUI.remain, `${p.remain}개`)}</span> 남음
                        </div>
                      )}
                      <div className="mt-0.5 text-[15px] font-semibold text-ink truncate">{p.name}</div>
                      <div className="mt-0.5 text-[16px] font-bold text-ink tabular-nums">
                        {me ? (
                          <>제품{p.pointReward > 0 ? <> + {sbNum(SBUI.point, `${p.pointReward.toLocaleString()}P`)}</> : " 제공"}</>
                        ) : (
                          <span className="text-[14px] font-semibold text-muted">제품 제공 · 포인트 로그인 후 확인</span>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* 내가 체험할 수 있는 전체 리스트 👀 */}
      <section className="px-5 mt-9 mb-3 flex items-end justify-between">
        <h2 className="text-[18px] font-bold text-ink tracking-title">
          내가 체험할 수 있는 전체 리스트<span aria-hidden>👀</span>
        </h2>
        {/* 더 둘러보기 → 탐색 전국 뷰 (§6-4 확정: 대한민국 전체 축소·시도 클러스터 시작 — 홈 선택 지역 미전달).
            지역 스코프 진입은 '걸어서 갈 수 있어요' 더 둘러보기가 담당 — 두 진입점을 차별화한다. */}
        <Link
          href="/r/explore?scope=all"
          className="cp-action inline-flex items-center text-[13px] text-muted font-medium shrink-0"
        >
          더 둘러보기
          <Icon name="chevron-right" variant="border" size={14} />
        </Link>
      </section>
      <section className="px-5 grid grid-cols-2 gap-x-3 gap-y-6">
        {all.map((p) => (
          <ExperienceCard key={`all-${p.storeId}`} card={p} info="region" guest={!me} />
        ))}
        {all.length === 0 && (
          <div className="col-span-2 py-12 text-center text-muted text-[13px]">지금은 동네가 잠깐 쉬는 중</div>
        )}
      </section>
    </div>
  );
}

/* experience-card — 4:3 사진 + SNS 배지 + 🎫 남음 + 가게명 + 최대 ₩N 지원 (DESIGN.md v2) */
function ExperienceCard({ card, info = "remain", guest = false }: { card: HomeCard; info?: "remain" | "region"; guest?: boolean }) {
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
        <div className="flex items-center gap-1.5">
          <ChannelIcons channels={card.requiredChannels} size={12} />
          {/* [2026-07-12 회의 §1-3] '참여 중' 배지 삭제 — 신청 상태는 상세 CTA로 구분 */}
        </div>
        {/* [§4-3·§6-3] 전체 리스트(info="region")는 잔여 수 대신 지역(1차·2차) 정보 우선 —
            '걸어서'(가까운 체험) 캐러셀은 잔여 체험권 수 유지 */}
        {info === "region" && card.region ? (
          <div className="mt-1.5 text-[13px] font-semibold text-ink2 flex items-center gap-1">
            <span aria-hidden>📍</span>
            <span className="truncate">{sbNum(SBUI.area, card.region)}</span>
          </div>
        ) : card.soldOut ? (
          <div className="mt-1.5 text-[13px] font-semibold text-mutedSoft">발급 마감 · 체험 진행 중</div>
        ) : (
          <div className="mt-1.5 text-[13px] font-semibold text-ink2 flex items-center gap-1">
            <span aria-hidden>🎫</span>
            <span className="tabular-nums">{sbNum(SBUI.remain, `${card.remain}개`)}</span> 남음
          </div>
        )}
        <div className="mt-0.5 text-[15px] font-semibold text-ink truncate">{card.name}</div>
        {/* 게스트는 SNS 미연동이라 금액 산정 불가 — 마스크 (2026-07-24) */}
        {guest ? (
          <div className="mt-0.5 text-[14px] font-semibold text-muted">지원 금액 로그인 후 확인</div>
        ) : (
          <div className="mt-0.5 text-[16px] font-bold text-ink tabular-nums">최대 {sbNum(SBUI.support, `${card.supportAmount.toLocaleString()}원`)} 지원</div>
        )}
      </div>
    </Link>
  );
}
