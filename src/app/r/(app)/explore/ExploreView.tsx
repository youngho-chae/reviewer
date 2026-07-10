"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import NaverMapView, { MapStorePin } from "@/components/NaverMapView";
import MockMapView from "@/components/MockMapView";
import Icon from "@/components/Icon";
import ChannelIcons from "@/components/ChannelIcons";
import { photoForStore } from "@/lib/store-photo";
import { SBUI, sbNum } from "@/lib/storyboard";
import { mockDistanceM, formatDistance } from "@/lib/distance-mock";
import { CHANNEL_ORDER, CHANNEL_LABEL } from "@/lib/channels";
import { SnsKind } from "@/lib/types";

export interface ExploreStoreCard extends MapStorePin {
  rating: number;
  reviewCount: number;
  totalQuota: number;
  endAt: number;
  createdAt: number;
  requiredChannels: SnsKind[];
  soldOut: boolean; // 발급 소진(살아있는 체험권만 남음) — 노출 유지 + 발급 마감 표시
  // 검색 확장(확정 정책 2-1) — 지역명(주소)·강조 키워드까지 검색 대상에 포함
  address?: string;
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
  mapClientId: string;
  unread: number;
  initialMode: "list" | "map";
  initialCategory: string;
  initialSort: SortKey;
  initialSearch?: string;
  // [MVP] 기자단 제외 — false면 세그먼트·리스트를 렌더하지 않는다 (src/lib/flags.ts)
  pressEnabled?: boolean;
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
  mapClientId,
  unread,
  initialMode,
  initialCategory,
  initialSort,
  initialSearch = "",
  pressEnabled = false,
}: Props) {
  const [mode, setMode] = useState<"list" | "map">(initialMode);
  const [tab, setTab] = useState<"visit" | "press">("visit");
  // [통합 필터] 카테고리·SNS 채널 모두 다중 선택. 빈 Set = 전체.
  const [cats, setCats] = useState<Set<string>>(
    () => new Set(initialCategory && initialCategory !== "전체" ? [initialCategory] : []),
  );
  const [channels, setChannels] = useState<Set<SnsKind>>(() => new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [search, setSearch] = useState(initialSearch);
  const [searchOpen, setSearchOpen] = useState(!!initialSearch);
  const [mapSelected, setMapSelected] = useState(false);

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

  const filterActive = cats.size > 0 || channels.size > 0;

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
          return mockDistanceM(a.storeId) - mockDistanceM(b.storeId);
        case "new":
          return b.createdAt - a.createdAt;
        case "topSupport":
          return b.supportAmount - a.supportAmount;
        case "closing":
          return a.endAt - b.endAt;
        case "recommended":
        default:
          // 내 등급 기준 받을 수 있는 혜택(지원금) 큰 순
          return b.supportAmount - a.supportAmount;
      }
    });
    return list;
  }, [cards, matchCat, channels, search, sort]);

  const filteredPress = useMemo(() => {
    return pressCards.filter((p) => {
      if (!matchCat(p.category)) return false;
      return matchesSearch(`${p.storeName} ${p.area} ${p.category}`, search);
    });
  }, [pressCards, matchCat, search]);

  const resultCount = tab === "visit" ? filtered.length : filteredPress.length;

  function toggleCat(key: string) {
    setCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function toggleChannel(ch: SnsKind) {
    setChannels((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  }
  function resetFilters() {
    setCats(new Set());
    setChannels(new Set());
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
            onClick={() => setCats(new Set())}
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
        {filterActive && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand" />}
      </button>
    </div>
  );

  const countSortRow = (
    <div className="px-5 mt-3 flex items-center justify-between">
      <div className="text-[16px] font-bold text-ink">근처 체험 {resultCount}개 발견!</div>
      <label className="inline-flex items-center text-[13px] text-ink2">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="bg-transparent focus:outline-none appearance-none pr-1"
          aria-label="정렬방식"
        >
          <option value="recommended">정렬방식</option>
          <option value="distance">{SORT_LABEL.distance}</option>
          <option value="new">{SORT_LABEL.new}</option>
          <option value="topSupport">{SORT_LABEL.topSupport}</option>
          <option value="closing">{SORT_LABEL.closing}</option>
        </select>
        <Icon name="chevron-down" variant="border" size={14} className="text-muted" />
      </label>
    </div>
  );

  const visitList = (
    <div className="px-5 mt-4 space-y-4 pb-32">
      {filtered.map((p) => (
        <ExperienceRow key={p.storeId} card={p} />
      ))}
      {filtered.length === 0 && (
        <div className="py-16 text-center text-muted text-[14px]">
          {search ? `"${search}" 검색 결과가 없어요 — 다른 동네 찾아볼까요?` : "지금은 동네가 잠깐 쉬는 중"}
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

  return (
    <>
      {mode === "list" ? (
        <div>
          {header}
          <div className="mt-1">{chipRow}</div>
          {countSortRow}
          {tab === "visit" ? visitList : pressList}
        </div>
      ) : (
        // ── 지도 모드 (기본, 2026-07-07 회의) — 풀맵 + 바텀시트(리스트) / 핀 선택 시 스와이프 카드 캐러셀 ──
        <div className="fixed inset-x-0 top-0 z-20 mx-auto max-w-[480px] bg-canvas" style={{ bottom: "var(--bottom-nav-h, 72px)" }}>
          {mapClientId ? (
            <NaverMapView pins={filtered} clientId={mapClientId} fullscreen onSelectionChange={setMapSelected} />
          ) : (
            // 지도 키 미주입 시 임시(데모) 지도 — 지도뷰 UI·인터랙션을 키 없이 완결 제공 (2026-07-08)
            <MockMapView pins={filtered} onSelectionChange={setMapSelected} />
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

      {/* map-fab — 검정 pill 토글 */}
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

      {/* ─────────────────────────────────────────────────────────
        * 통합 필터 바텀시트 (2026-07-07 회의)
        *  - SNS 채널·카테고리 모두 다중 선택
        *  - '적용' 버튼 없이 선택 즉시 백그라운드 실시간 반영
        *  - 초기화는 작은 아이콘으로 가볍게 제공
        * ────────────────────────────────────────────────────────*/}
      {filterOpen && (
        <div className="fixed inset-0 bg-ink/45 z-50 flex items-end" onClick={() => setFilterOpen(false)}>
          <div
            className="bg-canvas w-full max-w-[480px] mx-auto rounded-t-xl px-5 pt-3 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pb-2">
              <span className="w-9 h-1 rounded-pill bg-borderStrong" />
            </div>
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-ink tracking-title">필터</h2>
              <div className="flex items-center gap-1">
                {filterActive && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="cp-action inline-flex items-center gap-1 h-8 px-2 rounded-md text-[12px] text-muted"
                    aria-label="필터 초기화"
                  >
                    <span aria-hidden>↺</span> 초기화
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFilterOpen(false)}
                  className="cp-action w-8 h-8 rounded-full flex items-center justify-center text-ink"
                  aria-label="닫기"
                >
                  <Icon name="x" variant="border" size={14} />
                </button>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[14px] font-semibold text-ink">SNS 채널</div>
              <div className="mt-2.5 flex gap-2 flex-wrap">
                {CHANNEL_ORDER.map((ch) => {
                  const active = channels.has(ch);
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => toggleChannel(ch)}
                      aria-pressed={active}
                      className={`h-10 px-3.5 rounded-pill text-[14px] font-medium bg-canvas whitespace-nowrap ${
                        active ? "border-[1.5px] border-ink text-ink font-semibold" : "border border-hairline text-ink2"
                      }`}
                    >
                      {CHANNEL_LABEL[ch]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6">
              <div className="text-[14px] font-semibold text-ink">카테고리</div>
              <div className="mt-2.5 flex gap-2 flex-wrap">
                {CAT_GROUPS.map((g) => {
                  const active = cats.has(g.key);
                  return (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => toggleCat(g.key)}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-pill text-[14px] font-medium bg-canvas whitespace-nowrap ${
                        active ? "border-[1.5px] border-ink text-ink font-semibold" : "border border-hairline text-ink2"
                      }`}
                    >
                      <span aria-hidden>{g.ic}</span>
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="mt-6 text-[12px] text-muted">선택하면 바로 반영돼요 · 근처 체험 {resultCount}개</p>
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
 * experience-row (DESIGN.md v2)
 *   좌 96px 정사각 썸네일 · SNS 배지 · 가게명 · 카테고리·거리 · 최대 ₩N 지원
 *   우상단 🎫 N 남음(발급 소진 시 '발급 마감'). [P1] 등급 게이트 없음.
 * ─────────────────────────────────────────────────────────────*/
function ExperienceRow({ card }: { card: ExploreStoreCard }) {
  const distanceM = mockDistanceM(card.storeId);
  return (
    <Link href={`/r/store/${card.storeId}?campaign=${card.campaignId}`} className="cp-action flex gap-3">
      <div className="relative w-[96px] h-[96px] shrink-0 rounded-md overflow-hidden bg-sunken">
        <Image src={photoForStore(card.storeId, card.category)} alt={card.name} fill sizes="96px" className="object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <ChannelIcons channels={card.requiredChannels} size={12} />
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
          {card.category} · {sbNum(SBUI.distance, formatDistance(distanceM))}
        </div>
        <div className="mt-1 text-[16px] font-bold text-ink tabular-nums">최대 {SBUI.support} 지원</div>
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
