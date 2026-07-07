"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import NaverMapView, { MapStorePin } from "@/components/NaverMapView";
import Icon from "@/components/Icon";
import ChannelIcons from "@/components/ChannelIcons";
import { photoForStore } from "@/lib/store-photo";
import { SBUI, sbNum } from "@/lib/storyboard";
import { SnsKind } from "@/lib/types";

export interface ExploreStoreCard extends MapStorePin {
  rating: number;
  reviewCount: number;
  totalQuota: number;
  endAt: number;
  createdAt: number;
  requiredChannels: SnsKind[];
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
}

const DAY = 86400000;

function matchesSearch(text: string, q: string) {
  if (!q.trim()) return true;
  return text.toLowerCase().includes(q.trim().toLowerCase());
}

// 카테고리 그룹 6종 — 아이콘 + 라벨 pill (디자인 시스템 v2 category-chip)
const CAT_GROUPS = [
  { key: "전체", label: "전체", ic: "⭐", match: (_c: string) => true },
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

// 결정론적 도보 시간 mock (storeId 해시 기반, 3~12분)
function walkMinutes(storeId: string): number {
  let h = 0;
  for (let i = 0; i < storeId.length; i++) h = (h * 31 + storeId.charCodeAt(i)) >>> 0;
  return 3 + (h % 10);
}

export default function ExploreView({
  cards,
  pressCards,
  mapClientId,
  unread,
  initialMode,
  initialCategory,
  initialSort,
}: Props) {
  const [mode, setMode] = useState<"list" | "map">(initialMode);
  const [tab, setTab] = useState<"visit" | "press">("visit");
  const [cat, setCat] = useState<string>(initialCategory);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mapSelected, setMapSelected] = useState(false);

  const matcher = CAT_GROUPS.find((g) => g.key === cat) ?? CAT_GROUPS[0];

  const filtered = useMemo(() => {
    let list = cards.filter((p) => {
      if (!matcher.match(p.category)) return false;
      return matchesSearch(`${p.name} ${p.area} ${p.category}`, search);
    });
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "distance":
          return walkMinutes(a.storeId) - walkMinutes(b.storeId);
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
  }, [cards, matcher, search, sort]);

  const filteredPress = useMemo(() => {
    return pressCards.filter((p) => {
      if (!matcher.match(p.category)) return false;
      return matchesSearch(`${p.storeName} ${p.area} ${p.category}`, search);
    });
  }, [pressCards, matcher, search]);

  const resultCount = tab === "visit" ? filtered.length : filteredPress.length;

  /* ── 공용 조각 ── */

  const header = (
    <div className="sticky top-0 z-30 bg-canvas">
      <div className="h-[52px] px-5 flex items-center justify-between">
        {/* segment-title — 방문형 / 기자단 */}
        <div className="flex items-baseline gap-3">
          <button
            onClick={() => setTab("visit")}
            className={`text-[20px] font-bold tracking-title ${tab === "visit" ? "text-ink" : "text-mutedSoft"}`}
          >
            방문형
          </button>
          <button
            onClick={() => setTab("press")}
            className={`text-[20px] font-bold tracking-title ${tab === "press" ? "text-ink" : "text-mutedSoft"}`}
          >
            기자단
          </button>
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
              placeholder="매장, 메뉴, 지역을 검색해보세요"
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

  const chipRow = (
    <div className="flex items-center gap-2 px-5">
      <div className="flex-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        <div className="flex gap-2 py-1">
          {CAT_GROUPS.map((g) => {
            const active = cat === g.key;
            return (
              <button
                key={g.key}
                onClick={() => setCat(g.key)}
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
      <button className="cp-action w-10 h-10 shrink-0 rounded-md border border-hairline flex items-center justify-center text-ink" aria-label="필터">
        <Icon name="filter" variant="border" size={18} />
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
        // ── 지도 모드 — 풀맵 + 바텀시트(리스트) / 핀 선택 시 map-bottom-card ──
        <div className="fixed inset-x-0 top-0 z-20 mx-auto max-w-[480px] bg-canvas" style={{ bottom: "var(--bottom-nav-h, 72px)" }}>
          {mapClientId ? (
            <NaverMapView pins={filtered} clientId={mapClientId} fullscreen onSelectionChange={setMapSelected} />
          ) : (
            <div className="px-5 py-16 text-center text-muted text-[14px]">
              지도를 불러올 수 없어요 · <button className="underline" onClick={() => setMode("list")}>목록으로 보기</button>
            </div>
          )}

          {/* bottom-sheet — 핀 미선택 시 리스트 시트 */}
          {!mapSelected && (
            <div className="absolute inset-x-0 bottom-0 z-30 bg-canvas rounded-t-xl shadow-sheet" style={{ maxHeight: "48%" }}>
              <div className="flex justify-center pt-2.5 pb-1">
                <span className="w-9 h-1 rounded-pill bg-borderStrong" />
              </div>
              <div className="mt-1">{chipRow}</div>
              {countSortRow}
              <div className="overflow-y-auto px-5 mt-3 pb-6 space-y-4" style={{ maxHeight: "calc(48dvh - 150px)" }}>
                {tab === "visit"
                  ? filtered.map((p) => <ExperienceRow key={`sheet-${p.storeId}`} card={p} />)
                  : filteredPress.map((p) => <PressRow key={`sheet-${p.campaignId}`} card={p} />)}
              </div>
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
                : "calc(48dvh + var(--bottom-nav-h, 72px) - 56px)"
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
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
 * experience-row (DESIGN.md v2)
 *   좌 96px 정사각 썸네일 · SNS 배지 · 가게명 · 카테고리·거리 · 최대 ₩N 지원
 *   우상단 🎫 N 남음. [P1] 등급 게이트 없음 — 금액만 내 등급 기준 개인화.
 * ─────────────────────────────────────────────────────────────*/
function ExperienceRow({ card }: { card: ExploreStoreCard }) {
  const walk = walkMinutes(card.storeId);
  return (
    <Link href={`/r/store/${card.storeId}?campaign=${card.campaignId}`} className="cp-action flex gap-3">
      <div className="relative w-[96px] h-[96px] shrink-0 rounded-md overflow-hidden bg-sunken">
        <Image src={photoForStore(card.storeId, card.category)} alt={card.name} fill sizes="96px" className="object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <ChannelIcons channels={card.requiredChannels} size={12} />
          <div className="shrink-0 text-[12px] font-semibold text-ink2 flex items-center gap-1">
            <span aria-hidden>🎫</span>
            <span className="tabular-nums">{sbNum(SBUI.remain, String(card.remain))}</span> 남음
          </div>
        </div>
        <div className="mt-1 text-[15px] font-semibold text-ink leading-[1.4] line-clamp-2">{card.name}</div>
        <div className="mt-0.5 text-[13px] text-muted">
          {card.category} · {sbNum(SBUI.distance, `도보 ${walk}분`)}
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
