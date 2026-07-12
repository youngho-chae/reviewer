"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import NaverMapView, { MapStorePin } from "@/components/NaverMapView";
import MockMapView from "@/components/MockMapView";
import Icon from "@/components/Icon";
import ChannelIcons from "@/components/ChannelIcons";
import { photoForStore } from "@/lib/store-photo";
import { SBUI, sbNum } from "@/lib/storyboard";
import { mockDistanceM, formatDistance } from "@/lib/distance-mock";
import { compareRecommended } from "@/lib/recommend";
import { regionCenter, haversineM, type LatLng } from "@/lib/geo";
import { SnsKind } from "@/lib/types";
import FilterSheet from "./FilterSheet";

export interface ExploreStoreCard extends MapStorePin {
  rating: number;
  reviewCount: number;
  totalQuota: number;
  endAt: number;
  createdAt: number;
  requiredChannels: SnsKind[];
  soldOut: boolean; // 발급 소진(살아있는 체험권만 남음) — 노출 유지 + 발급 마감 표시
  planRank: number; // 사장님 멤버십 랭크 (추천순 — Premium 3 > Standard 2 > Basic 1 > Free 0)
  participating?: boolean; // 내가 진행 중인 패스를 보유한 캠페인 — 제외하지 않고 "참여 중" 표시
  // 검색 확장(확정 정책 2-1) — 지역명(주소)·강조 키워드까지 검색 대상에 포함
  address?: string;
  keywords?: string[];
}

// 배송형 카드 (2026-07-12 레뷰 벤치마크) — 지역 무관 전국 참여라 지도·거리 개념이 없다.
// 리스트 전용 세그먼트로 노출 (지도 모드는 방문형 전용 유지).
export interface ExploreDeliveryCard {
  campaignId: string;
  storeId: string;
  storeName: string;
  area: string;
  category: string;
  coverEmoji: string;
  productValue: number; // 제공 상품 정가 (supportAmount)
  pointReward: number; // 기준 포인트 (0 = 제품만)
  requiredChannels: SnsKind[];
  remain: number;
  soldOut: boolean;
  endAt: number;
  createdAt: number;
  planRank: number;
  participating?: boolean;
  keywords?: string[];
}

export interface ExplorePressCard {
  campaignId: string;
  storeId: string;
  storeName: string;
  area: string;
  category: string;
  coverEmoji: string;
  payout: number;
  slotsLeft: number;
  slotsTotal: number;
  kitPhotos: number;
  daysLeft: number;
  endAt: number;
  createdAt: number;
}

type SortKey = "recommended" | "distance" | "new" | "topSupport" | "closing";

interface Props {
  cards: ExploreStoreCard[];
  pressCards: ExplorePressCard[];
  deliveryCards?: ExploreDeliveryCard[];
  mapClientId: string;
  unread: number;
  initialMode: "list" | "map";
  initialCategory: string; // 콤마 구분 다중 (?cat=)
  initialSort: SortKey;
  initialSearch?: string;
  initialChannels?: SnsKind[]; // ?ch= 복원 (필터 재진입 유지)
  // [§5 지역 연동] 홈에서 선택한 지역 — 지도 초기 포커스(3km)·리스트 거리 기준점.
  // 탐색 내 지역 변경(필터 시트)은 탐색 한정 — 홈의 선택 지역에는 영향을 주지 않는다.
  initialArea?: string | null;
  // [지역 필터 3상태] ?loc=me — 현위치 필터 선택 상태 복원 (미선택·지역 선택 시 미기재)
  initialLoc?: string | null;
  // [§6-4] 전국 진입(scope=all — 홈 '전체 리스트' 더 둘러보기): 지도를 대한민국 전체 축소로 시작
  initialNationwide?: boolean;
  // [MVP] 기자단 제외 — false면 세그먼트·리스트를 렌더하지 않는다 (src/lib/flags.ts)
  pressEnabled?: boolean;
  // 배송형 (2026-07-12 레뷰 벤치마크) — 리스트 전용 세그먼트 (flags.ts DELIVERY_ENABLED)
  deliveryEnabled?: boolean;
  // ?tab= 진입 세그먼트 복원 (예: 포인트 화면 → 배송 체험 둘러보기)
  initialTab?: "visit" | "press" | "delivery";
}

