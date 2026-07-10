"use client";
import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import LocationSheet from "../home/LocationSheet";
import { CHANNEL_ORDER, CHANNEL_LABEL } from "@/lib/channels";
import { SnsKind } from "@/lib/types";
import type { ExploreStoreCard } from "./ExploreView";

/**
 * 통합 필터 바텀시트 (2026-07-10 §8 개편 — ExploreView에서 추출)
 *  - draft 상태: 열릴 때 적용값 스냅샷 → 칩 조작은 draft만 변경, [적용하기]로 커밋
 *    (기존 "선택 즉시 반영"에서 변경 — 상단 카테고리 칩의 즉시 반영과는 분리)
 *  - SNS 채널·카테고리에 '전체' 칩 (선택 시 개별 선택 초기화 = 빈 Set)
 *  - 지역 항목 신설: 현재 지역 표시 + [현위치](해제) + 시도→시군구 선택(LocationSheet 재사용)
 *  - [초기화] = 카테고리·채널 전체 해제 + 지역은 홈 설정 지역으로 복귀
 */
interface CatGroup {
  key: string;
  label: string;
  ic: string;
  match: (c: string) => boolean;
}

export default function FilterSheet({
  cards,
  appliedCats,
  appliedChannels,
  appliedArea,
  homeArea,
  catGroups,
  onClose,
  onApply,
}: {
  cards: ExploreStoreCard[];
  appliedCats: Set<string>;
  appliedChannels: Set<SnsKind>;
  appliedArea: string | null;
  homeArea: string | null; // 홈에서 설정한 기본 지역 — [초기화] 시 복귀 기준
  catGroups: CatGroup[];
  onClose: () => void;
  onApply: (next: { cats: Set<string>; channels: Set<SnsKind>; area: string | null }) => void;
}) {
  // 오픈 시점 스냅샷 — 시트가 열려 있는 동안 상단 칩 조작이 draft를 덮지 않는다
  const [draftCats, setDraftCats] = useState<Set<string>>(() => new Set(appliedCats));
  const [draftChannels, setDraftChannels] = useState<Set<SnsKind>>(() => new Set(appliedChannels));
  const [draftArea, setDraftArea] = useState<string | null>(appliedArea);
  const [regionOpen, setRegionOpen] = useState(false);

  function toggleDraftCat(key: string) {
    setDraftCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function toggleDraftChannel(ch: SnsKind) {
    setDraftChannels((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  }

  // 적용 시 결과 미리보기 — draft 기준 재계산 (지역은 기준점이지 리스트 필터가 아니므로 제외)
  const previewCount = useMemo(() => {
    const matchCat =
      draftCats.size === 0
        ? () => true
        : (c: string) => catGroups.filter((g) => draftCats.has(g.key)).some((g) => g.match(c));
    return cards.filter((p) => {
      if (!matchCat(p.category)) return false;
      if (draftChannels.size > 0 && !p.requiredChannels.some((ch) => draftChannels.has(ch))) return false;
      return true;
    }).length;
  }, [cards, draftCats, draftChannels, catGroups]);

  const chipCls = (active: boolean) =>
    `inline-flex items-center gap-1.5 h-10 px-3.5 rounded-pill text-[14px] font-medium bg-canvas whitespace-nowrap ${
      active ? "border-[1.5px] border-ink text-ink font-semibold" : "border border-hairline text-ink2"
    }`;

  return (
    <div className="fixed inset-0 bg-ink/45 z-50 flex items-end" onClick={onClose}>
      <div
        className="bg-canvas w-full max-w-[480px] mx-auto rounded-t-xl px-5 pt-3 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pb-2">
          <span className="w-9 h-1 rounded-pill bg-borderStrong" />
        </div>
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-bold text-ink tracking-title">필터</h2>
          <button
            type="button"
            onClick={onClose}
            className="cp-action w-8 h-8 rounded-full flex items-center justify-center text-ink"
            aria-label="닫기"
          >
            <Icon name="x" variant="border" size={14} />
          </button>
        </div>

        {/* 지역 — 현재 설정 지역 기본, 현위치(해제)/지역 선택 (§8-3) */}
        <div className="mt-4">
          <div className="text-[14px] font-semibold text-ink">지역</div>
          <div className="mt-2.5 flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setDraftArea(null)}
              aria-pressed={draftArea === null}
              className={chipCls(draftArea === null)}
            >
              <Icon name="crosshair" variant="border" size={14} />
              현위치
            </button>
            <button
              type="button"
              onClick={() => setRegionOpen(true)}
              aria-pressed={draftArea !== null}
              className={chipCls(draftArea !== null)}
            >
              <Icon name="pin" variant={draftArea ? "bold" : "border"} size={14} />
              {draftArea ?? "지역 선택"}
              <Icon name="chevron-down" variant="border" size={12} className="text-muted" />
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted">지역을 선택하면 그 지역 기준으로 지도와 거리가 바뀌어요 (탐색에서만 적용)</p>
        </div>

        <div className="mt-5">
          <div className="text-[14px] font-semibold text-ink">SNS 채널</div>
          <div className="mt-2.5 flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setDraftChannels(new Set())}
              aria-pressed={draftChannels.size === 0}
              className={chipCls(draftChannels.size === 0)}
            >
              전체
            </button>
            {CHANNEL_ORDER.map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => toggleDraftChannel(ch)}
                aria-pressed={draftChannels.has(ch)}
                className={chipCls(draftChannels.has(ch))}
              >
                {CHANNEL_LABEL[ch]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <div className="text-[14px] font-semibold text-ink">카테고리</div>
          <div className="mt-2.5 flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setDraftCats(new Set())}
              aria-pressed={draftCats.size === 0}
              className={chipCls(draftCats.size === 0)}
            >
              <span aria-hidden>⭐</span>
              전체
            </button>
            {catGroups.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => toggleDraftCat(g.key)}
                aria-pressed={draftCats.has(g.key)}
                className={chipCls(draftCats.has(g.key))}
              >
                <span aria-hidden>{g.ic}</span>
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* 하단 — 초기화(홈 기본 지역 복귀) + 적용하기 */}
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setDraftCats(new Set());
              setDraftChannels(new Set());
              setDraftArea(homeArea);
            }}
            className="cp-action h-[52px] px-5 rounded-md bg-sunken text-[15px] font-semibold text-ink inline-flex items-center gap-1.5"
          >
            <span aria-hidden>↺</span> 초기화
          </button>
          <button
            type="button"
            onClick={() => onApply({ cats: draftCats, channels: draftChannels, area: draftArea })}
            className="cp-action flex-1 h-[52px] rounded-md bg-brand text-white text-[16px] font-bold"
          >
            적용하기 · 체험 {previewCount}개
          </button>
        </div>
      </div>

      {/* 지역 선택 — 홈 LocationSheet 재사용 (onPick 콜백 모드 · 탐색 한정) */}
      {regionOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <LocationSheet
            current={draftArea ?? undefined}
            title="지역 선택"
            onClose={() => setRegionOpen(false)}
            onPick={(a) => setDraftArea(a)}
          />
        </div>
      )}
    </div>
  );
}
