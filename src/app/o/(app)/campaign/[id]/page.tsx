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
  fmtReservationDateLabel,
  reservationDateOptions,
  campaignTimeSlots,
  scheduleOf,
  inBreakTime,
  slotCapacityOf,
  kstTodayStr,
} from "@/lib/reservation";
import ManageTabs from "./ManageTabs";
import BlocksManager from "./BlocksManager";

export const dynamic = "force-dynamic";

const KO_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 캠페인 상세 관리 (2026-07-23 개편) — 기본 정보·모집 현황 + [예약 관리 | 후기 관리] 2탭.
//  - 예약 관리: 접수 예약 확인·확정이 아니라(홈 [방문 예약] 큐 담당) **예약 가능 일정 차단** —
//    당일 일시 정지·특정 날짜 차단·특정 시간 차단 (§6, 예약형 전용)
//  - 후기 관리: 이 캠페인에 연결된 후기만 상태별 조회 (§12-3)
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

  // ── 예약 관리 탭 — 일정 차단 데이터 (§6, 향후 14일 + 예약 존재 경고용 카운트) ──
  const schedule = scheduleOf(c);
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
  const blockTimes = campaignTimeSlots(schedule)
    .filter((t) => !inBreakTime(schedule, t))
    .map((t) => ({ time: t, label: fmtTime12(t) }));
  const slotResCounts: Record<string, number> = {};
  for (const p of passes) {
    if (holdsSlot(p)) {
      const key = `${p.reservation!.date}|${p.reservation!.time}`;
      slotResCounts[key] = (slotResCounts[key] ?? 0) + 1;
    }
  }

  // ── 후기 관리 탭 — 이 캠페인에 연결된 후기 (§12-3: 작성 대기·심사 중·승인·반려) ──
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

  const reserveView = (
    <section className="px-5 pt-4">
      {/* 접수 예약의 확인·확정·제안은 홈 큐 담당 — 이 탭은 "더 이상 받을 수 없는 일정 차단" 전용 */}
      <div className="rounded-md bg-brandSoft px-3.5 py-3 text-[13px] text-ink2 leading-[1.55]">
        예약 요청 확인·확정·시간 제안은{" "}
        <Link href="/o/home" className="font-semibold text-brand underline">
          홈의 [방문 예약] 큐
        </Link>
        에서 해요. 여기서는 <b>더 이상 예약을 받을 수 없는 날짜·시간</b>을 막아둘 수 있어요.
      </div>
      <BlocksManager
        campaignId={c.id}
        days={blockDays}
        times={blockTimes}
        blockedSlots={(blocks.slots ?? []).filter((s) => s.date >= today)}
        slotResCounts={slotResCounts}
        pausedToday={blocks.pausedDate === today}
      />
    </section>
  );

  const reviewView = (
    <section className="px-5 pt-4">
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
  );

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

      {/* [예약 관리 | 후기 관리] 탭 (2026-07-23) — 방문형·배송형·종료 캠페인은 후기 관리 단독
          (종료 후에는 받을 예약이 없어 일정 차단이 무의미) */}
      <ManageTabs
        showReserve={isReserve && c.endAt > now}
        reviewCount={reviewRows.length}
        reserveView={reserveView}
        reviewView={reviewView}
      />
    </div>
  );
}
