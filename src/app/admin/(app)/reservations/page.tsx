import Link from "next/link";
import { getCurrentAdmin } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { fmtKoDateTime } from "@/lib/dates";
import {
  fmtReservationLabel,
  reservationEpoch,
  reservationHistoryLines,
  reviewerCounterUsed,
  OWNER_CANCEL_REASONS,
} from "@/lib/reservation";
import AdminReservationCancel from "./AdminReservationCancel";

export const dynamic = "force-dynamic";

// 운영자 예약 관리 (2026-07-22 §13) — 전체 예약 로그·상태/캠페인/사장님/체험자 필터·
// 협상 이력·취소 주체/사유 확인·수동 취소. 기능 중심(§13-2 — 별도 고도화 디자인 없음).
type StatusKey = "all" | "requested" | "proposed" | "confirmed" | "visited" | "cancelled" | "expired";

const STATUS_FILTERS: Array<{ key: StatusKey; label: string }> = [
  { key: "all", label: "전체" },
  { key: "requested", label: "예약 대기" },
  { key: "proposed", label: "제안 중" },
  { key: "confirmed", label: "확정" },
  { key: "visited", label: "방문 완료" },
  { key: "cancelled", label: "취소·거절" },
  { key: "expired", label: "만료" },
];

export default async function AdminReservations({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; campaign?: string; owner?: string; reviewer?: string }>;
}) {
  await getCurrentAdmin();
  const { status = "all", campaign = "", owner = "", reviewer = "" } = await searchParams;
  const db = await getDBAsync();

  const rows = db.passes
    .filter((p) => p.reservation)
    .map((p) => {
      const rsv = p.reservation!;
      const c = db.campaigns.find((x) => x.id === p.campaignId);
      const store = db.stores.find((x) => x.id === p.storeId);
      const ownerAcc = db.owners.find((o) => o.id === p.ownerId);
      const rv = db.reviewers.find((r) => r.id === p.reviewerId);
      const statusKey: Exclude<StatusKey, "all"> =
        p.status === "active"
          ? rsv.status
          : ["used", "review_submitted", "completed"].includes(p.status)
            ? "visited"
            : p.status === "cancelled"
              ? "cancelled"
              : "expired";
      // 취소 주체 구분 (§5-4 — 운영·CS 화면은 명확히 구분)
      const cancelWho =
        p.status !== "cancelled"
          ? null
          : p.cancelledVia === "owner_declined"
            ? "매장 거절/무응답"
            : p.cancelledVia === "owner_cancelled"
              ? "매장 취소"
              : p.cancelledVia === "admin_cancelled"
                ? "운영자 취소"
                : p.cancelledVia === "proposal_declined"
                  ? "체험자 제안 거절"
                  : "체험자 취소";
      return {
        p,
        rsv,
        statusKey,
        cancelWho,
        campaignTitle: c?.title ?? "캠페인",
        campaignId: p.campaignId,
        storeName: store?.name ?? "매장",
        ownerEmail: ownerAcc?.email ?? p.ownerId,
        reviewerEmail: rv?.email ?? p.reviewerId,
        label: fmtReservationLabel(rsv.date, rsv.time),
        epoch: reservationEpoch(rsv.date, rsv.time),
        counter: reviewerCounterUsed(rsv),
        history: reservationHistoryLines(rsv),
      };
    })
    .filter((r) => (status === "all" ? true : r.statusKey === status))
    .filter((r) => (campaign ? r.campaignId === campaign : true))
    .filter((r) => (owner ? r.p.ownerId === owner : true))
    .filter((r) => (reviewer ? r.p.reviewerId === reviewer : true))
    .sort((a, b) => b.epoch - a.epoch);

  // 매장 확정 취소 사유 통계 (2026-08-04 — 4지선다+직접 입력 데이터화, 필터와 무관한 전체 집계).
  // 코드 도입 전 구버전 건은 "미분류"로 별도 표기.
  const ownerCancelled = db.passes.filter((p) => p.reservation && p.cancelledVia === "owner_cancelled");
  const reasonStats = OWNER_CANCEL_REASONS.map((r) => ({
    ...r,
    count: ownerCancelled.filter((p) => p.cancelReasonCode === r.code).length,
  }));
  const unclassified = ownerCancelled.filter((p) => !p.cancelReasonCode).length;

  const campaignsWithRsv = db.campaigns.filter((c) => db.passes.some((p) => p.campaignId === c.id && p.reservation));
  const ownersWithRsv = db.owners.filter((o) => db.passes.some((p) => p.ownerId === o.id && p.reservation));
  const reviewersWithRsv = db.reviewers.filter((r) => db.passes.some((p) => p.reviewerId === r.id && p.reservation));
  const qs = (next: Record<string, string>) => {
    const params = new URLSearchParams({ status, campaign, owner, reviewer, ...next });
    for (const [k, v] of [...params.entries()]) if (!v || v === "all") params.delete(k);
    const s2 = params.toString();
    return `/admin/reservations${s2 ? `?${s2}` : ""}`;
  };

  return (
    <div className="pb-24">
      <section className="px-5 pt-5">
        <div className="rounded-lg border border-hairline bg-canvas p-5">
          <div className="text-[12px] text-muted">예약 로그</div>
          <div className="text-[22px] font-bold text-ink tracking-title tabular-nums mt-1">{rows.length}건</div>
          <div className="text-[12px] text-muted mt-2">
            변경·취소 주체와 사유는 각 건의 협상 이력에서 확인 — 수동 취소는 §15-3 고정 문구로 안내된다
          </div>
        </div>

        {/* 매장 확정 취소 사유 통계 (2026-08-04 §15.3) — 확정 후 매장 취소는 모집 슬롯
            미복원(사용 처리 간주) 패널티 대상이라 사유 분포를 상시 모니터링한다 */}
        <div className="mt-3 rounded-lg border border-hairline bg-canvas p-5">
          <div className="flex items-center justify-between">
            <div className="text-[12px] text-muted">매장 확정 취소 사유 통계</div>
            <div className="text-[13px] font-bold text-ink tabular-nums">총 {ownerCancelled.length}건</div>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {reasonStats.map((r) => (
              <div key={r.code} className="flex items-center justify-between text-[12px]">
                <span className="text-ink2">{r.label}</span>
                <span className={`font-bold tabular-nums ${r.count > 0 ? "text-ink" : "text-mutedSoft"}`}>{r.count}건</span>
              </div>
            ))}
            {unclassified > 0 && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted">미분류 (사유 코드 도입 전)</span>
                <span className="font-bold text-ink tabular-nums">{unclassified}건</span>
              </div>
            )}
          </div>
          <p className="mt-2.5 text-[11px] text-muted leading-[1.5]">
            직접 입력 원문은 아래 취소 건 카드의 사유에서 확인 — 확정 후 매장 취소 건은 모집 인원이 복원되지 않는다.
          </p>
        </div>
      </section>

      {/* 상태 필터 */}
      <section className="px-5 mt-4 flex gap-1.5 overflow-x-auto">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={qs({ status: f.key })}
            className={`cp-action shrink-0 h-8 px-3 rounded-pill text-[12px] font-semibold inline-flex items-center ${
              status === f.key ? "bg-ink text-white" : "bg-canvas border border-hairline text-muted"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </section>

      {/* 캠페인/사장님/체험자 필터 (§13-1) — 기능 중심 GET 폼 */}
      <section className="px-5 mt-3">
        <form method="get" className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1.5">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <select name="campaign" defaultValue={campaign} aria-label="캠페인 필터" className="h-9 px-2 rounded-sm border border-hairline bg-canvas text-[12px] text-ink min-w-0">
            <option value="">캠페인 전체</option>
            {campaignsWithRsv.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <select name="owner" defaultValue={owner} aria-label="사장님 필터" className="h-9 px-2 rounded-sm border border-hairline bg-canvas text-[12px] text-ink min-w-0">
            <option value="">사장님 전체</option>
            {ownersWithRsv.map((o) => (
              <option key={o.id} value={o.id}>
                {o.storeName} ({o.email})
              </option>
            ))}
          </select>
          <select name="reviewer" defaultValue={reviewer} aria-label="체험자 필터" className="h-9 px-2 rounded-sm border border-hairline bg-canvas text-[12px] text-ink min-w-0">
            <option value="">체험자 전체</option>
            {reviewersWithRsv.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nickname} ({r.email})
              </option>
            ))}
          </select>
          <button type="submit" className="cp-action h-9 px-3 rounded-sm bg-ink text-white text-[12px] font-bold">
            적용
          </button>
        </form>
      </section>

      <section className="px-5 mt-4 space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start">
        {rows.length === 0 && (
          <div className="rounded-md border border-dashed border-hairline p-6 text-center text-[13px] text-muted">
            조건에 맞는 예약이 없습니다.
          </div>
        )}
        {rows.map((r) => (
          <div key={r.p.id} className="rounded-lg border border-hairline bg-canvas p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-ink truncate">
                  {r.campaignTitle} <span className="text-muted font-normal">· {r.storeName}</span>
                </div>
                <div className="text-[11px] text-muted truncate">
                  체험자 {r.reviewerEmail} · 사장님 {r.ownerEmail}
                </div>
              </div>
              <span
                className={`shrink-0 text-[11px] px-2 py-0.5 rounded-pill font-semibold ${
                  r.statusKey === "confirmed"
                    ? "bg-successSoft text-successStrong"
                    : r.statusKey === "visited"
                      ? "bg-brandSoft text-brand"
                      : r.statusKey === "cancelled" || r.statusKey === "expired"
                        ? "bg-sunken text-muted"
                        : "bg-warningSoft text-ink2"
                }`}
              >
                {STATUS_FILTERS.find((f) => f.key === r.statusKey)?.label}
                {r.statusKey === "requested" && r.counter ? " (재요청)" : ""}
              </span>
            </div>
            <div className="mt-1.5 text-[13px] font-bold text-ink tabular-nums">
              📅 {r.label}
              {r.rsv.partySize ? ` · ${r.rsv.partySize}명` : ""}
            </div>
            {r.cancelWho && (
              <div className="mt-1 text-[12px] text-muted">
                취소 주체: <span className="font-semibold text-ink2">{r.cancelWho}</span>
                {r.p.cancelReason ? ` · 사유: ${r.p.cancelReason}` : ""}
                {r.p.cancelledAt ? ` · ${fmtKoDateTime(r.p.cancelledAt)}` : ""}
              </div>
            )}
            {/* 협상 이력 — 변경 전후 일시·주체·시각 (§9-4) */}
            {r.history.length > 0 && (
              <details className="mt-2">
                <summary className="cp-action text-[12px] font-semibold text-muted cursor-pointer">
                  이력 {r.history.length}건 보기
                </summary>
                <div className="mt-1.5 rounded-sm bg-sunken px-3 py-2 space-y-1">
                  {r.history.map((h, i) => (
                    <div key={i} className="text-[12px] text-ink2 leading-[1.5] tabular-nums">
                      {fmtKoDateTime(h.at)} · <span className="font-semibold">{h.prefix}</span>
                      {h.timeLabel && ` · ${h.timeLabel}`}
                      {h.note && <span className="text-muted"> · 💬 {h.note}</span>}
                    </div>
                  ))}
                </div>
              </details>
            )}
            {/* 수동 취소 — 진행 중(사용 전)만 (§13-1) */}
            {r.p.status === "active" && <AdminReservationCancel passId={r.p.id} />}
          </div>
        ))}
      </section>
    </div>
  );
}