function matchesSearch(text: string, q: string) {
  if (!q.trim()) return true;
  return text.toLowerCase().includes(q.trim().toLowerCase());
}

// 카테고리 그룹 — 아이콘 + 라벨 pill (디자인 시스템 v2 category-chip)
// [통합 필터] 카테고리는 다중 선택 — 상단 칩과 필터 바텀시트가 같은 상태를 공유 (2026-07-07 회의)
const CAT_GROUPS = [
  { key: "카페", label: "카페", ic: "☕", match: (c: string) => c === "카페" || c === "디저트" },
  { key: "맛집", label: "식당", ic: "🍽️", match: (c: string) => ["양식", "한식", "일식", "분식", "주점"].includes(c) },
  { key: "뷰티", label: "뷰티", ic: "✂️", match: (c: string) => ["미용실", "네일아트", "피부과"].includes(c) },
  { key: "문화", label: "문화", ic: "🏥", match: (c: string) => ["치과", "한의원"].includes(c) },
  { key: "액티비티", label: "헬스", ic: "💪", match: (c: string) => ["PT", "필라테스", "마사지", "애견미용", "동물병원"].includes(c) },
];

const SORT_LABEL: Record<SortKey, string> = {
  recommended: "추천순",
  distance: "가까운 순",
  new: "방금 등록",
  topSupport: "많이 받는 순",
  closing: "곧 마감",
};

