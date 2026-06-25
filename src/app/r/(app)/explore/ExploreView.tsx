"use client";
import { useState, useMemo, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import NaverMapView, { MapStorePin } from "@/components/NaverMapView";
import Icon from "@/components/Icon";
import { photoForStore } from "@/lib/store-photo";
import { Grade } from "@/lib/types";

export interface ExploreStoreCard extends MapStorePin {
  rating: number;
  reviewCount: number;
  totalQuota: number;
  endAt: number;
  createdAt: number;
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
  minGrade: "S" | "A" | "B" | "C";
  accessible: boolean;
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
  topBar: ReactNode;
  myGrade: Grade;
  activePassCount: number;
  initialMode: "list" | "map";
  initialCategory: string;
  initialSort: SortKey;
}

const SEVEN_DAYS = 7 * 86400000;
const DAY = 86400000;

function matchesSearch(text: string, q: string) {
  if (!q.trim()) return true;
  return text.toLowerCase().includes(q.trim().toLowerCase());
}

// 카테고리 그룹 (이미지 2 기준 6개 + 전체)
const CAT_GROUPS = [
  { key: "전체", label: "전체", match: (_c: string) => true },
  { key: "카페", label: "카페", match: (c: string) => c === "카페" || c === "디저트" },
  { key: "맛집", label: "맛집", match: (c: string) => ["양식", "한식", "일식", "분식", "주점"].includes(c) },
  { key: "뷰티", label: "뷰티", match: (c: string) => ["미용실", "네일아트", "피부과"].includes(c) },
  { key: "문화", label: "문화", match: (c: string) => ["치과", "한의원"].includes(c) },
  { key: "액티비티", label: "액티비티", match: (c: string) => ["PT", "필라테스", "마사지", "애견미용", "동물병원"].includes(c) },
];

function formatRemainingDays(endAt: number): { label: string; urgent: boolean } {
  const now = Date.now();
  const diff = endAt - now;
  if (diff <= 0) return { label: "마감", urgent: true };
  if (diff < DAY) {
    return { label: "오늘 23:59 마감", urgent: true };
  }
  const date = new Date(endAt);
  const day = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return { label: `~ ${m}.${d}(${day}) 마감`, urgent: diff < 2 * DAY };
}

// 결정론적 도보 시간 mock (storeId 해시 기반, 3~12분)
function walkMinutes(storeId: string): number {
  let h = 0;
  for (let i = 0; i < storeId.length; i++) h = (h * 31 + storeId.charCodeAt(i)) >>> 0;
  return 3 + (h % 10);
}

// 카드 라벨 칩 결정 (NEW / 곧 마감 / 이번 주만)
function cardLabel(card: ExploreStoreCard): { text: string; tone: "new" | "closing" | "week" } | null {
  const now = Date.now();
  if (card.endAt - now < DAY) return { text: "곧 마감", tone: "closing" };
  if (now - card.createdAt < SEVEN_DAYS) return { text: "NEW", tone: "new" };
  if (card.endAt - now < SEVEN_DAYS) return { text: "이번 주만", tone: "week" };
  return null;
}

export default function ExploreView({
  cards,
  pressCards,
  mapClientId,
  topBar,
  myGrade,
  activePassCount,
  initialMode,
  initialCategory,
  initialSort,
}: Props) {
  const [mode, setMode] = useState<"list" | "map">(initialMode);
  const [tab, setTab] = useState<"visit" | "press">("visit");
  const [cat, setCat] = useState<string>(initialCategory);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [layout, setLayout] = useState<"row" | "grid">("row");
  const [search, setSearch] = useState("");
  const [mapSelected, setMapSelected] = useState(false);

  // 통계 (3-stat row)
  const stats = useMemo(() => {
    const now = Date.now();
    const closing = cards.filter((c) => c.endAt - now < DAY).length;
    const newer = cards.filter((c) => now - c.createdAt < SEVEN_DAYS).length;
    const avgSupport = cards.length > 0
      ? Math.round(cards.reduce((s, c) => s + c.supportAmount, 0) / cards.length)
      : 0;
    return { total: cards.length, closing, newer, avgSupport };
  }, [cards]);

  const matcher = CAT_GROUPS.find((g) => g.key === cat) ?? CAT_GROUPS[0];

  const filtered = useMemo(() => {
    let list = cards.filter((p) => {
      if (!matcher.match(p.category)) return false;
      const haystack = `${p.name} ${p.area} ${p.category}`;
      return matchesSearch(haystack, search);
    });
    // 정렬
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
          // 접근 가능한 카드 우선, 그 다음 지원금 큰 순
          return (Number(b.accessible) - Number(a.accessible)) || (b.supportAmount - a.supportAmount);
      }
    });
    return list;
  }, [cards, matcher, search, sort]);

  const filteredPress = useMemo(() => {
    return pressCards.filter((p) => {
      const haystack = `${p.storeName} ${p.area} ${p.category}`;
      return matchesSearch(haystack, search);
    });
  }, [pressCards, search]);

  return (
    <>
      {mode === "list" ? (
        <div>
          {topBar}

          {/* 헤더 — 이미지 2 상단 영역 */}
          <div className="px-6 pt-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[14px] text-muted">오늘 참여 가능한 체험</div>
                <div className="font-display text-[36px] leading-[1.05] text-ink mt-1">
                  <span className="text-brand">{stats.total}</span>
                  <span className="text-[24px] ml-1 text-ink2">개</span>
                </div>
              </div>
              <Link
                href="/r/passes"
                className="cp-action shrink-0 flex items-center gap-2 h-11 px-3 rounded-md border border-hairline bg-canvas"
              >
                <span className="w-7 h-7 rounded-md bg-brand/12 text-brand flex items-center justify-center">
                  <Icon name="ticket" variant="bold" size={14} />
                </span>
                <div className="text-left">
                  <div className="text-[11px] text-muted leading-none">내 체험권</div>
                  <div className="text-[12px] font-semibold text-ink leading-tight mt-0.5">사용 가능 {activePassCount}개</div>
                </div>
                <Icon name="chevron-right" variant="border" size={14} className="text-muted" />
              </Link>
            </div>
          </div>

          {/* 검색 + 필터 (필터는 카테고리 chip으로 대체) */}
          <div className="px-6 mt-4 flex items-center gap-2">
            <div className="relative flex-1">
              <Icon
                name="search"
                variant={search ? "bold" : "border"}
                size={16}
                className={`absolute left-4 top-1/2 -translate-y-1/2 ${search ? "text-ink" : "text-muted"}`}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="매장, 메뉴, 지역을 검색해보세요"
                className="w-full h-11 pl-11 pr-9 rounded-md bg-parchment border border-hairline text-[14px] focus:border-brand focus:bg-canvas focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="검색어 지우기"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-mutedSoft/40 flex items-center justify-center text-ink"
                >
                  <Icon name="x" variant="bold" size={10} />
                </button>
              )}
            </div>
          </div>

          {/* 3-stat row */}
          <div className="px-6 mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-md border border-hairline bg-surfaceSoft px-3 py-3">
              <div className="text-[11px] text-muted flex items-center gap-1">
                곧 마감 체험 <span aria-hidden>⏰</span>
              </div>
              <div className="text-[22px] font-semibold text-ink leading-tight mt-1">
                {stats.closing}<span className="text-[14px] text-muted ml-0.5">개</span>
              </div>
              <div className="text-[11px] text-muted mt-0.5">오늘 마감 {stats.closing}개</div>
            </div>
            <div className="rounded-md border border-hairline bg-surfaceSoft px-3 py-3">
              <div className="text-[11px] text-muted flex items-center gap-1">
                신규 체험 <span className="inline-flex items-center px-1.5 rounded-pill bg-brand/12 text-brand text-[9px] font-semibold">NEW</span>
              </div>
              <div className="text-[22px] font-semibold text-ink leading-tight mt-1">
                {stats.newer}<span className="text-[14px] text-muted ml-0.5">개</span>
              </div>
              <div className="text-[11px] text-muted mt-0.5">최근 7일 이내</div>
            </div>
            <div className="rounded-md border border-hairline bg-surfaceSoft px-3 py-3">
              <div className="text-[11px] text-muted">평균 지원금</div>
              <div className="text-[18px] font-semibold text-ink leading-tight mt-1">
                ₩{stats.avgSupport.toLocaleString()}
              </div>
              <div className="text-[11px] text-muted mt-0.5">전체 평균</div>
            </div>
          </div>

          {/* 방문형/기자단 탭 */}
          <div className="px-6 mt-5">
            <div className="inline-flex bg-parchment rounded-pill p-1 gap-1 border border-hairline">
              <button
                onClick={() => setTab("visit")}
                className={`px-4 h-9 rounded-pill text-[13px] ${tab === "visit" ? "bg-canvas text-ink" : "text-muted"}`}
              >
                방문형
              </button>
              <button
                onClick={() => setTab("press")}
                className={`px-4 h-9 rounded-pill text-[13px] ${tab === "press" ? "bg-canvas text-ink" : "text-muted"}`}
              >
                기자단
              </button>
            </div>
          </div>

          {tab === "visit" ? (
            <>
              {/* 카테고리 가로 스크롤 — 이미지 2와 동일 */}
              <div className="mt-4 border-b border-hairlineSoft">
                <div className="overflow-x-auto px-6" style={{ scrollbarWidth: "none" }}>
                  <div className="flex gap-5 pb-1.5">
                    {CAT_GROUPS.map((g) => {
                      const active = cat === g.key;
                      return (
                        <button
                          key={g.key}
                          onClick={() => setCat(g.key)}
                          className={`relative h-9 text-[14px] whitespace-nowrap ${active ? "text-ink font-semibold" : "text-muted"}`}
                        >
                          {g.label}
                          {active && <span className="absolute -bottom-1.5 left-0 right-0 h-[2px] bg-brand rounded-full" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 정렬 + 레이아웃 토글 */}
              <div className="px-6 mt-3 flex items-center justify-between">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="text-[12px] bg-transparent text-muted focus:outline-none"
                  aria-label="정렬"
                >
                  <option value="recommended">추천순 ▼</option>
                  <option value="distance">거리순 ▼</option>
                  <option value="new">신규순 ▼</option>
                  <option value="topSupport">지원금 높은순 ▼</option>
                  <option value="closing">마감임박순 ▼</option>
                </select>
                <div className="inline-flex bg-parchment rounded-pill p-1 border border-hairline">
                  <button
                    onClick={() => setLayout("row")}
                    aria-label="리스트 보기"
                    aria-pressed={layout === "row"}
                    className={`w-8 h-8 rounded-pill flex items-center justify-center ${layout === "row" ? "bg-canvas text-ink" : "text-muted"}`}
                  >
                    <Icon name="list" variant={layout === "row" ? "bold" : "border"} size={16} />
                  </button>
                  <button
                    onClick={() => setLayout("grid")}
                    aria-label="그리드 보기"
                    aria-pressed={layout === "grid"}
                    className={`w-8 h-8 rounded-pill flex items-center justify-center ${layout === "grid" ? "bg-canvas text-ink" : "text-muted"}`}
                  >
                    <Icon name="grid" variant={layout === "grid" ? "bold" : "border"} size={16} />
                  </button>
                </div>
              </div>

              {/* 매장 카드 리스트 */}
              <div className={`px-6 mt-3 pb-32 ${layout === "grid" ? "grid grid-cols-2 gap-3" : "space-y-3"}`}>
                {filtered.map((p) =>
                  layout === "grid" ? (
                    <GridCard key={p.storeId} card={p} />
                  ) : (
                    <RowCard key={p.storeId} card={p} myGrade={myGrade} />
                  ),
                )}
                {filtered.length === 0 && (
                  <div className={`py-16 text-center text-muted text-[14px] ${layout === "grid" ? "col-span-2" : ""}`}>
                    {search ? `"${search}"에 일치하는 매장이 없어요` : "현재 모집 중인 캠페인이 없어요"}
                  </div>
                )}
              </div>

              {/* 등급 혜택 배너 — 이미지 2 하단 */}
              <Link
                href="/r/rewards"
                className="cp-action mx-6 mb-32 -mt-24 flex items-center gap-3 p-4 rounded-md border border-hairline bg-parchment"
              >
                <span className="w-9 h-9 rounded-md bg-brand/12 text-brand flex items-center justify-center">
                  <Icon name="ticket" variant="bold" size={18} />
                </span>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-ink">등급 올리고 더 많은 체험 혜택 받으세요!</div>
                  <div className="text-[11px] text-muted mt-0.5">등급별 혜택과 조건 확인하기</div>
                </div>
                <Icon name="chevron-right" variant="border" size={14} className="text-muted" />
              </Link>
            </>
          ) : (
            <>
              <div className="px-6 mt-6 mb-4">
                <h2 className="font-display text-[24px] leading-[1.14] text-ink">참여 가능한 기자단</h2>
                <div className="text-[13px] text-muted mt-1">
                  {search ? `"${search}" 검색 결과 ${filteredPress.length}건` : `${filteredPress.length}건 · 자료팩 기반 재택 작성`}
                </div>
              </div>
              <div className="px-6 space-y-3 pb-32">
                {filteredPress.map((p) => (
                  <Link
                    key={p.campaignId}
                    href={p.accessible ? `/r/press/${p.campaignId}` : "/r/grade"}
                    className={`cp-action flex bg-canvas border border-hairline rounded-md overflow-hidden ${p.accessible ? "" : "opacity-50"}`}
                  >
                    <div className="relative w-[96px] h-[96px] shrink-0 bg-parchment">
                      <Image
                        src={photoForStore(p.storeId, p.category)}
                        alt={p.storeName}
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                      {!p.accessible && (
                        <div className="absolute inset-0 bg-ink/45 flex items-center justify-center text-white text-[10px] font-semibold gap-1">
                          <Icon name="lock" variant="bold" size={10} />
                          <span>등급 부족</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 p-3 min-w-0">
                      <div className="text-[11px] text-muted">기자단 · {p.category}</div>
                      <div className="text-[15px] font-semibold text-ink truncate mt-0.5">{p.storeName}</div>
                      <div className="text-[11px] text-muted mt-0.5">
                        {p.area} · 자료팩 {p.kitPhotos}장
                      </div>
                      <div className="flex items-end justify-between mt-1.5">
                        <div className="text-[12px] text-success font-semibold">
                          정산 ₩{p.payout.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-muted">잔여 {p.slotsLeft}/{p.slotsTotal}</div>
                      </div>
                    </div>
                  </Link>
                ))}
                {filteredPress.length === 0 && (
                  <div className="py-16 text-center text-muted text-[14px]">
                    {search ? `"${search}"에 일치하는 기자단이 없어요` : "모집 중인 기자단이 없어요"}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        // Map view — 기존 home과 동일한 fullscreen + floating search
        <div className="fixed inset-x-0 top-0 z-20 mx-auto max-w-[480px] bg-canvas" style={{ bottom: "var(--bottom-nav-h, 72px)" }}>
          <div className="absolute top-3 left-3 right-3 z-30">
            <div className="relative">
              <Icon
                name="search"
                variant={search ? "bold" : "border"}
                size={16}
                className={`absolute left-4 top-1/2 -translate-y-1/2 ${search ? "text-ink" : "text-muted"}`}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="동네·지역명 또는 매장명 검색"
                className="w-full h-11 pl-11 pr-10 rounded-pill bg-canvas/95 backdrop-blur border border-hairline text-[15px] focus:border-brand focus:outline-none shadow-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="검색어 지우기"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-mutedSoft/40 flex items-center justify-center text-ink"
                >
                  <Icon name="x" variant="bold" size={10} />
                </button>
              )}
            </div>
            <div className="mt-2 -mx-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              <div className="flex gap-2 px-1 pb-1">
                {CAT_GROUPS.map((g) => (
                  <button
                    key={g.key}
                    onClick={() => setCat(g.key)}
                    className={`h-8 px-3.5 rounded-pill text-[13px] font-semibold whitespace-nowrap border shadow-sm backdrop-blur ${cat === g.key ? "bg-ink text-white border-ink" : "bg-canvas/95 text-ink border-hairline"}`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
            {(search || cat !== "전체") && (
              <div className="mt-2 px-3 py-1.5 bg-canvas/95 backdrop-blur rounded-pill border border-hairline text-[12px] text-muted text-center shadow-sm">
                {filtered.length}곳 일치
              </div>
            )}
          </div>

          {mapClientId ? (
            <NaverMapView pins={filtered} clientId={mapClientId} fullscreen onSelectionChange={setMapSelected} />
          ) : (
            <div className="px-5 py-16 text-center text-error text-[14px]">지도 클라이언트 ID가 설정되지 않았습니다.</div>
          )}
        </div>
      )}

      {/* 지도/리스트 FAB 토글 */}
      {tab === "visit" && (
        <button
          type="button"
          onClick={() => {
            if (mode === "map") setMapSelected(false);
            setMode((m) => (m === "list" ? "map" : "list"));
          }}
          className="cp-action fixed left-1/2 -translate-x-1/2 z-40 frosted-parchment text-ink text-[14px] font-medium px-5 h-11 rounded-pill flex items-center gap-2 border border-hairline transition-[bottom] duration-200 ease-out"
          style={{
            bottom:
              mode === "map" && mapSelected
                ? "calc(var(--bottom-nav-h, 72px) + 132px)"
                : "calc(var(--bottom-nav-h, 72px) + 16px)",
          }}
          aria-label={mode === "list" ? "지도 보기로 전환" : "리스트 보기로 전환"}
        >
          {mode === "list" ? (
            <>
              <Icon name="pin" variant="bold" size={16} />
              <span>지도</span>
            </>
          ) : (
            <>
              <Icon name="list" variant="bold" size={16} />
              <span>리스트</span>
            </>
          )}
        </button>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 1단 축약 카드 (이미지 2 기준)
 *   좌 96px 정사각 썸네일 + 상단 라벨 칩
 *   매장명 / 카테고리·지역 / 도보·등급 / 체험지원
 *   우측 상단: 잔여 자리 / 마감일(빨강)
 * ─────────────────────────────────────────────────────────────*/
function RowCard({ card, myGrade: _myGrade }: { card: ExploreStoreCard; myGrade: Grade }) {
  const label = cardLabel(card);
  const remaining = formatRemainingDays(card.endAt);
  const walk = walkMinutes(card.storeId);
  return (
    <Link
      href={card.accessible ? `/r/store/${card.storeId}?campaign=${card.campaignId}` : "/r/grade"}
      className={`cp-action flex bg-canvas border border-hairline rounded-md overflow-hidden ${card.accessible ? "" : "opacity-50"}`}
    >
      <div className="relative w-[104px] h-[104px] shrink-0 bg-parchment">
        <Image
          src={photoForStore(card.storeId, card.category)}
          alt={card.name}
          fill
          sizes="104px"
          className="object-cover"
        />
        {label && (
          <div className="absolute top-1.5 left-1.5">
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                label.tone === "new"
                  ? "bg-success text-white"
                  : label.tone === "closing"
                    ? "bg-error text-white"
                    : "bg-[#ff9500] text-white"
              }`}
            >
              {label.text}
            </span>
          </div>
        )}
        {!card.accessible && (
          <div className="absolute inset-0 bg-ink/45 flex items-center justify-center text-white text-[10px] font-semibold gap-1">
            <Icon name="lock" variant="bold" size={10} />
            <span>등급</span>
          </div>
        )}
      </div>
      <div className="flex-1 p-3 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-ink truncate">{card.name}</div>
            <div className="text-[11px] text-muted mt-0.5 truncate">{card.category} · {card.area}</div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="inline-flex items-center text-[11px] text-muted">
                <span className="mr-0.5" aria-hidden>🚶</span>도보 {walk}분
              </span>
              <span className="text-[11px] text-muted">·</span>
              <span className="text-[11px] text-muted">{card.grade} 등급 이상</span>
            </div>
            <div className="text-[13px] text-success font-semibold mt-1.5">
              체험 지원 ₩{card.supportAmount.toLocaleString()}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[12px] text-ink2">잔여 <span className="font-semibold text-ink">{card.remain}자리</span></div>
            <div className={`text-[11px] mt-1.5 ${remaining.urgent ? "text-error font-semibold" : "text-muted"}`}>
              {remaining.label}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function GridCard({ card }: { card: ExploreStoreCard }) {
  const label = cardLabel(card);
  return (
    <Link
      href={card.accessible ? `/r/store/${card.storeId}?campaign=${card.campaignId}` : "/r/grade"}
      className={`cp-action block bg-canvas border border-hairline rounded-md overflow-hidden ${card.accessible ? "" : "opacity-50"}`}
    >
      <div className="aspect-[4/3] bg-parchment relative overflow-hidden">
        <Image
          src={photoForStore(card.storeId, card.category)}
          alt={card.name}
          fill
          sizes="(max-width: 480px) 50vw, 240px"
          className="object-cover"
        />
        {label && (
          <div className="absolute top-2 left-2">
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                label.tone === "new"
                  ? "bg-success text-white"
                  : label.tone === "closing"
                    ? "bg-error text-white"
                    : "bg-[#ff9500] text-white"
              }`}
            >
              {label.text}
            </span>
          </div>
        )}
        {card.remain <= 3 && card.accessible && (
          <div className="absolute top-2 right-2">
            <span className="text-[10px] font-semibold text-white bg-ink/80 px-1.5 py-0.5 rounded-pill backdrop-blur-sm">
              잔여 {card.remain}매
            </span>
          </div>
        )}
        {!card.accessible && (
          <div className="absolute inset-0 bg-ink/45 flex items-center justify-center text-white text-[13px] font-semibold gap-1.5">
            <Icon name="lock" variant="bold" size={14} />
            <span>등급 부족</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">{card.category}</div>
        <h3 className="text-[15px] font-semibold text-ink truncate">{card.name}</h3>
        <p className="text-[11px] text-muted mt-0.5 truncate">{card.area} · ★ {card.rating}</p>
        <div className="text-[13px] text-success font-semibold mt-2">
          체험 ₩{card.supportAmount.toLocaleString()}
        </div>
      </div>
    </Link>
  );
}
