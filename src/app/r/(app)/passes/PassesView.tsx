"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import Icon from "@/components/Icon";
import { photoForStore } from "@/lib/store-photo";
import { SBUI, sbNum } from "@/lib/storyboard";
import { fmtKoDateTime } from "@/lib/dates";
import { CHANNEL_LABEL } from "@/lib/channels";
import { DISPLAY_BADGE, type PassDisplayStatus } from "@/lib/pass-display";
import type { SnsKind } from "@/lib/types";
import CancelPassButton from "./[id]/CancelPassButton";

/**
 * 체험권 목록 (2026-07-08 레퍼런스 개편)
 *  - 헤더: [방문형 | 기자단] 세그먼트 타이틀 + 검색·알림
 *  - 서브 탭: 체험권(active/취소/만료) / 리뷰작성(작성 대기/검수 중/완료/반려) — 퍼플 언더라인
 *  - 상태 필터 칩(검정 활성 pill) + 썸네일 카드(상태별 액션 버튼)
 */
export interface VisitPassItem {
  id: string;
  storeId: string;
  campaignId: string;
  storeName: string;
  category: string;
  status: string;
  // 파생 표시 상태 (src/lib/pass-display.ts) — used+기한초과=overdue, rejected+기한/횟수 소진=resubmit_expired.
  // 탭 분류는 실상태(status), 뱃지·칩 필터·카드 액션은 displayStatus 기준.
  displayStatus: PassDisplayStatus;
  channel: SnsKind | null;
  grade: string;
  support: number; // 이 체험권으로 받는 지원금 (등급 적용액)
  expiresAt: number;
  usedAt: number | null;
  reviewDeadline: number | null; // used=이용 후 7일 / rejected=반려 후 7일(재제출 기한)
  deadlineKind: "review" | "resubmit" | null; // 날짜 라벨 — "리뷰마감" vs "재제출 기한"
  rejectReason: string | null;
  highlight: boolean;
  // 배송형 (2026-07-12 레뷰 벤치마크) — active="발송 대기", 혜택 표기 = 제품(+포인트)
  isDelivery?: boolean;
  pointReward?: number; // 등급 배율 적용된 내 적립 예정 포인트
}

// 체험권 탭(발급·사용 전 라이프사이클) vs 리뷰작성 탭(이용 후 리뷰 라이프사이클)
const ISSUED_STATUSES = ["active", "cancelled", "expired"] as const;
const REVIEW_STATUSES = ["used", "review_submitted", "completed", "rejected"] as const;

const ISSUED_CHIPS: { key: string; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "active", label: "사용가능" },
  { key: "cancelled", label: "취소" },
  { key: "expired", label: "만료" },
];
// 배송형 — active는 QR 사용 개념이 없어 "발송 대기" (2026-07-12 세그먼트 분리)
const DELIVERY_ISSUED_CHIPS: { key: string; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "active", label: "발송 대기" },
  { key: "cancelled", label: "취소" },
  { key: "expired", label: "만료" },
];
const REVIEW_CHIPS: { key: string; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "used", label: "작성 대기중" },
  { key: "review_submitted", label: "검수중" },
  { key: "completed", label: "검수완료" },
  { key: "rejected", label: "반려" },
  { key: "overdue_any", label: "기한 초과" }, // overdue + resubmit_expired
];

