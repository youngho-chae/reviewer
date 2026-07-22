import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { supportForGrade } from "@/lib/grade";
import { passDisplayStatus } from "@/lib/pass-display";
import { CHANNEL_LABEL, defaultChannel } from "@/lib/channels";
import { findSupportBoost, boostedLimit } from "@/lib/referral";
import { REVIEW_DEADLINE_MS, SHIP_DELAY_NOTICE_MS } from "@/lib/pass-lifecycle";
import { readRecentPasses } from "@/lib/recent-passes-cookie";
import { courierLabel, trackingUrl } from "@/lib/couriers";
import { STORYBOARD } from "@/lib/storyboard";
import { fmtKoDateTime } from "@/lib/dates";
import GradeBadge from "@/components/GradeBadge";
import Icon from "@/components/Icon";
import { SBUI, sbNum } from "@/lib/storyboard";
import ReviewForm from "./ReviewForm";
import Countdown from "./Countdown";
import PassTicket from "./PassTicket";
import CancelPassButton from "./CancelPassButton";
import ReservationPanel from "./ReservationPanel";
import ReservationRespond from "./ReservationRespond";
import { fmtReservationLabel, reservationHistoryLines, reviewerCounterUsed } from "@/lib/reservation";

export const dynamic = "force-dynamic";

