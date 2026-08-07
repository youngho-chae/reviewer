import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { supportForGrade } from "@/lib/grade";
import { passDisplayStatus } from "@/lib/pass-display";
import { CHANNEL_LABEL, defaultChannel } from "@/lib/channels";
import { findSupportBoost, boostedLimit } from "@/lib/referral";
import { REVIEW_DEADLINE_MS, SHIP_DELAY_NOTICE_MS, reviewDeadline } from "@/lib/pass-lifecycle";
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
import {
  fmtReservationLabel,
  fmtExpiryLabel,
  reservationHistoryCards,
  reviewerCounterUsed,
  reservationStatusLabel,
  buildReservationPicker,
  cancelledCopy,
  type ReservationPicker,
} from "@/lib/reservation";
import type { Campaign, Pass } from "@/lib/types";

// 예약 변경·재제안용 날짜/시간 선택지 — 캠페인 스케줄·차단·시간대 정원 기준 (§3-2)
function buildRsvPicker(campaign: Campaign | undefined, passes: Pass[], selfPassId: string): ReservationPicker {
  if (!campaign) return { dates: [], slotsByDate: {} };
  return buildReservationPicker(campaign, passes, selfPassId);
}

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

  // 예약형 — 예약 확정 전에는 QR·코드를 노출하지 않는다 (2026-07-16 v2 회의 · 2026-07-23 시안).
  // requested = 사장님 확인 대기(예약 변경 1회 — 제안 전에만) / proposed = 제안 응답 대기(수락·기타·취소).
  if (pass.status === "active" && pass.reservation && pass.reservation.status !== "confirmed") {
    const rsv = pass.reservation;
    const proposalSlots = (rsv.proposal?.slots ?? []).map((sl) => ({
      date: sl.date,
      time: sl.time,
      label: fmtReservationLabel(sl.date, sl.time),
    }));
    const rsvPicker = buildRsvPicker(campaign, db.passes, pass.id);
    const historyCards = reservationHistoryCards(rsv);
    return (
      <div className="pb-24 bg-canvas min-h-[100dvh]">
        <div className="sticky top-0 z-10 bg-canvas">
          <div className="h-[52px] px-3 grid grid-cols-[40px_1fr_40px] items-center">
            <Link href="/r/passes" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="내 체험권으로">
              <Icon name="chevron-left" variant="border" size={22} />
            </Link>
            <h1 className="text-[16px] font-bold text-ink tracking-title text-center">체험권</h1>
            <span />
          </div>
        </div>

        {/* 예약 대기 헤더 (2026-07-23 시안) — 상태 칩 + 가게명 + 신청 일정/인원 */}
        <section className="px-5 pt-3">
          <span className="inline-flex items-center px-2.5 py-1 rounded-pill bg-sunken text-muted text-[12px] font-semibold">
            {reservationStatusLabel(rsv)}
          </span>
          <h2 className="mt-3 text-[20px] font-bold text-ink tracking-title leading-[1.3] line-clamp-2">{store?.name}</h2>
          <div className="mt-4 space-y-2 text-[15px]">
            <div className="flex gap-4">
              <span className="text-muted shrink-0">신청 일정</span>
              <span className="font-semibold text-ink tabular-nums">{sbNum(SBUI.dateTime, fmtReservationLabel(rsv.date, rsv.time))}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-muted shrink-0">신청 인원</span>
              <span className="font-semibold text-ink tabular-nums">{rsv.partySize ?? 1}명</span>
            </div>
          </div>

          {rsv.status === "proposed" ? (
            <ReservationRespond
              passId={pass.id}
              slots={proposalSlots}
              note={rsv.proposal?.note}
              picker={rsvPicker}
              counterUsed={reviewerCounterUsed(rsv)}
            />
          ) : (
            <ReservationPanel
              passId={pass.id}
              date={rsv.date}
              time={rsv.time}
              changeUsed={!!rsv.changeUsed}
              counterUsed={reviewerCounterUsed(rsv)}
              picker={rsvPicker}
            />
          )}
        </section>

        {/* 예약 내역 (2026-07-23 시안) — 신청·제안·재요청 타임라인 (actor 퍼플 강조) */}
        <div className="mt-8 h-2 bg-sunken" />
        <section className="px-5 pt-6">
          <h3 className="text-[17px] font-bold text-ink tracking-title">예약 내역</h3>
          <div className="mt-3 space-y-2.5 pb-8">
            {historyCards.map((c, i) => (
              <div key={i} className="rounded-lg bg-sunken px-4 py-3.5">
                <div className="text-[15px] font-semibold text-ink">
                  <span className="text-brand">{c.actor}</span>
                  {c.title}
                </div>
                {c.rows.map((r, j) => (
                  <div key={j} className="mt-1 flex gap-3 text-[14px] text-mutedSoft tabular-nums">
                    <span className="shrink-0 w-[58px]">{r.label}</span>
                    <span>{sbNum(SBUI.dateTime, r.value)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
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

        {/* 예약 확정 체험권 (2026-07-23 시안) — 요약 카드(지원금·유효 기간) + 예약 정보 오렌지 카드 + QR.
            QR 화면은 최종 확정 일정·인증 중심 (§9-2 — 조율 이력은 사장님·운영자 화면에 유지) */}
        <PassTicket
          passId={pass.id}
          code={pass.code}
          storeName={store?.name ?? "매장"}
          channelLabel={pass.reviewChannel ? CHANNEL_LABEL[pass.reviewChannel] : pass.receiptReview ? "영수증 리뷰" : "채널 미정"}
          grade={pass.reviewerGrade}
          // 영수증 리뷰 — 표기는 "10% 할인", support는 할인 상한(기준 지원금 P2)으로 전달 (2026-08-07 정정)
          support={pass.receiptReview ? (campaign?.supportAmount ?? 0) : displaySupport}
          receipt={!!pass.receiptReview}
          expiresAt={pass.expiresAt}
          expiryLabel={fmtExpiryLabel(pass.expiresAt, !!pass.reservation)}
          reservation={
            pass.reservation
              ? {
                  label: fmtReservationLabel(pass.reservation.date, pass.reservation.time),
                  partySize: pass.reservation.partySize,
                }
              : undefined
          }
        />

        {/* [2026-07-12 회의 §8-1] QR 인증 화면에서 참여 취소 제거 — 매장 직원과 함께 쓰는
            인증 중심 화면으로 단순화. 방문 취소는 내 체험권 리스트의 [참여 취소]에서. */}
        <div className="pb-12" />
      </div>
    );
  }

  // 리뷰 제출 화면 (2026-07-17 시안 개편) — used(작성)·rejected(재제출) 공용 레이아웃:
  // 히어로(매장명·혜택·마감 카드) → [반려 시] 반려 사유 카드 → 파스텔 채널 배너 → URL·최종 확인 폼.
  if (pass.status === "used" || pass.status === "rejected") {
    const isRejected = pass.status === "rejected";
    const isReceipt = !!pass.receiptReview;
    const channel = pass.reviewChannel ?? defaultChannel(campaign?.requiredChannels ?? []) ?? "naver_blog";
    // 파스텔 채널 배너 — 디자인 시스템 SNS 토큰 재사용 (블로그 그린 / 인스타 핑크 / 틱톡 틸).
    // 영수증 리뷰(2026-08-07)는 채널이 없으므로 중립 배너.
    const banner = isReceipt
      ? { label: "영수증 리뷰", box: "bg-sunken", strong: "text-ink" }
      : {
          naver_blog: { label: "네이버 블로그", box: "bg-snsBlogBg", strong: "text-snsBlogText" },
          instagram: { label: "인스타", box: "bg-snsInstaBg", strong: "text-snsInstaText" },
          tiktok: { label: "틱톡", box: "bg-snsTiktokBg", strong: "text-snsTiktokText" },
        }[channel];
    // 마감 기산점 — used: 이용 후 7일 / rejected: 반려 후 7일 (1회 재제출)
    // 리뷰 마감 (§8-2) — 예약형은 확정 방문일 기준 +7일 (reviewDeadline), 그 외 이용 후 7일
    const deadline = isRejected
      ? (pass.rejectedAt ?? Date.now()) + REVIEW_DEADLINE_MS
      : (reviewDeadline(pass) ?? Date.now() + REVIEW_DEADLINE_MS);
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

        {/* 파스텔 채널 배너 — 참여 채널 고정 표기 (영수증 리뷰는 중립 톤) */}
        <div className={`mx-5 mt-5 rounded-lg px-4 py-4 text-center text-[15px] text-ink ${banner.box}`}>
          이번 체험은 <span className={`font-bold ${banner.strong}`}>{banner.label}</span>{isReceipt ? "로" : ""} 참여했어요
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
          <ReviewForm passId={pass.id} storeId={pass.storeId} channel={channel} resubmit={isRejected} receipt={isReceipt} />
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
          ) : pass.receiptReview && pass.supportApplied == null ? (
            /* 영수증 리뷰 사용 전 — 정액이 아니라 결제액 기준이라 금액 미표기 (2026-08-07 정정) */
            <>할인 혜택 <span className="font-bold text-ink">결제 금액의 10% 할인</span></>
          ) : (
            <>지원금 <span className="font-bold text-ink tabular-nums">{SBUI.support}</span></>
          )}
          {pass.reviewChannel
            ? ` · ${CHANNEL_LABEL[pass.reviewChannel]} ${pass.reviewerGrade}등급`
            : pass.receiptReview
              ? ` · 영수증 리뷰 ${pass.reviewerGrade}등급`
              : ""}
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
              : pass.reservation
                ? "예약 방문일이 지나 만료된 체험권입니다. 만료된 체험권은 연장·복구되지 않으며, 모집 자리는 다른 체험자에게 돌아갔어요." // §10-4 — 문구로만 구분, 추가 패널티 없음
                : "사용 기한(발급 후 72시간)이 지나 만료된 체험권입니다. 만료된 체험권은 연장·복구되지 않으며, 모집 자리는 다른 체험자에게 돌아갔어요."}
          </div>
        )}
        {pass.status === "cancelled" && (
          <div className="mt-6 rounded-md bg-sunken p-5">
            {/* 상태명은 '취소'로 통일, 주체·원인은 서브 문구로 구분 (§15-3·§10-3) */}
            <div className="text-[15px] font-semibold text-ink">취소된 체험권입니다</div>
            <p className="mt-1.5 text-[14px] text-muted leading-[1.6]">{cancelledCopy(pass.cancelledVia, pass.cancelReason, pass.cancelReasonCode)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
