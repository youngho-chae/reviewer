import { getCurrentAdmin } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { passRefNo } from "@/lib/owner-review-status";
import { fmtReservationLabel, cancelledCopy } from "@/lib/reservation";
import { passDisplayStatus, DISPLAY_BADGE } from "@/lib/pass-display";
import GradeBadge from "@/components/GradeBadge";
import PassFixActions from "./PassFixActions";

export const dynamic = "force-dynamic";

// 체험권 관리 (2026-09-07 감사 개편) — 검색 + 정정 도구.
// 감사 결과 결제액·적용 지원금이 어드민 어느 화면에도 없었고(오입력이 W 상생지수로 영구 전이),
// 처리 완료·기한 초과 건은 도달 화면 자체가 없었다. 이 화면이 전 상태 조회 + 정정 진입점.
const PAGE_SIZE = 30;

export default async function AdminPasses({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; st?: string }>;
}) {
  await getCurrentAdmin();
  const db = await getDBAsync();
  const { q, st } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();
  const now = Date.now();

  const rows = db.passes
    .map((p) => {
      const reviewer = db.reviewers.find((r) => r.id === p.reviewerId);
      const owner = db.owners.find((o) => o.id === p.ownerId);
      const store = db.stores.find((x) => x.id === p.storeId);
      const campaign = db.campaigns.find((c) => c.id === p.campaignId);
      return { p, reviewer, owner, store, campaign, display: passDisplayStatus(p, now) };
    })
    .filter(({ p, reviewer, owner }) => {
      if (st && p.status !== st) return false;
      if (!query) return true;
      // 검색 = 체험권 번호 끝자리 / 체험자·사장님 이메일 / 매장명
      return (
        p.id.toLowerCase().includes(query) ||
        passRefNo(p.id).toLowerCase().includes(query) ||
        (reviewer?.email ?? "").toLowerCase().includes(query) ||
        (owner?.email ?? "").toLowerCase().includes(query)
      );
    })
    .sort((a, b) => b.p.issuedAt - a.p.issuedAt)
    .slice(0, PAGE_SIZE);

  const STATUSES = ["active", "used", "review_submitted", "completed", "rejected", "expired", "cancelled"] as const;
  const fmt = (t?: number | null) =>
    t ? new Date(t).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <div className="pb-24">
      <section className="px-5 pt-5">
        {/* 검색 — GET 폼 (체험권 번호·이메일) */}
        <form method="GET" className="flex gap-2">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="체험권 번호(NO-끝6자) · 체험자/사장님 이메일"
            className="flex-1 h-11 px-3.5 rounded-md border border-hairline focus:border-brand focus:outline-none text-[14px]"
          />
          {st && <input type="hidden" name="st" value={st} />}
          <button type="submit" className="cp-action shrink-0 h-11 px-4 rounded-md bg-brand text-white text-[14px] font-bold">
            검색
          </button>
        </form>
        {/* 상태 필터 칩 */}
        <div className="mt-3 flex gap-1.5 flex-wrap">
          <a
            href={`/admin/passes${query ? `?q=${encodeURIComponent(q ?? "")}` : ""}`}
            className={`cp-action px-3 py-1.5 rounded-pill text-[12px] font-semibold ${!st ? "bg-ink text-white" : "bg-sunken text-muted"}`}
          >
            전체
          </a>
          {STATUSES.map((x) => (
            <a
              key={x}
              href={`/admin/passes?st=${x}${query ? `&q=${encodeURIComponent(q ?? "")}` : ""}`}
              className={`cp-action px-3 py-1.5 rounded-pill text-[12px] font-semibold ${st === x ? "bg-ink text-white" : "bg-sunken text-muted"}`}
            >
              {DISPLAY_BADGE[x].label}
            </a>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">최신 발급순 · 최대 {PAGE_SIZE}건 표시 — 검색으로 좁혀주세요. 모든 정정은 사유와 함께 감사 로그에 기록됩니다.</p>
      </section>

      <section className="px-5 mt-4 space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start">
        {rows.length === 0 && (
          <div className="rounded-md border border-dashed border-hairline p-10 text-center text-[14px] text-muted">
            조건에 맞는 체험권이 없습니다.
          </div>
        )}
        {rows.map(({ p, reviewer, owner, store, campaign, display }) => (
          <div key={p.id} className="rounded-lg border border-hairline bg-canvas p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[13px] font-bold text-ink tabular-nums shrink-0">{passRefNo(p.id)}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-pill font-semibold shrink-0 ${DISPLAY_BADGE[display].cls}`}>
                  {DISPLAY_BADGE[display].label}
                </span>
                {(p.resubmitCount ?? 0) > 0 && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded-pill bg-warningSoft text-warning font-semibold shrink-0">재제출 {p.resubmitCount}회</span>
                )}
              </div>
              <GradeBadge grade={p.reviewerGrade} size="sm" />
            </div>

            <div className="mt-2 text-[15px] font-bold text-ink truncate">{store?.name ?? "매장 미상"}</div>
            <div className="text-[12px] text-muted truncate">{campaign?.title ?? p.campaignId}</div>
            <div className="mt-1.5 space-y-0.5 text-[12px] text-ink2">
              <div className="truncate">
                체험자 {reviewer ? `${reviewer.nickname} (${reviewer.email})` : "(탈퇴 회원)"} · 사장님 {owner?.email ?? "(탈퇴 계정)"}
              </div>
              <div className="tabular-nums">
                발급 {fmt(p.issuedAt)} · 사용 {fmt(p.usedAt)} · 기한 {fmt(p.expiresAt)}
              </div>
              {/* 결제액·적용 지원금 — 어드민 최초 노출 (W 상생지수·상생 매출의 입력값) */}
              {p.usedAt && (
                <div className="tabular-nums">
                  결제 <b className="text-ink">{(p.paidAmount ?? 0).toLocaleString()}원</b> · 적용 지원금{" "}
                  <b className="text-ink">{(p.supportApplied ?? 0).toLocaleString()}원</b>
                  {p.receiptReview && " · 영수증 리뷰"}
                  {p.supportBoostPct ? ` · 부스트 +${p.supportBoostPct}%` : ""}
                </div>
              )}
              {p.reservation && (
                <div>
                  예약 {fmtReservationLabel(p.reservation.date, p.reservation.time)} ({p.reservation.status})
                </div>
              )}
              {p.status === "cancelled" && <div className="text-muted">{cancelledCopy(p.cancelledVia, p.cancelReason, p.cancelReasonCode)}</div>}
              {p.status === "rejected" && p.rejectReason && <div className="text-error">반려 사유: {p.rejectReason}</div>}
              {p.reviewUrl && (
                <a href={p.reviewUrl} target="_blank" rel="noopener noreferrer" className="cp-action inline-block text-brand font-semibold">
                  게시물 열기 ↗
                </a>
              )}
            </div>

            <PassFixActions
              passId={p.id}
              status={p.status}
              paidAmount={p.paidAmount ?? null}
              reviewerId={p.reviewerId}
              reviewerExists={!!reviewer}
              noShowCount={reviewer?.noShowCount ?? null}
            />
          </div>
        ))}
      </section>
    </div>
  );
}