export default async function PassDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentReviewer();
  const { id } = await params;
  const db = await getDBAsync();

  // 1차: db에서 찾기
  let pass = db.passes.find((p) => p.id === id);
  let store = pass ? db.stores.find((s) => s.id === pass!.storeId) : undefined;
  let campaign = pass ? db.campaigns.find((c) => c.id === pass!.campaignId) : undefined;

  // 2차: 쿠키 stopgap (멀티 인스턴스 + KV 미연결 케이스)
  if (!pass) {
    const recent = await readRecentPasses();
    const hit = recent.find((r) => r.pass.id === id && r.pass.reviewerId === me.id);
    if (hit) {
      pass = hit.pass;
      store = hit.store as any;
      campaign = hit.campaign as any;
    }
  }

  // 3차: 그래도 못 찾으면 동기화 폴링 안전망으로
  if (!pass) redirect(`/r/passes?pending=${encodeURIComponent(id)}`);
  if (pass.reviewerId !== me.id) return notFound();

  if (pass.status === "active" && Date.now() > pass.expiresAt) {
    pass.status = "expired";
  }

  // 이 체험권으로 받을 수 있는 지원금 = 기준 지원금 × 채널 등급 배율
  const entitledSupport = supportForGrade(campaign?.supportAmount ?? 0, pass.reviewerGrade);
  // 초대 보상(지원금 부스트) 보유 시 사용 처리 단계에서 자동 가산 — 미리 보여준다
  const boost = pass.status === "active" ? findSupportBoost(db, me.id) : null;
  const displaySupport = boost
    ? boostedLimit(campaign?.supportAmount ?? 0, entitledSupport, boost.value)
    : entitledSupport;

  // 배송형 (2026-07-12 레뷰 벤치마크) — QR 없음. active = 발송 대기 (발송 처리 전 취소 가능)
  const isDelivery = campaign?.kind === "delivery";
  if (pass.status === "active" && isDelivery) {
    return (
      <div className="pb-24 bg-canvas min-h-[100dvh]">
        <div className="sticky top-0 z-10 bg-canvas">
          <div className="h-[52px] px-3 flex items-center gap-1">
            <Link href="/r/passes" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="내 체험권으로">
              <Icon name="chevron-left" variant="border" size={22} />
            </Link>
            <div className="text-[18px] font-bold text-ink tracking-title">배송 체험</div>
          </div>
        </div>

        <section className="px-5 pt-6 text-center">
          <div className="flex justify-center mb-3">
            <GradeBadge grade={pass.reviewerGrade} size="lg" />
          </div>
          <h1 className="text-[20px] font-bold text-ink tracking-title leading-[1.3]">{store?.name}</h1>
          <p className="mt-1.5 text-[14px] text-ink2">{store?.category} · 전국 택배</p>
        </section>

        <div className="px-5 mt-6">
          <div className="rounded-md bg-brandSoft px-4 py-4 text-center">
            <div className="text-[15px] font-bold text-brand">📦 발송 대기 중</div>
            <p className="mt-1.5 text-[13px] text-ink2 leading-[1.55]">
              사장님이 상품을 발송하면 알림으로 알려드려요.
              <br />
              발송 후 7일 이내에 리뷰를 등록해주세요.
            </p>
          </div>

          {/* 발송 지연 안내 (2026-07-16 리뷰노트 벤치마크) — 표시 전용, 리뷰 기한은 발송 후 롤링이라 불이익 없음 */}
          {Date.now() - pass.issuedAt > SHIP_DELAY_NOTICE_MS && (
            <div className="mt-3 rounded-md bg-warningSoft px-4 py-3 text-[13px] text-ink2 leading-[1.55]">
              <span className="font-bold text-warning">발송이 늦어지고 있어요</span> — 신청 후{" "}
              {Math.floor((Date.now() - pass.issuedAt) / 86400000)}일이 지났어요. 리뷰 기한은 발송된 뒤부터
              계산되니 불이익은 없고, 발송 전에는 언제든 취소할 수 있어요.
            </div>
          )}

          {pass.shipping && (
            <div className="mt-4 rounded-md border border-hairline p-4">
              <div className="text-[13px] font-bold text-ink">배송지</div>
              <div className="mt-2 text-[14px] text-ink leading-[1.6]">
                {pass.shipping.recipient} · {pass.shipping.phone}
                <br />
                <span className="text-ink2">{pass.shipping.address}</span>
              </div>
              {pass.shipping.option && (
                <div className="mt-2 text-[13px] text-ink">
                  <span className="text-muted">선택 옵션</span> · <span className="font-semibold">{pass.shipping.option}</span>
                </div>
              )}
              <p className="mt-2 text-[11px] text-muted">배송지 정보는 상품 발송 목적으로만 사장님에게 전달돼요.</p>
            </div>
          )}

          {/* 발송 처리 전에만 취소 가능 — 발송 후에는 취소 불가 (벤치마크 §3.2) */}
          <div className="mt-8 pb-12 text-center">
            <CancelPassButton passId={pass.id} />
          </div>
        </div>
      </div>
    );
  }

  // 예약형 — 예약 확정 전에는 QR·코드를 노출하지 않는다 (2026-07-16 v2 회의).
  // requested = 사장님 확인 대기(예약 변경 가능) / proposed = 사장님 시간 제안 응답 대기(수락·기타·거절).
  if (pass.status === "active" && pass.reservation && pass.reservation.status !== "confirmed") {
    const rsv = pass.reservation;
    const proposalSlots = (rsv.proposal?.slots ?? []).map((sl) => ({
      date: sl.date,
      time: sl.time,
      label: fmtReservationLabel(sl.date, sl.time),
    }));
    // 협상 히스토리 (v3) — 양측 동일 타임라인
    const rsvHistory = reservationHistoryLines(rsv).map((h) => ({
      prefix: h.prefix,
      timeLabel: h.timeLabel,
      ...(h.note ? { note: h.note } : {}),
    }));
    return (
      <div className="pb-24 bg-canvas min-h-[100dvh]">
        <div className="sticky top-0 z-10 bg-canvas">
          <div className="h-[52px] px-3 flex items-center gap-1">
            <Link href="/r/passes" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="내 체험권으로">
              <Icon name="chevron-left" variant="border" size={22} />
            </Link>
            <div className="text-[18px] font-bold text-ink tracking-title">예약 방문</div>
          </div>
        </div>

        <section className="px-5 pt-6 text-center">
          <div className="flex justify-center mb-3">
            <GradeBadge grade={pass.reviewerGrade} size="lg" />
          </div>
          <h1 className="text-[20px] font-bold text-ink tracking-title leading-[1.3]">{store?.name}</h1>
          <p className="mt-1.5 text-[14px] text-ink2">{store?.area} · {store?.category}</p>
        </section>

        <div className="mx-5 mt-6 rounded-md bg-brandSoft px-4 py-4 text-center">
          <div className="text-[15px] font-bold text-brand">
            {rsv.status === "proposed" ? "📅 사장님이 다른 시간을 제안했어요" : "📅 예약 확인 대기 중"}
          </div>
          <p className="mt-1.5 text-[13px] text-ink2 leading-[1.55]">
            {rsv.status === "proposed"
              ? "아래에서 시간을 선택해 예약을 확정해주세요."
              : "사장님이 예약을 확인하면 알림을 드리고, 체험권 QR이 열려요."}
          </p>
        </div>

        {rsv.status === "proposed" ? (
          <ReservationRespond
            passId={pass.id}
            slots={proposalSlots}
            note={rsv.proposal?.note}
            endAt={campaign?.endAt ?? pass.expiresAt}
            historyLines={rsvHistory}
            counterUsed={reviewerCounterUsed(rsv)}
          />
        ) : (
          <ReservationPanel
            passId={pass.id}
            date={rsv.date}
            time={rsv.time}
            status={rsv.status}
            endAt={campaign?.endAt ?? pass.expiresAt}
            historyLines={rsvHistory}
          />
        )}

        {/* 확정 전에는 취소 접근 유지 (QR 인증 화면 아님 — §8-1과 충돌 없음) */}
        <div className="mt-8 pb-12 text-center">
          <CancelPassButton passId={pass.id} />
        </div>
      </div>
    );
  }

  // Active state — QR 스캔 / 코드 입력 세그먼트 (2026-07-08 시안 개편)
  if (pass.status === "active") {
    return (
      <div className="fixed inset-0 z-30 mx-auto max-w-[480px] bg-canvas overflow-y-auto">
        {/* top-app-bar — ← + 중앙 타이틀 */}
        <div className="sticky top-0 z-10 bg-canvas">
          <div className="h-[52px] px-3 grid grid-cols-[40px_1fr_40px] items-center">
            <Link
              href="/r/passes"
              className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink"
              aria-label="내 체험권으로"
            >
              <Icon name="chevron-left" variant="border" size={22} />
            </Link>
            <h1 className="text-[16px] font-bold text-ink tracking-title text-center">체험권</h1>
            <span />
          </div>
        </div>

        <PassTicket
          passId={pass.id}
          code={pass.code}
          storeName={store?.name ?? "매장"}
          channelLabel={pass.reviewChannel ? CHANNEL_LABEL[pass.reviewChannel] : "채널 미정"}
          grade={pass.reviewerGrade}
          support={displaySupport}
          expiresAt={pass.expiresAt}
        />

        {/* 예약 방문 패널 (2026-07-16 리뷰노트 벤치마크) — 예약 일시·상태 + 예약 변경 + 협상 히스토리 */}
        {pass.reservation && (
          <ReservationPanel
            passId={pass.id}
            date={pass.reservation.date}
            time={pass.reservation.time}
            status={pass.reservation.status}
            endAt={campaign?.endAt ?? pass.expiresAt}
            historyLines={reservationHistoryLines(pass.reservation).map((h) => ({
              prefix: h.prefix,
              timeLabel: h.timeLabel,
              ...(h.note ? { note: h.note } : {}),
            }))}
          />
        )}

        {/* [2026-07-12 회의 §8-1] QR 인증 화면에서 참여 취소 제거 — 매장 직원과 함께 쓰는
            인증 중심 화면으로 단순화. 방문 취소는 내 체험권 리스트의 [참여 취소]에서. */}
        <div className="pb-12" />
      </div>
    );
  }

  // 리뷰 제출 화면 (2026-07-17 시안 개편) — used(작성)·rejected(재제출, 기자단 제외) 공용 레이아웃:
  // 히어로(매장명·혜택·마감 카드) → [반려 시] 반려 사유 카드 → 파스텔 채널 배너 → URL·최종 확인 폼.
  if (pass.status === "used" || (pass.status === "rejected" && campaign?.kind !== "press")) {
    const isRejected = pass.status === "rejected";
    const channel = pass.reviewChannel ?? defaultChannel(campaign?.requiredChannels ?? []) ?? "naver_blog";
    // 파스텔 채널 배너 — 디자인 시스템 SNS 토큰 재사용 (블로그 그린 / 인스타 핑크 / 틱톡 틸)
    const banner = {
      naver_blog: { label: "네이버 블로그", box: "bg-snsBlogBg", strong: "text-snsBlogText" },
      instagram: { label: "인스타", box: "bg-snsInstaBg", strong: "text-snsInstaText" },
      tiktok: { label: "틱톡", box: "bg-snsTiktokBg", strong: "text-snsTiktokText" },
    }[channel];
    // 마감 기산점 — used: 이용 후 7일 / rejected: 반려 후 7일 (1회 재제출)
    const deadline = isRejected
      ? (pass.rejectedAt ?? Date.now()) + REVIEW_DEADLINE_MS
      : (pass.usedAt ?? Date.now()) + REVIEW_DEADLINE_MS;
    const display = passDisplayStatus(pass);
    const closed = display === "overdue" || display === "resubmit_expired"; // 기한 초과·재제출 소진 — 폼 미노출
    const myPoint = isDelivery && campaign?.pointReward ? supportForGrade(campaign.pointReward, pass.reviewerGrade) : 0;
    const track = isDelivery ? trackingUrl(pass.courier, pass.trackingNo) : null;
    // 반려 사유 — 줄바꿈 단위로 번호 목록 렌더 (어드민 입력 원문)
    const rejectReasons = isRejected
      ? String(pass.rejectReason ?? "작성 조건 미충족 (자세한 내용은 고객센터 문의)")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    return (
      <div className="pb-44 bg-canvas min-h-[100dvh]">
        <div className="sticky top-0 z-10 bg-canvas">
          <div className="h-[52px] px-3 grid grid-cols-[40px_1fr_40px] items-center">
            <Link href="/r/passes" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="내 체험권으로">
              <Icon name="chevron-left" variant="border" size={22} />
            </Link>
            <h1 className="text-[16px] font-bold text-ink tracking-title text-center">리뷰 제출</h1>
            <span />
          </div>
        </div>

        {/* 히어로 — 매장명(최대 2줄) + 받은 혜택 + 리뷰마감 카운트다운 카드 */}
        <section className="bg-parchment px-5 pt-5 pb-6">
          <h2 className="text-[20px] font-bold text-ink tracking-title leading-[1.3] line-clamp-2">{store?.name}</h2>
          <p className="mt-1.5 text-[15px] text-ink">
            {isDelivery ? (
              myPoint > 0 ? (
                <>
                  검수 승인 시{" "}
                  <span className="font-bold text-[#FF6B00] tabular-nums">{sbNum(SBUI.point, `+${myPoint.toLocaleString()}P`)}</span>{" "}
                  적립돼요!
                </>
              ) : (
                <>제품을 받아 체험했어요 — 리뷰를 남겨주세요!</>
              )
            ) : (
              <>
                총{" "}
                <span className="font-bold text-[#FF6B00] tabular-nums">
                  {sbNum(SBUI.support, `${(pass.supportApplied ?? entitledSupport).toLocaleString()}원`)}
                </span>{" "}
                지원 받았어요!
              </>
            )}
          </p>
          <div className="mt-4 rounded-lg border-[1.5px] border-brand bg-canvas px-4 py-3.5 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-[15px] font-bold text-brand shrink-0">
              <span aria-hidden>🕐</span>
              {isRejected ? "재제출 기한" : "리뷰마감"}
            </span>
            <div className="text-right">
              {closed ? (
                <div className="text-[18px] font-bold text-error">마감 지남</div>
              ) : (
                <Countdown expiresAt={deadline} mode="dhm" className="!text-[20px] !text-brand" expiredText="마감 지남" />
              )}
              <div className="mt-0.5 text-[12px] text-ink2 tabular-nums">{sbNum(SBUI.dateTime, fmtKoDateTime(deadline))}까지</div>
            </div>
          </div>

          {/* 반려 사유 카드 (2026-07-17 시안) — 반려 안내 + 번호 목록 */}
          {isRejected && (
            <div className="mt-3 rounded-lg border-[1.5px] border-error bg-canvas p-4">
              <div className="rounded-md bg-errorSoft px-4 py-3 text-center">
                <div className="text-[15px] font-bold text-error">리뷰가 반려되었어요</div>
                <div className="mt-0.5 text-[12px] text-ink2">반려 후 7일 이내 1회 재제출 할 수 있어요</div>
              </div>
              <ol className="mt-3 space-y-2.5 px-1">
                {rejectReasons.map((reason, i) => (
                  <li key={i} className="flex gap-2 text-[15px] font-semibold text-ink leading-[1.45]">
                    <span className="shrink-0 tabular-nums">{i + 1}.</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        {/* 파스텔 채널 배너 — 참여 채널 고정 표기 */}
        <div className={`mx-5 mt-5 rounded-lg px-4 py-4 text-center text-[15px] text-ink ${banner.box}`}>
          이번 체험은 <span className={`font-bold ${banner.strong}`}>{banner.label}</span> 참여했어요
        </div>

        {/* 배송형 — 운송장·배송 조회 유지 */}
        {isDelivery && pass.trackingNo && (
          <div className="mx-5 mt-3 rounded-lg border border-hairline px-4 py-3.5 flex items-center justify-between gap-2">
            <span className="text-[13px] text-ink2 tabular-nums truncate">
              📦 {courierLabel(pass.courier)} 운송장 {STORYBOARD ? SBUI.trackingNo : pass.trackingNo}
            </span>
            {!STORYBOARD && track && (
              <a href={track} target="_blank" rel="noreferrer" className="cp-action shrink-0 text-[13px] font-semibold text-brand">
                배송 조회 →
              </a>
            )}
          </div>
        )}

        {closed ? (
          /* 기한 초과·재제출 소진 — 서버(/api/passes/review)도 차단하므로 폼 대신 안내만 */
          <div className="mx-5 mt-8 rounded-md bg-sunken p-5 text-[14px] text-muted leading-[1.6]">
            {isRejected
              ? "재제출 기한(반려 후 7일)이 지났거나 재제출 횟수(1회)를 모두 사용해 다시 제출할 수 없어요."
              : "리뷰 제출 기한(이용 후 7일)이 지나 제출할 수 없어요. 기한 초과는 등급 재평가에 감점으로 반영돼요."}
          </div>
        ) : (
          <ReviewForm passId={pass.id} storeId={pass.storeId} channel={channel} resubmit={isRejected} />
        )}
      </div>
    );
  }

  // Other states — light canvas product page
  return (
    <div className="pb-24 bg-canvas min-h-[100dvh]">
      {/* top-app-bar — 화이트 52px */}
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-3 flex items-center gap-1">
          <Link href="/r/passes" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="내 체험권으로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
          <div className="text-[18px] font-bold text-ink tracking-title">체험권 상세</div>
        </div>
      </div>

      {/* 헤더 — 화이트 캔버스 */}
      <section className="px-5 pt-6 pb-6 text-center">
        <div className="flex justify-center mb-3">
          <GradeBadge grade={pass.reviewerGrade} size="lg" />
        </div>
        <h1 className="text-[20px] font-bold text-ink tracking-title leading-[1.3]">{store?.name}</h1>
        {/* [확정 정책 7] 캠페인명은 사장님 내부 관리용 — 체험자에게는 매장명 중심 노출 */}
        <p className="mt-1.5 text-[14px] text-ink2">{store?.area} · {store?.category}</p>
        <p className="mt-1 text-[13px] text-muted">
          {isDelivery ? (
            <>제품 제공{campaign?.pointReward ? <> + 포인트 <span className="font-bold text-ink tabular-nums">{SBUI.point}</span></> : null}</>
          ) : (
            <>지원금 <span className="font-bold text-ink tabular-nums">{SBUI.support}</span></>
          )}
          {pass.reviewChannel ? ` · ${CHANNEL_LABEL[pass.reviewChannel]} ${pass.reviewerGrade}등급` : ""}
        </p>
      </section>

      <div className="px-5">
        {pass.status === "review_submitted" && (
          <div className="mt-6 rounded-md border border-hairline bg-canvas p-5 text-[15px] text-ink">
            ✓ 리뷰가 등록되었습니다. 운영팀이 광고 표시·작성 조건을 검수합니다 (영업일 기준 최대 3일).
          </div>
        )}
        {pass.status === "completed" && (
          <>
            <div className="mt-6 rounded-md bg-successSoft p-5 text-[15px] text-ink">
              <span className="text-successStrong font-semibold">✓ 리뷰 검수 통과.</span> 등급 점수가 반영되었습니다.
            </div>
          </>
        )}
        {pass.status === "expired" && (
          <div className="mt-6 rounded-md bg-sunken p-5 text-[15px] text-muted">
            {isDelivery
              ? "캠페인이 종료될 때까지 발송이 진행되지 않아 만료된 신청입니다. 모집 자리는 다른 체험자에게 돌아갔어요."
              : "사용 기한(발급 후 72시간)이 지나 만료된 체험권입니다. 만료된 체험권은 연장·복구되지 않으며, 모집 자리는 다른 체험자에게 돌아갔어요."}
          </div>
        )}
        {pass.status === "cancelled" && (
          <div className="mt-6 rounded-md bg-sunken p-5 text-[15px] text-muted">
            {pass.cancelledVia === "proposal_declined"
              ? "예약 일정이 맞지 않아 취소된 신청입니다. 패널티나 재신청 제한 없이 언제든 다시 신청할 수 있어요."
              : "직접 취소한 체험권입니다. 같은 캠페인이 모집 중이면 취소 12시간 뒤부터 다시 참여할 수 있어요."}
          </div>
        )}
        {pass.status === "rejected" && (() => {
          const isPress = campaign?.kind === "press";
          const resubmitDeadline = isPress
            ? (campaign?.endAt ?? 0)
            : (pass.rejectedAt ?? 0) + REVIEW_DEADLINE_MS;
          const canResubmit = (pass.resubmitCount ?? 0) < 1 && Date.now() < resubmitDeadline;
          return (
            <div className="mt-6">
              <div className="rounded-md bg-errorSoft border border-error/20 p-5">
                <div className="text-[15px] font-bold text-error">리뷰가 반려되었습니다</div>
                <div className="mt-2 text-[14px] text-ink2 leading-[1.5]">
                  사유: {pass.rejectReason ?? "작성 조건 미충족 (자세한 내용은 고객센터 문의)"}
                </div>
                {canResubmit ? (
                  <div className="mt-2 text-[13px] text-muted">
                    사유를 반영해 수정한 뒤 아래에서 1회 재제출할 수 있어요
                    {!isPress && pass.rejectedAt ? " (반려 후 7일 이내)" : ""}.
                  </div>
                ) : (
                  <div className="mt-2 text-[13px] text-muted">
                    재제출 기한(반려 후 7일)이 지나 다시 제출할 수 없어요.
                  </div>
                )}
              </div>
              {canResubmit && (
                isPress ? (
                  <Link
                    href={`/r/press/${campaign?.id}/write?pass=${encodeURIComponent(pass.id)}`}
                    className="cp-action mt-4 flex h-[52px] items-center justify-center rounded-md bg-brand text-white text-[16px] font-bold"
                  >
                    수정해서 재제출하기 →
                  </Link>
                ) : (
                  <ReviewForm passId={pass.id} storeId={pass.storeId} channel={pass.reviewChannel ?? defaultChannel(campaign?.requiredChannels ?? []) ?? "naver_blog"} />
                )
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
