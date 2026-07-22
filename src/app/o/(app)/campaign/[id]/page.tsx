import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import Icon from "@/components/Icon";
import { SBUI, sbNum } from "@/lib/storyboard";
import { fmtKoDateTime } from "@/lib/dates";
import {
  fmtReservationLabel,
  fmtTime12,
  reservationEpoch,
  reservationHistoryLines,
  reservationDateOptions,
  fmtReservationDateLabel,
  campaignDateOptions,
  campaignTimeSlots,
  scheduleOf,
  inBreakTime,
  slotCapacityOf,
  ownerProposalUsed,
  reviewerCounterUsed,
  kstTodayStr,
} from "@/lib/reservation";
import ReservationManage, { type ManageItem } from "./ReservationManage";
import BlocksManager from "./BlocksManager";

export const dynamic = "force-dynamic";

const KO_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 캠페인 상세 관리 (2026-07-22 §12) — 기본 정보·모집 현황·예약 요청 목록(상태/날짜 필터)·
// 예약 가능 일정 관리(날짜/시간 차단·당일 중지)·확정 예약 취소·캠페인별 후기.
export default async function OwnerCampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentOwner();
  const { id } = await params;
  const db = await getDBAsync();
  const c = db.campaigns.find((x) => x.id === id);
  if (!c) return notFound();
  const store = db.stores.find((s) => s.id === c.storeId);
  if (!store || store.ownerId !== me.id) return notFound();

  const now = Date.now();
  const isReserve = c.kind === "visit" && !!c.reservationRequired;
  const isDelivery = c.kind === "delivery";
  const passes = db.passes.filter((p) => p.campaignId === c.id);
  const totalQuota = c.quota.S + c.quota.A + c.quota.B + c.quota.C;
  const pendingCnt = passes.filter((p) => p.status === "active").length;
  const visitedCnt = passes.filter((p) => ["used", "review_submitted", "completed"].includes(p.status)).length;

  // ── 예약 요청 목록 (§12-2) — 활성뿐 아니라 종결(취소·거절·만료·방문 완료)까지 전 상태 ──
  const manageItems: ManageItem[] = isReserve
    ? passes
        .filter((p) => p.reservation)
        .map((p) => {
          const rsv = p.reservation!;
          let statusKey: ManageItem["statusKey"];
          let statusLabel: string;
          let subLabel = "";
          if (p.status === "active") {
            statusKey = rsv.status;
            statusLabel =
              rsv.status === "confirmed"
                ? "예약 확정"
                : rsv.status === "proposed"
                  ? "일정 제안 중"
                  : reviewerCounterUsed(rsv)
                    ? "체험자 일정 재요청"
                    : "예약 대기";
          } else if (["used", "review_submitted", "completed"].includes(p.status)) {
            statusKey = "visited";
            statusLabel = "방문 완료";
          } else if (p.status === "cancelled") {
            statusKey = "cancelled";
            statusLabel = "취소";
            // 운영·CS 구분 (§5-4) — 거절·사용자 취소·사장님 취소를 명확히 표기
            subLabel =
              p.cancelledVia === "owner_declined"
                ? "매장 거절 (또는 미응답 자동 취소)"
                : p.cancelledVia === "owner_cancelled"
                  ? `매장 취소${p.cancelReason ? ` · ${p.cancelReason}` : ""}`
                  : p.cancelledVia === "admin_cancelled"
                    ? "운영팀 취소"
                    : p.cancelledVia === "proposal_declined"
                      ? "체험자 제안 거절"
                      : "체험자 취소";
          } else {
            statusKey = "expired";
            statusLabel = "만료 (미방문)";
          }
          return {
            passId: p.id,
            masked: `#${p.reviewerId.slice(-4)}`,
            label: fmtReservationLabel(rsv.date, rsv.time),
            partySize: rsv.partySize,
            requestedAtLabel: fmtKoDateTime(rsv.requestedAt), // 예약 신청일 (§4-1)
            statusKey,
            statusLabel,
            subLabel,
            epoch: reservationEpoch(rsv.date, rsv.time),
            history: reservationHistoryLines(rsv).map((h) => ({
              prefix: h.prefix,
              timeLabel: h.timeLabel,
              ...(h.note ? { note: h.note } : {}),
            })),
            proposalUsed: ownerProposalUsed(rsv),
          };
        })
        .sort((a, b) => a.epoch - b.epoch) // 가까운 예약 일정 우선 (§12-2)
    : [];

  // 제안 폼 선택지 — 스케줄 기준 (§2-2)
  const schedule = scheduleOf(c);
  const proposeDates = campaignDateOptions(c, now).map((d) => ({ date: d.date, label: d.label, disabled: d.disabled }));
  const proposeTimes = campaignTimeSlots(schedule)
    .filter((t) => !inBreakTime(schedule, t))
    .map((t) => ({ time: t, label: fmtTime12(t) }));

  // ── 일정 차단 관리 데이터 (§6) — 향후 14일 + 예약 존재 경고용 카운트 ──
  const blocks = c.reservationBlocks ?? {};
  const today = kstTodayStr(now);
  const holdsSlot = (p: (typeof passes)[number]) => p.status === "active" && p.reservation;
  const blockDays = reservationDateOptions(c.endAt, now).map((date) => ({
    date,
    label: fmtReservationDateLabel(date),
    dayOff: !schedule.days.includes(new Date(Date.parse(`${date}T00:00:00Z`)).getUTCDay()),
    blocked: (blocks.dates ?? []).includes(date),
    resCount: passes.filter((p) => holdsSlot(p) && p.reservation!.date === date).length,
  }));
  const slotResCounts: Record<string, number> = {};
  for (const p of passes) {
    if (holdsSlot(p)) {
      const key = `${p.reservation!.date}|${p.reservation!.time}`;
      slotResCounts[key] = (slotResCounts[key] ?? 0) + 1;
    }
  }

  // ── 캠페인별 후기 (§12-3) — 리뷰 대기·심사 중·승인·반려를 예약 정보와 함께 ──
  const reviewRows = passes
    .filter((p) => ["used", "review_submitted", "completed", "rejected"].includes(p.status))
    .sort((a, b) => (b.usedAt ?? b.issuedAt) - (a.usedAt ?? a.issuedAt))
    .map((p) => ({
      id: p.id,
      masked: `#${p.reviewerId.slice(-4)}`,
      status:
        p.status === "used"
          ? "리뷰 작성 대기"
          : p.status === "review_submitted"
            ? "심사 중"
            : p.status === "completed"
              ? "승인"
              : "반려",
      tone: p.status === "completed" ? "ok" : p.status === "rejected" ? "bad" : "wait",
      reservationLabel: p.reservation ? fmtReservationLabel(p.reservation.date, p.reservation.time) : null,
      reviewUrl: p.reviewUrl ?? null,
    }));

  const opensAt = c.reservationSchedule?.opensAt;

  return (
    <div className="pb-24 bg-canvas min-h-[100dvh]">
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-3 flex items-center">
          <Link href="/o/home" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="홈으로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
          <h1 className="text-[18px] font-bold text-ink tracking-title truncate">캠페인 관리</h1>
        </div>
      </div>

      {/* 기본 정보 + 모집 현황 (§12-1) */}
      <section className="px-5 pt-2">
        <div className="rounded-lg border border-hairline p-4">
          <div className="flex items-center gap-1.5">
            {isReserve && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-xs bg-brandSoft text-brand text-[11px] font-semibold shrink-0">
                📅 예약형
              </span>
            )}
            {isDelivery && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-xs bg-brandSoft text-brand text-[11px] font-semibold shrink-0">
                📦 배송
              </span>
            )}
            <span className="text-[16px] font-bold text-ink truncate">{c.title}</span>
          </div>
          <div className="mt-1 text-[12px] text-muted">
            {store.name} · {sbNum(SBUI.dateTime, fmtKoDateTime(c.endAt))} 종료 (D-
            {Math.max(0, Math.floor((c.endAt - now) / 86400000))})
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-sm py-2.5 bg-sunken">
              <div className="text-[11px] text-muted">{isDelivery ? "발송 대기" : "방문 예정"}</div>
              <div className="text-[15px] font-semibold text-ink tabular-nums mt-0.5">{pendingCnt}명</div>
            </div>
            <div className="rounded-sm py-2.5 bg-sunken">
              <div className="text-[11px] text-muted">{isDelivery ? "발송 완료" : "방문 완료"}</div>
              <div className="text-[15px] font-semibold text-ink tabular-nums mt-0.5">{visitedCnt}명</div>
            </div>
            <div className="rounded-sm py-2.5 bg-sunken">
              <div className="text-[11px] text-muted">🎫 총 모집</div>
              <div className="text-[15px] font-semibold text-ink tabular-nums mt-0.5">{totalQuota}명</div>
            </div>
          </div>

          {/* 예약 운영 요약 (§2) */}
          {isReserve && (
            <div className="mt-3 pt-3 border-t border-hairlineSoft text-[12px] text-ink2 leading-[1.6]">
              예약 가능: {schedule.days.length === 7 ? "매일" : schedule.days.map((d) => KO_DAYS[d]).join("·")} ·{" "}
              {fmtTime12(schedule.open)} ~ {schedule.close === "24:00" ? "오전 12시" : fmtTime12(schedule.close)}
              {schedule.breakStart && schedule.breakEnd && (
                <> · 브레이크 {fmtTime12(schedule.breakStart)}~{fmtTime12(schedule.breakEnd)}</>
              )}
              {" · "}같은 시간 최대 {slotCapacityOf(c)}팀
              {opensAt && opensAt > now && <> · 예약 오픈 {fmtReservationDateLabel(kstTodayStr(opensAt))} 예정</>}
            </div>
          )}
        </div>
      </section>

      {isReserve && (
        <>
          {/* 예약 요청 목록 — 상태 필터·가까운 일정 우선·확정/제안/거절/확정 취소 (§12-2, §4, §5) */}
          <section className="px-5 mt-6">
            <h2 className="text-[16px] font-bold text-ink tracking-title">예약 요청</h2>
            <ReservationManage items={manageItems} proposeDates={proposeDates} proposeTimes={proposeTimes} />
          </section>

          {/* 예약 가능 일정 관리 — 날짜/시간 차단·당일 일시중지 (§6) */}
          <section className="px-5 mt-8">
            <h2 className="text-[16px] font-bold text-ink tracking-title">예약 가능 일정 관리</h2>
            <BlocksManager
              campaignId={c.id}
              days={blockDays}
              times={proposeTimes}
              blockedSlots={(blocks.slots ?? []).filter((s) => s.date >= today)}
              slotResCounts={slotResCounts}
              pausedToday={blocks.pausedDate === today}
            />
          </section>
        </>
      )}

      {/* 캠페인별 후기 (§12-3) — 예약 정보와 리뷰 상태를 함께 */}
      <section className="px-5 mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-ink tracking-title">이 캠페인의 후기</h2>
          <Link href="/o/reviews" className="cp-action text-[13px] font-semibold text-brand">전체 후기 →</Link>
        </div>
        <div className="mt-3 space-y-2">
          {reviewRows.length === 0 && (
            <div className="rounded-md border border-dashed border-hairline p-5 text-center text-[13px] text-muted">
              아직 등록된 후기가 없어요.
            </div>
          )}
          {reviewRows.map((r) => (
            <div key={r.id} className="rounded-md border border-hairline px-3.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-ink">익명 {r.masked}</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-pill text-[11px] font-semibold ${
                    r.tone === "ok"
                      ? "bg-successSoft text-successStrong"
                      : r.tone === "bad"
                        ? "bg-errorSoft text-error"
                        : "bg-sunken text-muted"
                  }`}
                >
                  {r.status}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[12px] text-muted">
                <span className="tabular-nums">{r.reservationLabel ? `📅 ${sbNum(SBUI.dateTime, r.reservationLabel)} 방문` : "방문 체험"}</span>
                {r.reviewUrl && (
                  <a href={r.reviewUrl} target="_blank" rel="noreferrer" className="cp-action shrink-0 font-semibold text-brand">
                    리뷰 보기 →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
