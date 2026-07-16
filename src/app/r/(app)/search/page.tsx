import Link from "next/link";
import Image from "next/image";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { PRESS_ENABLED, DELIVERY_ENABLED } from "@/lib/flags";
import { isCampaignVisible, campaignRemain, campaignExposure } from "@/lib/campaign-visibility";
import { PLAN_RANK } from "@/lib/plan-policy";
import { compareRecommended } from "@/lib/recommend";
import { regionFromAddress } from "@/lib/regions";
import { photoForStore } from "@/lib/store-photo";
import { SBUI, sbNum } from "@/lib/storyboard";
import ChannelIcons from "@/components/ChannelIcons";
import SearchBox from "./SearchBox";

export const dynamic = "force-dynamic";

/**
 * 통합 검색 (R-14, 2026-07-12 회의 §5 개편)
 *  - 홈·체험권 등 공통 헤더의 검색 아이콘이 진입하는 단일 통합 검색 — 화면마다 다르게 동작하지 않는다 (§5-5)
 *  - 홈 지역 설정과 무관하게 **전체 DB 대상**: 지역명·매장명·캠페인명 검색 (§5-1)
 *  - 검색 실행 후 같은 페이지 하단에 썸네일 카드 리스트 노출 — 최근 검색어는 상단 유지 (§5-2)
 *  - 지역명·매장명 동시 일치 시 모든 결과 노출 (예: "울산" → 울산 지역 + 상호에 울산 포함)
 *  - 카드 데이터는 탐색 리스트와 통일: 이미지·매장명·카테고리·SNS·혜택·지역 1차·2차 (§6-1)
 *  ※ 탐색 리스트의 "현재 결과 내 재검색"과는 별개 기능 (§5-4 — ExploreView 내 입력 영역)
 */
interface SearchResult {
  storeId: string;
  campaignId: string;
  name: string;
  category: string;
  region: string; // 지역 1차·2차 ("서울 강남구") — 동일 상호 지점 구분 (§6-2)
  requiredChannels: ("naver_blog" | "instagram" | "tiktok")[];
  benefit: string; // 방문형 = "최대 N원 지원" / 배송형 = "제품 제공(+NP)"
  isDelivery: boolean;
  remain: number;
  soldOut: boolean;
  planRank: number;
  createdAt: number;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await getCurrentReviewer();
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const db = await getDBAsync();
  const now = Date.now();

  let results: SearchResult[] = [];
  if (query) {
    const ownerPlanRank = new Map(db.owners.map((o) => [o.id, PLAN_RANK[o.plan] ?? 0]));
    const ql = query.toLowerCase();
    results = db.campaigns
      .filter((c) => {
        if (c.kind === "press" && !PRESS_ENABLED) return false;
        if (c.kind === "delivery" && !DELIVERY_ENABLED) return false;
        return isCampaignVisible(c, db.passes, now);
      })
      .map((c) => {
        const store = db.stores.find((s) => s.id === c.storeId);
        if (!store) return null;
        // 검색 대상: 매장명 · 지역(area/주소) · 카테고리(상품 카테고리 포함) · 캠페인명 · 강조 키워드
        const hay = [
          store.name,
          store.area,
          store.address ?? "",
          store.category,
          c.productCategory ?? "",
          c.title,
          ...(c.highlightKeywords ?? []),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(ql)) return null;
        const isDelivery = c.kind === "delivery";
        return {
          storeId: store.id,
          campaignId: c.id,
          name: store.name,
          category: isDelivery ? (c.productCategory ?? store.category) : store.category,
          region: isDelivery ? "전국 택배" : regionFromAddress(store.address, store.area),
          requiredChannels: c.requiredChannels,
          benefit: isDelivery
            ? c.pointReward
              ? `제품 제공 + ${sbNum(SBUI.point, `${c.pointReward.toLocaleString()}P`)}`
              : "제품 제공"
            : `최대 ${SBUI.support} 지원`,
          isDelivery,
          remain: campaignRemain(c),
          soldOut: campaignExposure(c, db.passes, now) === "issued_out",
          planRank: ownerPlanRank.get(store.ownerId) ?? 0,
          createdAt: c.createdAt,
        } as SearchResult;
      })
      .filter((r): r is SearchResult => r !== null)
      .sort(compareRecommended);
  }

  return (
    <div className="fixed inset-0 z-40 mx-auto max-w-[480px] bg-canvas flex flex-col">
      <SearchBox initialQ={query} />

      {/* 검색 결과 — 실행 후 같은 페이지 하단에 카드형 리스트 (§5-2, 1열 · 탐색 리스트와 통일) */}
      <div className="flex-1 overflow-y-auto pb-10">
        {query && (
          <div className="px-5 pt-4">
            <div className="text-[15px] font-bold text-ink">
              &ldquo;{query}&rdquo; 검색 결과 {results.length}개
            </div>
            <div className="mt-3 space-y-4">
              {results.map((r) => (
                <Link
                  key={r.campaignId}
                  href={`/r/store/${r.storeId}?campaign=${r.campaignId}`}
                  className="cp-action flex gap-3"
                >
                  <div className="relative w-[96px] h-[96px] shrink-0 rounded-md overflow-hidden bg-sunken">
                    <Image src={photoForStore(r.storeId, r.category)} alt={r.name} fill sizes="96px" className="object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {r.isDelivery && (
                          <span className="shrink-0 inline-flex items-center rounded-xs bg-brandSoft text-brand px-1.5 py-0.5 text-[11px] font-semibold">
                            📦 배송
                          </span>
                        )}
                        <ChannelIcons channels={r.requiredChannels} size={12} />
                      </div>
                      {r.soldOut ? (
                        <div className="shrink-0 text-[12px] font-semibold text-mutedSoft">발급 마감</div>
                      ) : (
                        <div className="shrink-0 text-[12px] font-semibold text-ink2 flex items-center gap-1">
                          <span aria-hidden>🎫</span>
                          <span className="tabular-nums">{sbNum(SBUI.remain, `${r.remain}개`)}</span> 남음
                        </div>
                      )}
                    </div>
                    <div className="mt-1 text-[15px] font-semibold text-ink leading-[1.4] line-clamp-2">{r.name}</div>
                    {/* 지역 1차·2차 — 동일·유사 상호를 지역으로 구분 (§6-2) */}
                    <div className="mt-0.5 text-[13px] text-muted truncate">
                      {r.category}
                      {r.region && <> · {sbNum(SBUI.area, r.region)}</>}
                    </div>
                    <div className="mt-1 text-[16px] font-bold text-ink tabular-nums">{r.benefit}</div>
                  </div>
                </Link>
              ))}
              {results.length === 0 && (
                <div className="py-14 text-center text-[14px] text-muted">
                  &ldquo;{query}&rdquo;에 일치하는 체험이 없어요 — 다른 검색어로 찾아볼까요?
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