export default function PassesView({
  items,
  showDelivery,
  showPress,
  pressCount,
  pressView,
  unread,
}: {
  items: VisitPassItem[];
  // 배송형 세그먼트 노출 여부 (2026-07-12 분리 — 배송 패스는 방문형 대카테고리에 섞지 않는다)
  showDelivery: boolean;
  showPress: boolean;
  pressCount: number;
  pressView: ReactNode;
  unread: number;
}) {
  const [segment, setSegment] = useState<"visit" | "delivery" | "press">("visit");
  const [tab, setTab] = useState<"issued" | "review">("issued");
  const [chip, setChip] = useState("all");

  // 배송형은 방문형과 별개 세그먼트 (2026-07-12) — 카드·칩·빈 상태 카피가 각각의 방식 기준
  const visitItems = useMemo(() => items.filter((it) => !it.isDelivery), [items]);
  const deliveryItems = useMemo(() => items.filter((it) => !!it.isDelivery), [items]);
  const deliveryCount = deliveryItems.length;

  const tabItems = useMemo(() => {
    const base = segment === "delivery" ? deliveryItems : visitItems;
    const statuses = tab === "issued" ? ISSUED_STATUSES : REVIEW_STATUSES;
    return base.filter((it) => (statuses as readonly string[]).includes(it.status));
  }, [visitItems, deliveryItems, segment, tab]);
  // 칩 필터는 파생 표시 상태 기준 — "작성 대기중"은 기한 초과(overdue)를 제외한다
  const filtered =
    chip === "all"
      ? tabItems
      : tabItems.filter((it) =>
          chip === "overdue_any"
            ? it.displayStatus === "overdue" || it.displayStatus === "resubmit_expired"
            : it.displayStatus === chip,
        );
  const chips = tab === "issued" ? (segment === "delivery" ? DELIVERY_ISSUED_CHIPS : ISSUED_CHIPS) : REVIEW_CHIPS;

  return (
    <div>
      {/* 세그먼트 타이틀 + 검색·알림 (탐색과 동일 문법) */}
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-5 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <button
              type="button"
              onClick={() => {
                setSegment("visit");
                setChip("all");
              }}
              className={`cp-action text-[20px] tracking-title ${segment === "visit" ? "font-bold text-ink" : "font-semibold text-mutedSoft"}`}
            >
              방문형
            </button>
            {/* 배송형 — 방문형 대카테고리에서 분리 (2026-07-12). 탐색 세그먼트와 동일 문법 */}
            {showDelivery && (
              <button
                type="button"
                onClick={() => {
                  setSegment("delivery");
                  setChip("all");
                }}
                className={`cp-action text-[20px] tracking-title ${segment === "delivery" ? "font-bold text-ink" : "font-semibold text-mutedSoft"}`}
              >
                배송형{deliveryCount > 0 ? ` ${deliveryCount}` : ""}
              </button>
            )}
            {/* 기자단은 MVP 제외 — 과거 발급분이 있을 때만 전환 가능, 없으면 비활성 표기 */}
            <button
              type="button"
              onClick={() => showPress && setSegment("press")}
              disabled={!showPress}
              className={`cp-action text-[20px] tracking-title ${segment === "press" ? "font-bold text-ink" : "font-semibold text-mutedSoft"} disabled:cursor-default`}
              aria-disabled={!showPress}
            >
              기자단{showPress && pressCount > 0 ? ` ${pressCount}` : ""}
            </button>
          </div>
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

        {segment !== "press" && (
          <>
            {/* 서브 탭 — 체험권(배송형은 신청 내역) / 리뷰작성 (퍼플 언더라인) */}
            <div className="grid grid-cols-2 border-b border-hairlineSoft">
              {(
                [
                  { key: "issued", label: segment === "delivery" ? "신청 내역" : "체험권" },
                  { key: "review", label: "리뷰작성" },
                ] as const
              ).map((t) => {
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setTab(t.key);
                      setChip("all");
                    }}
                    className={`cp-action h-11 text-[15px] border-b-2 -mb-px ${
                      active ? "border-brand text-brand font-bold" : "border-transparent text-muted font-medium"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {segment === "press" ? (
        pressView
      ) : (
        <>
          {/* 상태 필터 칩 — 검정 활성 pill */}
          <div className="px-5 pt-4 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {chips.map((c) => {
              const active = chip === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setChip(c.key)}
                  className={`shrink-0 h-10 px-4 rounded-pill text-[14px] ${
                    active ? "bg-ink text-white font-semibold" : "bg-sunken text-ink2 font-medium"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          <div className="px-5 mt-4 space-y-3 pb-8">
            {filtered.map((it) => (
              <PassCard key={it.id} it={it} tab={tab} />
            ))}
            {filtered.length === 0 && (
              <div className="py-16 text-center">
                <p className="text-[15px] text-muted">
                  {segment === "delivery"
                    ? tab === "issued"
                      ? "해당하는 배송 체험 신청이 없어요."
                      : "리뷰 단계의 배송 체험이 없어요."
                    : tab === "issued"
                      ? "해당하는 체험권이 없어요."
                      : "리뷰 단계의 체험이 없어요."}
                </p>
                {segment === "delivery" ? (
                  <Link
                    href="/r/explore?mode=list&tab=delivery"
                    className="cp-action inline-block mt-4 text-[14px] font-semibold text-brand"
                  >
                    배송 체험 둘러보기 →
                  </Link>
                ) : (
                  <Link href="/r/home" className="cp-action inline-block mt-4 text-[14px] font-semibold text-brand">
                    홈에서 체험권 받기 →
                  </Link>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PassCard({ it, tab }: { it: VisitPassItem; tab: "issued" | "review" }) {
  // 배송형 active = 발송 대기 (QR 사용 개념이 없음 — 파생 라벨만 교체, 실상태는 동일)
  const badge =
    it.isDelivery && it.displayStatus === "active"
      ? { label: "발송 대기", cls: "bg-brandSoft text-brand" }
      : DISPLAY_BADGE[it.displayStatus] ?? { label: it.displayStatus, cls: "bg-sunken text-muted" };
  const isActive = it.displayStatus === "active";
  // 다음 행동이 있는 카드는 퍼플 보더 강조 (사용가능·작성 대기 — 기한 초과 제외)
  const emphasized = isActive || it.displayStatus === "used" || it.highlight;

  return (
    <div
      className={`rounded-lg bg-canvas p-4 ${
        emphasized ? "border-[1.5px] border-brand" : "border border-hairline"
      }`}
    >
      {/* 헤더 행 — 썸네일 + 가게명·채널/등급·지원금 + 상태 뱃지 */}
      <div className="flex gap-3">
        <div className="relative w-[76px] h-[76px] shrink-0 rounded-md overflow-hidden bg-sunken">
          <Image src={photoForStore(it.storeId, it.category)} alt={it.storeName} fill sizes="76px" className="object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[15px] font-bold text-ink tracking-title leading-[1.35] truncate">{it.storeName}</h3>
            <span className={`shrink-0 inline-flex items-center px-2 py-1 rounded-pill text-[11px] font-semibold ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
          <p className="text-[13px] text-muted mt-0.5 truncate">
            {it.channel ? CHANNEL_LABEL[it.channel] : "채널 미정"} · {it.grade}등급 적용
          </p>
          <p className="mt-1.5 text-[16px] tabular-nums">
            {it.isDelivery ? (
              <>
                <span className="font-bold text-ink">📦 제품 제공</span>
                {(it.pointReward ?? 0) > 0 && (
                  <span className="text-[13px] text-muted"> + {sbNum(SBUI.point, `${(it.pointReward ?? 0).toLocaleString()}P`)} 적립</span>
                )}
              </>
            ) : (
              <>
                <span className="font-bold text-ink">{sbNum(SBUI.support, `${it.support.toLocaleString()}원`)}</span>{" "}
                <span className="text-[13px] text-muted">지원</span>
              </>
            )}
          </p>
        </div>
      </div>

      {it.highlight && (
        <div className="mt-3 text-[12px] text-brand font-semibold">✓ 방금 발급된 체험권이에요</div>
      )}

      {/* 상태별 하단 영역 */}
      {isActive && (
        <>
          <div className="mt-3.5 pt-3.5 border-t border-dashed border-hairline flex items-center gap-3 text-[13px]">
            <span className="text-muted">{it.isDelivery ? "신청 유효" : "유효기간"}</span>
            <span className="font-semibold text-ink tabular-nums">
              {sbNum(SBUI.dateTime, fmtKoDateTime(it.expiresAt))}까지
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <CancelPassButton passId={it.id} variant="row" />
            <StoreInfoButton it={it} />
          </div>
          <Link
            href={`/r/passes/${it.id}`}
            className="cp-action mt-2 flex h-11 items-center justify-center rounded-md bg-brand text-white text-[14px] font-bold"
          >
            체험권 보기
          </Link>
        </>
      )}

      {it.status === "cancelled" && (
        <>
          <div className="mt-3.5 flex">
            <StoreInfoButton it={it} />
          </div>
          <div className="mt-2.5 rounded-md bg-sunken px-3.5 py-2.5 text-[12px] text-muted leading-[1.5]">
            같은 캠페인이 모집 중이면 취소 12시간 뒤부터 다시 참여할 수 있어요.
          </div>
        </>
      )}

      {it.status === "expired" && (
        <div className="mt-3.5 flex">
          <StoreInfoButton it={it} />
        </div>
      )}

      {/* 리뷰작성 탭 상태들 (2026-07-08 시안 · 2026-07-10 파생 상태) */}
      {it.displayStatus === "used" && (
        <>
          {it.reviewDeadline && (
            <div className="mt-3.5 pt-3.5 border-t border-dashed border-hairline flex items-center gap-3 text-[13px]">
              <span className="text-muted">리뷰마감</span>
              <span className="font-semibold text-ink tabular-nums">
                {sbNum(SBUI.dateTime, fmtKoDateTime(it.reviewDeadline))}까지
              </span>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <StoreInfoButton it={it} />
            <Link
              href={`/r/passes/${it.id}`}
              className="cp-action flex-1 h-11 rounded-md bg-brand text-white text-[14px] font-bold flex items-center justify-center"
            >
              리뷰 작성하기
            </Link>
          </div>
        </>
      )}

      {/* 제출 기한 초과 — CTA 없음 (서버도 기한 경과 제출을 차단) */}
      {it.displayStatus === "overdue" && (
        <>
          <div className="mt-3.5 flex">
            <StoreInfoButton it={it} />
          </div>
          <div className="mt-2.5 rounded-md bg-sunken px-3.5 py-2.5 text-[12px] text-muted leading-[1.5]">
            리뷰 제출 기한(이용 후 7일)이 지났어요. 반복되면 월간 등급 재평가에 감점으로 반영돼요.
          </div>
        </>
      )}

      {it.displayStatus === "review_submitted" && (
        <>
          <div className="mt-3.5 flex">
            <StoreInfoButton it={it} />
          </div>
          <div className="mt-2.5 rounded-md bg-sunken px-3.5 py-2.5 text-[12px] text-muted text-center">
            영업일 기준 최대 3일 이내로 검수 완료되어요
          </div>
        </>
      )}

      {it.displayStatus === "rejected" && (
        <>
          {it.reviewDeadline && (
            <div className="mt-3.5 pt-3.5 border-t border-dashed border-hairline flex items-center gap-3 text-[13px]">
              {/* 반려 후 7일 재제출 기한 — '유효기간/리뷰마감'과 구분되는 명칭 (2026-07-10) */}
              <span className="text-muted">재제출 기한</span>
              <span className="font-semibold text-ink tabular-nums">
                {sbNum(SBUI.dateTime, fmtKoDateTime(it.reviewDeadline))}까지
              </span>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <StoreInfoButton it={it} />
            <Link
              href={`/r/passes/${it.id}`}
              className="cp-action flex-1 h-11 rounded-md bg-brand text-white text-[14px] font-bold flex items-center justify-center"
            >
              리뷰 다시 제출하기
            </Link>
          </div>
        </>
      )}

      {/* 재제출 기한 초과 (또는 재제출 1회 소진) — CTA 없음 */}
      {it.displayStatus === "resubmit_expired" && (
        <>
          <div className="mt-3.5 flex">
            <StoreInfoButton it={it} />
          </div>
          {/* [2026-07-12 회의 §12-4] "재제출 횟수 사용" 같은 불명확한 표현 대신 기한 사실 중심 */}
          <div className="mt-2.5 rounded-md bg-sunken px-3.5 py-2.5 text-[12px] text-muted leading-[1.5]">
            재제출 기한(반려 후 7일) 안에 다시 제출하지 않아 마감된 체험이에요.
          </div>
        </>
      )}

      {it.displayStatus === "completed" && (
        <div className="mt-3.5 flex">
          <StoreInfoButton it={it} />
        </div>
      )}
    </div>
  );
}

function StoreInfoButton({ it }: { it: VisitPassItem }) {
  return (
    <Link
      href={`/r/store/${it.storeId}?campaign=${it.campaignId}`}
      className="cp-action flex-1 h-11 rounded-md border border-hairline bg-canvas text-[14px] font-semibold text-ink flex items-center justify-center"
    >
      체험 정보
    </Link>
  );
}