export default function ExploreView({
  cards,
  pressCards,
  deliveryCards = [],
  mapClientId,
  unread,
  initialMode,
  initialCategory,
  initialSort,
  initialSearch = "",
  initialChannels = [],
  initialArea = null,
  initialLoc = null,
  initialNationwide = false,
  pressEnabled = false,
  deliveryEnabled = false,
  initialTab = "visit",
}: Props) {
  const router = useRouter();
  // 배송 세그먼트는 리스트 전용 — 배송 탭 진입 시 목록 보기로 시작 (지도는 방문형 전용)
  const [mode, setMode] = useState<"list" | "map">(initialTab === "delivery" ? "list" : initialMode);
  const [tab, setTab] = useState<"visit" | "press" | "delivery">(
    (initialTab === "press" && pressEnabled) || (initialTab === "delivery" && deliveryEnabled) ? initialTab : "visit",
  );
  // [통합 필터] 카테고리·SNS 채널 모두 다중 선택. 빈 Set = 전체. (?cat= 콤마 다중 복원)
  const [cats, setCats] = useState<Set<string>>(
    () =>
      new Set(
        initialCategory && initialCategory !== "전체"
          ? initialCategory.split(",").filter((k) => CAT_GROUPS.some((g) => g.key === k))
          : [],
      ),
  );
  const [channels, setChannels] = useState<Set<SnsKind>>(() => new Set(initialChannels));
  // [§8 지역 필터 — 3상태 (2026-07-10)] 미선택(기본) / 현위치(useCurrent) / 지역(area).
  // 탐색 한정 상태 — 필터 시트에서 변경, 홈 area와 독립. area와 useCurrent는 상호 배타.
  const [area, setArea] = useState<string | null>(initialArea);
  // 현위치 필터 — 프로토타입에서는 mock 현위치 거리 기준(미선택과 표기 동일)이며,
  // 실서비스에서 GPS 좌표가 거리·지도 기준점으로 들어갈 자리. 미선택과 달리 필터 뱃지에 계상.
  const [useCurrent, setUseCurrent] = useState<boolean>(initialArea ? false : initialLoc === "me");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [search, setSearch] = useState(initialSearch);
  const [searchOpen, setSearchOpen] = useState(!!initialSearch);
  const [mapSelected, setMapSelected] = useState(false);

  // 지역 기준점 — 있으면 거리 정렬·표기의 기준이 되고 지도 초기 포커스(반경 3km)로 전달
  const areaCenter = useMemo<LatLng | null>(() => (area ? regionCenter(area) : null), [area]);
  // 거리 계산 — 지역 기준점(하버사인) 우선, 없으면 현위치 mock (§7-3 가까운순 기준점)
  const distanceOf = useMemo(
    () =>
      (p: ExploreStoreCard) =>
        areaCenter ? haversineM(areaCenter, { lat: p.lat, lng: p.lng }) : mockDistanceM(p.storeId),
    [areaCenter],
  );

  // 필터 적용값을 URL에 반영 — 새로고침·뒤로가기에도 유지 (§8-4). 홈 area와는 독립.
  // scope=all은 진입 시점 파라미터라 보존하지 않는다(필터 적용 후에는 현재 상태가 진실원천).
  function syncUrl(next: { cats: Set<string>; channels: Set<SnsKind>; area: string | null; useCurrent: boolean }) {
    const params = new URLSearchParams();
    if (mode === "list") params.set("mode", "list");
    if (sort !== "recommended") params.set("sort", sort);
    if (search) params.set("q", search);
    if (next.cats.size > 0) params.set("cat", [...next.cats].join(","));
    if (next.channels.size > 0) params.set("ch", [...next.channels].join(","));
    if (next.area) params.set("area", next.area);
    else if (next.useCurrent) params.set("loc", "me");
    const qs = params.toString();
    router.replace(`/r/explore${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  // 지도 바텀시트(피크) 드래그 — 위로 40px 이상 쓸어올리면 목록 보기로 자동 전환 (2026-07-08).
  // move/up은 window에서 추적한다 — 손가락이 시트 밖(지도 위)으로 나가도 제스처가 이어지고,
  // 칩 탭·가로 스크롤은 pointer capture를 쓰지 않아 그대로 동작한다.
  const sheetDragCleanup = useRef<(() => void) | null>(null);
  function onSheetPointerDown(e: React.PointerEvent) {
    sheetDragCleanup.current?.();
    const startY = e.clientY;
    const onMove = (ev: PointerEvent) => {
      if (startY - ev.clientY > 40) {
        cleanup();
        setMode("list");
      }
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      sheetDragCleanup.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
    sheetDragCleanup.current = cleanup;
  }

  // 적용 중 필터 개수 — 필터 아이콘 뱃지에 표기 (§8-4). 지역 미선택(기본)은 미계상.
  const filterCount = cats.size + channels.size + (area ? 1 : 0) + (useCurrent ? 1 : 0);
  const filterActive = filterCount > 0;

  const matchCat = useMemo(() => {
    if (cats.size === 0) return (_c: string) => true;
    const groups = CAT_GROUPS.filter((g) => cats.has(g.key));
    return (c: string) => groups.some((g) => g.match(c));
  }, [cats]);

  const filtered = useMemo(() => {
    let list = cards.filter((p) => {
      if (!matchCat(p.category)) return false;
      // 채널 필터 — 선택한 채널 중 하나라도 참여 가능하면 노출
      if (channels.size > 0 && !p.requiredChannels.some((ch) => channels.has(ch))) return false;
      // 검색 — 지역(동네·주소)·매장·키워드(카테고리·강조 키워드) 전체 대응 (확정 정책 2-1)
      return matchesSearch(
        `${p.name} ${p.area} ${p.address ?? ""} ${p.category} ${(p.keywords ?? []).join(" ")}`,
        search,
      );
    });
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "distance":
          return distanceOf(a) - distanceOf(b);
        case "new":
          return b.createdAt - a.createdAt;
        case "topSupport":
          return b.supportAmount - a.supportAmount;
        case "closing":
          return a.endAt - b.endAt;
        case "recommended":
        default:
          // [§4] 사장님 멤버십 플랜 랭크 → 캠페인 최신순 (issued_out은 최후순위) — src/lib/recommend.ts
          return compareRecommended(a, b);
      }
    });
    return list;
  }, [cards, matchCat, channels, search, sort, distanceOf]);

  const filteredPress = useMemo(() => {
    return pressCards.filter((p) => {
      if (!matchCat(p.category)) return false;
      return matchesSearch(`${p.storeName} ${p.area} ${p.category}`, search);
    });
  }, [pressCards, matchCat, search]);

  // 배송형 — 지역 무관(전국)이라 지역·현위치 필터는 적용하지 않는다. 채널·카테고리·검색만.
  const filteredDelivery = useMemo(() => {
    return deliveryCards
      .filter((p) => {
        if (!matchCat(p.category)) return false;
        if (channels.size > 0 && !p.requiredChannels.some((ch) => channels.has(ch))) return false;
        return matchesSearch(`${p.storeName} ${p.area} ${p.category} ${(p.keywords ?? []).join(" ")}`, search);
      })
      .sort(compareRecommended);
  }, [deliveryCards, matchCat, channels, search]);

  const resultCount = tab === "visit" ? filtered.length : tab === "delivery" ? filteredDelivery.length : filteredPress.length;

  // 상단 카테고리 칩은 즉시 반영 유지 — 필터 시트는 draft 후 [적용하기] (2026-07-10 §8)
  function toggleCat(key: string) {
    setCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      syncUrl({ cats: next, channels, area, useCurrent });
      return next;
    });
  }
  // 필터 시트 [적용하기] 커밋 — draft 상태를 한 번에 반영 + URL 유지
  function applyFilters(next: { cats: Set<string>; channels: Set<SnsKind>; area: string | null; useCurrent: boolean }) {
    setCats(next.cats);
    setChannels(next.channels);
    setArea(next.area);
    setUseCurrent(next.area ? false : next.useCurrent);
    setFilterOpen(false);
    syncUrl(next);
  }

  /* ── 공용 조각 ── */

  const header = (
    <div className="sticky top-0 z-30 bg-canvas">
      <div className="h-[52px] px-5 flex items-center justify-between">
        {/* segment-title — 방문형 (/ 기자단은 MVP 제외 · pressEnabled 시에만) */}
        <div className="flex items-baseline gap-3">
          <button
            onClick={() => setTab("visit")}
            className={`text-[20px] font-bold tracking-title ${tab === "visit" ? "text-ink" : "text-mutedSoft"}`}
          >
            방문형
          </button>
          {/* 배송형 (2026-07-12 레뷰 벤치마크) — 리스트 전용 세그먼트 */}
          {deliveryEnabled && (
            <button
              onClick={() => setTab("delivery")}
              className={`text-[20px] font-bold tracking-title ${tab === "delivery" ? "text-ink" : "text-mutedSoft"}`}
            >
              배송형
            </button>
          )}
          {pressEnabled && (
            <button
              onClick={() => setTab("press")}
              className={`text-[20px] font-bold tracking-title ${tab === "press" ? "text-ink" : "text-mutedSoft"}`}
            >
              기자단
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink"
            aria-label="검색"
            aria-expanded={searchOpen}
          >
            <Icon name="search" variant={search ? "bold" : "border"} size={22} />
          </button>
          <Link href="/r/notifications" className="cp-action relative w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="알림">
            <Icon name="bell" variant={unread > 0 ? "bold" : "border"} size={22} />
            {unread > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand" />}
          </Link>
        </div>
      </div>
      {searchOpen && (
        <div className="px-5 pb-3">
          <div className="relative">
            <Icon name="search" variant="border" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="지역, 매장, 키워드를 검색해보세요"
              className="w-full h-11 pl-11 pr-9 rounded-md bg-sunken text-[15px] focus:outline-none focus:ring-1 focus:ring-brand"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="검색어 지우기"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-borderStrong/50 flex items-center justify-center text-white"
              >
                <Icon name="x" variant="bold" size={10} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // 상단 칩 — 카테고리 다중 선택 (전체 = 선택 없음). 선택한 SNS 채널값은 상단에 노출하지 않는다 (회의 결정)
  const chipRow = (
    <div className="flex items-center gap-2 px-5">
      <div className="flex-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        <div className="flex gap-2 py-1">
          <button
            onClick={() => {
              const next = new Set<string>();
              setCats(next);
              syncUrl({ cats: next, channels, area, useCurrent });
            }}
            className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-pill text-[14px] font-medium whitespace-nowrap bg-canvas ${
              cats.size === 0 ? "border-[1.5px] border-ink text-ink font-semibold" : "border border-hairline text-ink2"
            }`}
            aria-pressed={cats.size === 0}
          >
            <span aria-hidden>⭐</span>
            전체
          </button>
          {CAT_GROUPS.map((g) => {
            const active = cats.has(g.key);
            return (
              <button
                key={g.key}
                onClick={() => toggleCat(g.key)}
                className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-pill text-[14px] font-medium whitespace-nowrap bg-canvas ${
                  active ? "border-[1.5px] border-ink text-ink font-semibold" : "border border-hairline text-ink2"
                }`}
                aria-pressed={active}
              >
                <span aria-hidden>{g.ic}</span>
                {g.label}
              </button>
            );
          })}
        </div>
      </div>
      <button
        onClick={() => setFilterOpen(true)}
        className="cp-action relative w-10 h-10 shrink-0 rounded-md border border-hairline flex items-center justify-center text-ink"
        aria-label="통합 필터 열기"
      >
        <Icon name="filter" variant={filterActive ? "bold" : "border"} size={18} />
        {/* 적용 중 필터 개수 뱃지 (§8-4) */}
        {filterActive && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-pill bg-brand text-white text-[10px] font-bold grid place-items-center tabular-nums">
            {filterCount}
          </span>
        )}
      </button>
    </div>
  );

  const countSortRow = (
    <div className="px-5 mt-3 flex items-center justify-between">
      <div className="text-[16px] font-bold text-ink">
        {tab === "delivery" ? `집으로 받는 체험 ${resultCount}개!` : `근처 체험 ${resultCount}개 발견!`}
      </div>
      <label className="inline-flex items-center text-[13px] text-ink2">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="bg-transparent focus:outline-none appearance-none pr-1"
          aria-label="정렬방식"
        >
          {/* 기본 정렬 = 추천순 (사장님 멤버십 랭크 → 최신순) — placeholder 표기 제거 (§4-1) */}
          <option value="recommended">{SORT_LABEL.recommended}</option>
          <option value="distance">{SORT_LABEL.distance}</option>
          <option value="new">{SORT_LABEL.new}</option>
          <option value="topSupport">{SORT_LABEL.topSupport}</option>
          <option value="closing">{SORT_LABEL.closing}</option>
        </select>
        <Icon name="chevron-down" variant="border" size={14} className="text-muted" />
      </label>
    </div>
  );

  // 검색 0건 대체 추천 — 추천순 상위 4개 (§7-4)
  const fallbackRecommended = useMemo(
    () => [...cards].sort(compareRecommended).slice(0, 4),
    [cards],
  );

  const visitList = (
    <div className="px-5 mt-4 space-y-4 pb-32">
      {filtered.map((p) => (
        <ExperienceRow key={p.campaignId} card={p} distanceM={distanceOf(p)} />
      ))}
      {filtered.length === 0 && (
        <div className="py-10">
          <div className="text-center text-muted text-[14px]">
            {search ? `"${search}" 검색 결과가 없어요 — 다른 동네 찾아볼까요?` : "지금은 동네가 잠깐 쉬는 중"}
          </div>
          {search && fallbackRecommended.length > 0 && (
            <div className="mt-10">
              <h3 className="text-[16px] font-bold text-ink tracking-title">이런 체험은 어때요?</h3>
              <div className="mt-4 space-y-4">
                {fallbackRecommended.map((p) => (
                  <ExperienceRow key={p.campaignId} card={p} distanceM={distanceOf(p)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const pressList = (
    <div className="px-5 mt-4 space-y-4 pb-32">
      {filteredPress.map((p) => (
        <PressRow key={p.campaignId} card={p} />
      ))}
      {filteredPress.length === 0 && (
        <div className="py-16 text-center text-muted text-[14px]">
          {search ? `"${search}"에 일치하는 기자단이 없어요` : "모집 중인 기자단이 없어요"}
        </div>
      )}
    </div>
  );

  const deliveryList = (
    <div className="px-5 mt-4 space-y-4 pb-32">
      {filteredDelivery.map((p) => (
        <DeliveryRow key={p.campaignId} card={p} />
      ))}
      {filteredDelivery.length === 0 && (
        <div className="py-16 text-center text-muted text-[14px]">
          {search ? `"${search}"에 일치하는 배송 체험이 없어요` : "모집 중인 배송 체험이 없어요"}
        </div>
      )}
    </div>
  );

  return (
    <>
      {mode === "list" ? (
        <div>
          {header}
          <div className="mt-1">{chipRow}</div>
          {countSortRow}
          {tab === "visit" ? visitList : tab === "delivery" ? deliveryList : pressList}
        </div>
      ) : (
        // ── 지도 모드 (기본, 2026-07-07 회의) — 풀맵 + 바텀시트(리스트) / 핀 선택 시 스와이프 카드 캐러셀 ──
        <div className="fixed inset-x-0 top-0 z-20 mx-auto max-w-[480px] bg-canvas" style={{ bottom: "var(--bottom-nav-h, 72px)" }}>
          {mapClientId ? (
            <NaverMapView
              pins={filtered}
              clientId={mapClientId}
              fullscreen
              onSelectionChange={setMapSelected}
              // [§5] 홈 선택 지역(또는 필터 지역)의 행정 기준점 — 초기 포커스 + 반경 3km 필터
              initialSearchCenter={areaCenter}
              // [§6-4] 전국 진입 — 대한민국 전체 축소 시작(시도 클러스터). 반경 3km 필터는
              // 지도 전용 탐색 도구이며 리스트는 항상 필터 시트(지역·채널·카테고리) 기준 (확정).
              nationwide={initialNationwide}
            />
          ) : (
            // 지도 키 미주입 시 임시(데모) 지도 — 지도뷰 UI·인터랙션을 키 없이 완결 제공 (2026-07-08)
            <MockMapView
              pins={filtered}
              onSelectionChange={setMapSelected}
              initialSearchCenter={areaCenter}
              nationwide={initialNationwide}
            />
          )}

          {/* bottom-sheet(피크) — 핀 미선택 시. 디폴트는 카테고리 탭+필터 아이콘 영역까지만 노출,
              위로 쓸어올리면 목록 보기로 자동 전환 (2026-07-08) */}
          {!mapSelected && (
            <div
              className="absolute inset-x-0 bottom-0 z-30 bg-canvas rounded-t-xl shadow-sheet"
              style={{ touchAction: "pan-x" }}
              onPointerDown={onSheetPointerDown}
            >
              <button
                type="button"
                onClick={() => setMode("list")}
                className="w-full flex flex-col items-center pt-2.5 pb-1"
                aria-label="위로 올려 목록 보기"
              >
                <span className="w-9 h-1 rounded-pill bg-borderStrong" />
              </button>
              <div className="mt-1 pb-4">{chipRow}</div>
            </div>
          )}
        </div>
      )}

      {/* map-fab — 검정 pill 토글 (배송 세그먼트는 리스트 전용이라 숨김) */}
      {tab !== "delivery" && (
      <button
        type="button"
        onClick={() => {
          if (mode === "map") setMapSelected(false);
          setMode((m) => (m === "list" ? "map" : "list"));
        }}
        className="cp-action fixed left-1/2 -translate-x-1/2 z-40 bg-tile1 text-white text-[14px] font-semibold px-5 h-11 rounded-pill flex items-center gap-2 shadow-fab transition-[bottom] duration-200 ease-out"
        style={{
          bottom:
            mode === "map"
              ? mapSelected
                ? "calc(var(--bottom-nav-h, 72px) + 148px)"
                : "calc(var(--bottom-nav-h, 72px) + 108px)" // 피크 시트(핸들+칩 행) 위
              : "calc(var(--bottom-nav-h, 72px) + 16px)",
        }}
        aria-label={mode === "list" ? "지도 보기로 전환" : "목록 보기로 전환"}
      >
        {mode === "list" ? (
          <>
            <Icon name="pin" variant="bold" size={16} />
            <span>지도 보기</span>
          </>
        ) : (
          <>
            <Icon name="list" variant="bold" size={16} />
            <span>목록 보기</span>
          </>
        )}
      </button>
      )}

      {/* 통합 필터 바텀시트 — draft 후 [적용하기] 커밋 (2026-07-10 §8, FilterSheet.tsx) */}
      {filterOpen && (
        <FilterSheet
          cards={cards}
          appliedCats={cats}
          appliedChannels={channels}
          appliedArea={area}
          appliedCurrent={useCurrent}
          catGroups={CAT_GROUPS}
          onClose={() => setFilterOpen(false)}
          onApply={applyFilters}
        />
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
 * experience-row (DESIGN.md v2)
 *   좌 96px 정사각 썸네일 · SNS 배지 · 가게명 · 카테고리·거리 · 최대 ₩N 지원
 *   우상단 🎫 N 남음(발급 소진 시 '발급 마감'). [P1] 등급 게이트 없음.
 * ─────────────────────────────────────────────────────────────*/
function ExperienceRow({ card, distanceM }: { card: ExploreStoreCard; distanceM?: number }) {
  const dist = distanceM ?? mockDistanceM(card.storeId);
  // 마감 임박 D-3 이하만 소형 표기 (§7-2)
  const daysLeft = Math.ceil((card.endAt - Date.now()) / 86400000);
  const closingSoon = daysLeft >= 0 && daysLeft <= 3;
  return (
    <Link href={`/r/store/${card.storeId}?campaign=${card.campaignId}`} className="cp-action flex gap-3">
      <div className="relative w-[96px] h-[96px] shrink-0 rounded-md overflow-hidden bg-sunken">
        <Image src={photoForStore(card.storeId, card.category)} alt={card.name} fill sizes="96px" className="object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <ChannelIcons channels={card.requiredChannels} size={12} />
            {/* [§6] 이미 신청한 캠페인 — 제외 대신 "참여 중" 표시 */}
            {card.participating && (
              <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-xs bg-brandSoft text-brand text-[11px] font-semibold">
                참여 중
              </span>
            )}
          </div>
          {card.soldOut ? (
            <div className="shrink-0 text-[12px] font-semibold text-mutedSoft">발급 마감</div>
          ) : (
            <div className="shrink-0 text-[12px] font-semibold text-ink2 flex items-center gap-1">
              <span aria-hidden>🎫</span>
              <span className="tabular-nums">{sbNum(SBUI.remain, `${card.remain}개`)}</span> 남음
            </div>
          )}
        </div>
        <div className="mt-1 text-[15px] font-semibold text-ink leading-[1.4] line-clamp-2">{card.name}</div>
        <div className="mt-0.5 text-[13px] text-muted">
          {card.category} · {sbNum(SBUI.distance, formatDistance(dist))}
          {closingSoon && (
            <span className="ml-1.5 text-error font-semibold tabular-nums">{sbNum("마감 임박 D-0", `마감 임박 D-${daysLeft}`)}</span>
          )}
        </div>
        <div className="mt-1 text-[16px] font-bold text-ink tabular-nums">최대 {SBUI.support} 지원</div>
      </div>
    </Link>
  );
}

/* 배송형 행 (2026-07-12 레뷰 벤치마크) — 동일 문법. 거리 대신 지역, 금액 = 제공 상품가 + 적립 포인트.
   포인트 표기는 기준 포인트(등급 배율 전) — 실제 적립액은 상세에서 채널 등급 기준으로 확인. */
function DeliveryRow({ card }: { card: ExploreDeliveryCard }) {
  const daysLeft = Math.ceil((card.endAt - Date.now()) / 86400000);
  const closingSoon = daysLeft >= 0 && daysLeft <= 3;
  return (
    <Link href={`/r/store/${card.storeId}?campaign=${card.campaignId}`} className="cp-action flex gap-3">
      <div className="relative w-[96px] h-[96px] shrink-0 rounded-md overflow-hidden bg-sunken">
        <Image src={photoForStore(card.storeId, card.category)} alt={card.storeName} fill sizes="96px" className="object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="shrink-0 inline-flex items-center rounded-xs bg-brandSoft text-brand px-1.5 py-0.5 text-[11px] font-semibold">
              📦 배송
            </span>
            <ChannelIcons channels={card.requiredChannels} size={12} />
            {card.participating && (
              <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-xs bg-brandSoft text-brand text-[11px] font-semibold">
                참여 중
              </span>
            )}
          </div>
          {card.soldOut ? (
            <div className="shrink-0 text-[12px] font-semibold text-mutedSoft">발급 마감</div>
          ) : (
            <div className="shrink-0 text-[12px] font-semibold text-ink2 flex items-center gap-1">
              <span aria-hidden>🎫</span>
              <span className="tabular-nums">{sbNum(SBUI.remain, `${card.remain}개`)}</span> 남음
            </div>
          )}
        </div>
        <div className="mt-1 text-[15px] font-semibold text-ink leading-[1.4] line-clamp-2">{card.storeName}</div>
        <div className="mt-0.5 text-[13px] text-muted">
          {card.category} · 전국 택배
          {closingSoon && (
            <span className="ml-1.5 text-error font-semibold tabular-nums">{sbNum("마감 임박 D-0", `마감 임박 D-${daysLeft}`)}</span>
          )}
        </div>
        <div className="mt-1 text-[16px] font-bold text-ink tabular-nums">
          제품 제공{card.pointReward > 0 && <> + {sbNum(SBUI.point, `${card.pointReward.toLocaleString()}P`)} 적립</>}
        </div>
      </div>
    </Link>
  );
}

/* 기자단 행 — 동일 문법, 금액 = 정산 예정금 */
function PressRow({ card }: { card: ExplorePressCard }) {
  return (
    <Link href={`/r/press/${card.campaignId}`} className="cp-action flex gap-3">
      <div className="relative w-[96px] h-[96px] shrink-0 rounded-md overflow-hidden bg-sunken">
        <Image src={photoForStore(card.storeId, card.category)} alt={card.storeName} fill sizes="96px" className="object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex items-center rounded-xs bg-brandSoft text-brand px-1.5 py-1 text-[12px] font-semibold">기자단</span>
          <div className="shrink-0 text-[12px] font-semibold text-ink2 flex items-center gap-1">
            <span aria-hidden>🎫</span>
            <span className="tabular-nums">{SBUI.remain}</span> 남음
          </div>
        </div>
        <div className="mt-1 text-[15px] font-semibold text-ink leading-[1.4] line-clamp-2">{card.storeName}</div>
        <div className="mt-0.5 text-[13px] text-muted">
          {card.category} · 자료팩 {SBUI.count2}
        </div>
        <div className="mt-1 text-[16px] font-bold text-ink tabular-nums">정산 {SBUI.payout}</div>
      </div>
    </Link>
  );
}
