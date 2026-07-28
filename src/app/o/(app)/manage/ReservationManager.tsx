"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SBUI, sbNum } from "@/lib/storyboard";

/**
 * 예약관리 (2026-07-28 [관리] 탭 시안) — 매장 셀렉터 + [전체|요청|조율|확정|취소] 칩 +
 * 상태별 예약 카드. 카드 구성: 상태 칩 → 일시·인원(볼드) → 캠페인명(최대 2줄) → 매장명 →
 * [예약 정보] (+ 요청/재제안엔 [예약 확정]).
 *  - "체험자 재제안" 카드는 원래 요청 일시를 흐리게 + 오렌지 제안 일정 라인 (시안)
 *  - [예약 정보] = 다음 depth(/o/manage/reservation/[passId]) 이동 (2026-07-28 시안 —
 *    아코디언 아님. 확정·거절·다른 일정 제안·예약 내역은 상세에서)
 *  - 익명 #last4만 노출 (확정 정책 8 — 등급·실명 비노출)
 */
export interface ManagedReservation {
  passId: string;
  storeId: string;
  storeName: string;
  campaignTitle: string;
  masked: string; // 익명 #last4
  label: string; // 현재 기준 일시 라벨 (요청/확정 일시 · 재제안이면 체험자 재제안 일시)
  partySize?: number;
  state: "requested" | "proposed" | "counter" | "confirmed" | "cancelled";
  originalLabel?: string; // counter일 때 원래 요청 일시 (흐림 표기)
  epoch: number;
}

const STATE_CHIP: Record<ManagedReservation["state"], { label: string; cls: string }> = {
  requested: { label: "예약 요청", cls: "bg-sunken text-ink2" },
  proposed: { label: "다른 일정 제안 · 응답 대기", cls: "bg-brandSoft text-brand" },
  counter: { label: "체험자 재제안 · 응답 대기", cls: "bg-brandSoft text-brand" },
  confirmed: { label: "예약 확정", cls: "bg-successSoft text-successStrong" },
  cancelled: { label: "취소", cls: "bg-sunken text-muted" },
};

type Filter = "all" | "requested" | "coordinating" | "confirmed" | "cancelled";

function filterOf(state: ManagedReservation["state"]): Exclude<Filter, "all"> {
  if (state === "requested") return "requested";
  if (state === "proposed" || state === "counter") return "coordinating";
  if (state === "confirmed") return "confirmed";
  return "cancelled";
}

export default function ReservationManager({
  items,
  stores,
}: {
  items: ManagedReservation[];
  stores: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [storeId, setStoreId] = useState("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const byStore = useMemo(
    () => (storeId === "all" ? items : items.filter((it) => it.storeId === storeId)),
    [items, storeId],
  );
  const counts = useMemo(() => {
    const c = { all: byStore.length, requested: 0, coordinating: 0, confirmed: 0, cancelled: 0 };
    for (const it of byStore) c[filterOf(it.state)] += 1;
    return c;
  }, [byStore]);
  const visible = byStore.filter((it) => filter === "all" || filterOf(it.state) === filter);

  async function confirmReservation(passId: string) {
    setBusyId(passId);
    setErr(null);
    const res = await fetch("/api/owner/reserve-confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passId }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "예약 확정에 실패했어요.");
      setBusyId(null);
      return;
    }
    setBusyId(null);
    router.refresh();
  }

  const chips: Array<{ key: Filter; label: string; count: number }> = [
    { key: "all", label: "전체", count: counts.all },
    { key: "requested", label: "요청", count: counts.requested },
    { key: "coordinating", label: "조율", count: counts.coordinating },
    { key: "confirmed", label: "확정", count: counts.confirmed },
    { key: "cancelled", label: "취소", count: counts.cancelled },
  ];

  return (
    <div className="px-5">
      {/* 매장 셀렉터 — 매장이 여러 개인 사장님용 필터 */}
      {stores.length > 1 && (
        <select
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          aria-label="매장 선택"
          className="w-full h-12 px-4 rounded-md border border-hairline bg-canvas text-[14px] text-ink"
        >
          <option value="all">전체 매장</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}

      {/* 상태 칩 */}
      <div className="mt-3 flex gap-1.5 overflow-x-auto scrollbar-none">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            aria-pressed={filter === c.key}
            className={`cp-action h-9 px-3.5 rounded-pill text-[13px] tabular-nums whitespace-nowrap shrink-0 ${
              filter === c.key ? "bg-ink text-white font-bold" : "bg-canvas border border-hairline text-ink2 font-medium"
            }`}
          >
            {c.label} {c.count}
          </button>
        ))}
      </div>

      {/* 예약 카드 */}
      <div className="mt-3 space-y-3 pb-6">
        {visible.map((it) => {
          const chip = STATE_CHIP[it.state];
          const confirmable = it.state === "requested" || it.state === "counter";
          return (
            <div key={it.passId} className="rounded-lg border border-hairline bg-canvas p-4">
              <span className={`inline-flex items-center px-2 py-1 rounded-xs text-[11px] font-semibold ${chip.cls}`}>
                {chip.label}
              </span>

              {/* 일시 라인 — 재제안 카드는 원 요청을 흐리게 + 오렌지 제안 일정 (시안) */}
              {it.state === "counter" ? (
                <>
                  {it.originalLabel && (
                    <div className="mt-2 text-[16px] font-bold text-mutedSoft tabular-nums">
                      {sbNum(SBUI.dateTime, it.originalLabel)}
                      {it.partySize ? ` · ${it.partySize}명` : ""}
                    </div>
                  )}
                  <div className="mt-1.5 rounded-sm bg-warningSoft px-3 py-2 text-[13px] font-bold text-ink tabular-nums">
                    🗓️ 제안 일정 <span className="ml-1">{sbNum(SBUI.dateTime, it.label)}{it.partySize ? ` · ${it.partySize}명` : ""}</span>
                  </div>
                </>
              ) : (
                <div className={`mt-2 text-[16px] font-bold tabular-nums ${it.state === "cancelled" ? "text-muted" : "text-ink"}`}>
                  {sbNum(SBUI.dateTime, it.label)}
                  {it.partySize ? ` · ${it.partySize}명` : ""}
                </div>
              )}

              <div className="mt-2 text-[14px] font-semibold text-ink leading-[1.4] line-clamp-2">{it.campaignTitle}</div>
              <div className="mt-0.5 text-[12px] text-muted">{it.storeName}</div>

              <div className="mt-3 flex gap-2">
                {/* [예약 정보] — 다음 depth 이동 (확정·거절·제안·예약 내역은 상세에서) */}
                <Link
                  href={`/o/manage/reservation/${it.passId}`}
                  className="cp-action flex-1 h-11 rounded-md border border-hairline bg-canvas text-[14px] font-semibold text-ink grid place-items-center"
                >
                  예약 정보
                </Link>
                {confirmable && (
                  <button
                    type="button"
                    onClick={() => confirmReservation(it.passId)}
                    disabled={busyId === it.passId}
                    className="cp-action flex-1 h-11 rounded-md bg-brand text-white text-[14px] font-bold disabled:opacity-60"
                  >
                    {busyId === it.passId ? "확정 중..." : "예약 확정"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <div className="rounded-md border border-dashed border-hairline p-8 text-center text-muted text-[14px]">
            {filter === "all" ? "아직 예약 신청이 없어요." : "해당 상태의 예약이 없어요."}
          </div>
        )}
      </div>
      {err && <p className="pb-4 -mt-2 text-[12px] text-error">{err}</p>}
    </div>
  );
}
