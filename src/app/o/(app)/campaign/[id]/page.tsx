import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import Icon from "@/components/Icon";
import { SBUI, sbNum } from "@/lib/storyboard";
import { CHANNEL_LABEL } from "@/lib/channels";
import { photosForCampaign } from "@/lib/store-photo";
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
import CloseCampaign from "./CloseCampaign";
import ExpandableDesc from "./ExpandableDesc";
import ReservationManager from "../../manage/ReservationManager";
import { buildManagedReservations } from "../../manage/reservation-items";

export const dynamic = "force-dynamic";

const KO_DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const DAY_MS = 86400000;

// KST yyyy.mm.dd
const fmtKstDate = (t: number) => new Date(t + 9 * 3600000).toISOString().slice(0, 10).replaceAll("-", ".");

// 캠페인 상세 (2026-07-31 시안 개편) — [캠페인 관리 | 예약관리 | 후기] 탭.
//  - 캠페인 관리: 사진 캐러셀·배지·모집 마감 D-n·현황 타일·[캠페인 종료하기]·기본 정보·
//    모집 조건·매장 정보 + (예약형·미종료) 예약 일정 관리(구 '상태관리' 탭 흡수 — §6 일정 차단).
//  - 종료 캠페인: "모집마감" 표기, 종료 버튼·일정 차단 섹션·예약관리 탭 미제공.
//  - 후기: 이 캠페인에 연결된 후기만 상태별 조회 (§12-3)
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
  const ended = c.endAt <= now;
  const passes = db.passes.filter((p) => p.campaignId === c.id);
  // 조기 종료 확인 패널용 집계 (§조기 종료 2026-07-24)
  const activePasses = passes.filter((p) => p.status === "active");
  const closePendingRsv = activePasses.filter((p) => p.reservation && p.reservation.status !== "confirmed").length;
  const closeConfirmedRsv = activePasses.filter((p) => p.reservation?.status === "confirmed").length;
  const closeActiveQr = activePasses.length - closePendingRsv - closeConfirmedRsv;
  const totalQuota = c.quota.S + c.quota.A + c.quota.B + c.quota.C;
  const pendingCnt = activePasses.length;
  const visitedCnt = passes.filter((p) => ["used", "review_submitted", "completed"].includes(p.status)).length;
  const daysLeft = Math.max(0, Math.ceil((c.endAt - now) / DAY_MS));
  const runDays = Math.max(1, Math.ceil((c.endAt - c.startAt) / DAY_MS));
  const photos = photosForCampaign(c.photos, store.id, store.category);

  // ── 예약 일정 관리 — 일정 차단 데이터 (§6, 향후 14일 + 예약 존재 경고용 카운트) ──
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

  // ── 후기 탭 — 이 캠페인에 연결된 후기 (§12-3: 작성 대기·심사 중·승인·반려) ──
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

  // 예약관리 탭 (2026-07-28) — [관리]-[예약관리]와 동일 기능을 이 캠페인 범위로 (매장 필터 없음)
  const campaignReservations = buildManagedReservations(passes, [c], db.stores);

  const reservationsView = (
    <section className="pt-4">
      <ReservationManager items={campaignReservations} stores={[]} />
    </section>
  );

  // ── 캠페인 관리 탭 (시안) ──
  const infoView = (
    <div>
      {/* 사진 캐러셀 — [0]=대표사진 */}
      <div className="mt-4 pl-5 flex gap-2 overflow-x-auto scrollbar-none">
        {photos.map((src, i) => (
          <div key={i} className="relative shrink-0 last:mr-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`캠페인 사진 ${i + 1}`} className="w-[140px] h-[105px] rounded-md object-cover bg-sunken" />
            {i === 0 && (
              <span className="absolute left-1.5 bottom-1.5 px-1.5 py-0.5 rounded-xs bg-ink/70 text-white text-[10px] font-semibold">
                대표사진
              </span>
            )}
          </div>
        ))}
      </div>

      <section className="px-5 mt-3">
        {/* 배지 + 모집 마감 — 홈 신형 카드와 동일 체계 (시안 카피 = "바로 방문") */}
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded-xs bg-ink text-white text-[11px] font-semibold shrink-0">
            {isDelivery ? "배송형" : "방문형"}
          </span>
          {!isDelivery && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-xs text-[11px] font-semibold shrink-0 ${
                isReserve ? "bg-warningSoft text-ink" : "bg-successSoft text-successStrong"
              }`}
            >
              {isReserve ? "예약 필수" : "바로 방문"}
            </span>
          )}
          <span className="ml-auto text-[12px] text-muted tabular-nums shrink-0">
            {ended ? "모집마감" : `모집 마감 ${daysLeft}일 전`}
          </span>
        </div>

        <h2 className="mt-2.5 text-[18px] font-bold text-ink leading-[1.35] tracking-title line-clamp-2">{c.title}</h2>
        <div className="mt-0.5 text-[13px] text-muted">{store.name}</div>
        {store.address && <div className="mt-2 text-[13px] text-ink2">📍 {store.address}</div>}

        {/* 현황 타일 2×2 — 아래 줄 액센트는 시안 블루 → v2 퍼플 파스텔, 금액 값은 검정(v2 규칙) */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-sm bg-sunken px-3.5 py-3 flex items-center justify-between">
            <span className="text-[12px] text-muted">{isDelivery ? "발송 대기" : "방문 예정"}</span>
            <span className="text-[16px] font-bold text-ink tabular-nums">{pendingCnt}</span>
          </div>
          <div className="rounded-sm bg-sunken px-3.5 py-3 flex items-center justify-between">
            <span className="text-[12px] text-muted">{isDelivery ? "발송 완료" : "사용 완료"}</span>
            <span className="text-[16px] font-bold text-ink tabular-nums">
              {visitedCnt} / {totalQuota}
            </span>
          </div>
          <div className="rounded-sm bg-brandSoft px-3.5 py-3 flex items-center justify-between">
            <span className="text-[12px] text-ink2">지원금</span>
            <span className="text-[16px] font-bold text-ink tabular-nums">
              {sbNum(SBUI.support, `${c.supportAmount.toLocaleString()}원`)}
            </span>
          </div>
          <div className="rounded-sm bg-brandSoft px-3.5 py-3 flex items-center justify-between">
            <span className="text-[12px] text-ink2">매장 확인 번호</span>
            <span className="text-[16px] font-bold text-ink tabular-nums tracking-[0.15em]">{c.useCode}</span>
          </div>
        </div>
      </section>

      {/* 캠페인 조기 종료 (2026-07-24) — 진행 중일 때만 (종료 캠페인 미제공) */}
      {!ended && (
        <CloseCampaign
          campaignId={c.id}
          activeQr={closeActiveQr}
          confirmedRsv={closeConfirmedRsv}
          pendingRsv={closePendingRsv}
        />
      )}
      {ended && c.closedAt && (
        <p className="px-5 mt-3 text-[12px] text-muted leading-[1.55]">
          {c.closedBy === "admin" ? "운영팀이" : "사장님이"} 캠페인을 조기 종료했어요. 종료 전에 발급·확정된 체험 건은
          유효 기한까지 진행되며, 체험자가 참여하지 않으면 그 인원만큼 모집 현황이 자동 복원돼요.
        </p>
      )}

      <div className="mt-4 h-2 bg-sunken" />

      {/* 캠페인 기본 정보 */}
      <section className="px-5 mt-5">
        <h3 className="text-[16px] font-bold text-ink tracking-title">캠페인 기본 정보</h3>
        <div className="mt-3 rounded-lg border border-hairline px-4 divide-y divide-hairlineSoft">
          {[
            ["총 모집 인원", sbNum(SBUI.quota, `${totalQuota}명`)],
            ["캠페인 유형", isDelivery ? "배송형" : "방문형"],
            ["캠페인 방식", isDelivery ? "배송" : isReserve ? "예약 필수" : "바로 방문"],
            ["진행 일수", `${runDays}일`],
            ["모집 기간", sbNum(`${SBUI.date} ~ ${SBUI.date}`, `${fmtKstDate(c.startAt)} ~ ${fmtKstDate(c.endAt)}`)],
          ].map(([label, value]) => (
            <div key={label} className="py-3 flex items-center justify-between gap-3">
              <span className="text-[13px] text-muted shrink-0">{label}</span>
              <span className="text-[13px] font-semibold text-ink tabular-nums text-right">{value}</span>
            </div>
          ))}
          {/* 예약 운영 요약 (§2) — 예약형만 */}
          {isReserve && (
            <div className="py-3 text-[12px] text-ink2 leading-[1.6]">
              <span className="text-muted">예약 운영</span> ·{" "}
              {schedule.days.length === 7 ? "매일" : schedule.days.map((d) => KO_DAYS[d]).join("·")} ·{" "}
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

      {/* 모집 조건 */}
      <section className="px-5 mt-7">
        <h3 className="text-[16px] font-bold text-ink tracking-title">모집 조건</h3>
        <div className="mt-3 rounded-lg border border-hairline p-4 space-y-4">
          <div>
            <div className="text-[13px] font-semibold text-ink">SNS 채널</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.requiredChannels.map((ch) => (
                <span key={ch} className="inline-flex items-center h-8 px-3 rounded-pill border border-hairline text-[12px] text-ink">
                  {CHANNEL_LABEL[ch]}
                </span>
              ))}
            </div>
          </div>
          {c.requiredMenus.length > 0 && (
            <div>
              <div className="text-[13px] font-semibold text-ink">필수 주문 메뉴</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {c.requiredMenus.map((m) => (
                  <span key={m.name} className="inline-flex items-center h-8 px-3 rounded-pill border border-hairline text-[12px] text-ink">
                    {m.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {(c.highlightKeywords ?? []).length > 0 && (
            <div>
              <div className="text-[13px] font-semibold text-ink">필수 키워드 (최대 5개)</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(c.highlightKeywords ?? []).map((k) => (
                  <span key={k} className="inline-flex items-center h-8 px-3 rounded-pill border border-hairline text-[12px] text-ink">
                    #{k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 매장 정보 */}
      <section className="px-5 mt-7">
        <h3 className="text-[16px] font-bold text-ink tracking-title">매장 정보</h3>
        <div className="mt-3 rounded-lg border border-hairline p-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-hairlineSoft">
            <span className="text-[13px] text-muted">카테고리</span>
            <span className="text-[13px] font-semibold text-ink">{store.category}</span>
          </div>
          <div className="pt-3">
            <div className="text-[13px] text-muted">매장소개</div>
            <div className="mt-2">
              {c.description ? (
                <ExpandableDesc text={c.description} />
              ) : (
                <p className="text-[13px] text-muted">등록된 매장 소개가 없어요.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 예약 일정 관리 (§6 — 구 '상태관리' 탭 흡수) — 예약형·미종료만.
          종료 캠페인은 받을 예약이 없어 당일 일시중지·날짜/시간 차단 섹션을 제공하지 않는다. */}
      {isReserve && !ended && (
        <section className="px-5 mt-7">
          <h3 className="text-[16px] font-bold text-ink tracking-title">예약 일정 관리</h3>
          <div className="mt-3 rounded-md bg-brandSoft px-3.5 py-3 text-[13px] text-ink2 leading-[1.55]">
            예약 요청 확인·확정·시간 제안은 <b className="text-brand">[예약관리]</b> 탭에서 해요. 여기서는{" "}
            <b>더 이상 예약을 받을 수 없는 날짜·시간</b>을 막아둘 수 있어요.
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
      )}
    </div>
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
          <h1 className="flex-1 text-center pr-10 text-[17px] font-bold text-ink tracking-title truncate">캠페인 상세</h1>
        </div>
      </div>

      {/* [캠페인 관리 | 예약관리 | 후기] (2026-07-31 시안 개편 — 구 '상태관리'는 캠페인 관리 탭
          하단 '예약 일정 관리' 섹션으로 흡수). 예약관리 탭은 예약형·미종료 전용. */}
      <ManageTabs
        showReserve={isReserve && !ended}
        reservationCount={campaignReservations.filter((r) => r.state === "requested" || r.state === "counter").length}
        reviewCount={reviewRows.length}
        infoView={infoView}
        reservationsView={reservationsView}
        reviewView={reviewView}
      />
    </div>
  );
}
