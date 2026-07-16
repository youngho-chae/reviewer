import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { supportForGrade } from "@/lib/grade";
import { passDisplayStatus } from "@/lib/pass-display";
import { CHANNEL_LABEL, defaultChannel } from "@/lib/channels";
import { findSupportBoost, boostedLimit } from "@/lib/referral";
import { REVIEW_DEADLINE_MS } from "@/lib/pass-lifecycle";
import { readRecentPasses } from "@/lib/recent-passes-cookie";
import GradeBadge from "@/components/GradeBadge";
import Icon from "@/components/Icon";
import { SBUI } from "@/lib/storyboard";
import ReviewForm from "./ReviewForm";
import Countdown from "./Countdown";
import PassTicket from "./PassTicket";
import CancelPassButton from "./CancelPassButton";

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

          {pass.shipping && (
            <div className="mt-4 rounded-md border border-hairline p-4">
              <div className="text-[13px] font-bold text-ink">배송지</div>
              <div className="mt-2 text-[14px] text-ink leading-[1.6]">
                {pass.shipping.recipient} · {pass.shipping.phone}
                <br />
                <span className="text-ink2">{pass.shipping.address}</span>
              </div>
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
          boosted={!!boost && displaySupport > entitledSupport}
        />

        {/* [2026-07-12 회의 §8-1] QR 인증 화면에서 참여 취소 제거 — 매장 직원과 함께 쓰는
            인증 중심 화면으로 단순화. 방문 취소는 내 체험권 리스트의 [참여 취소]에서. */}
        <div className="pb-12" />
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
        {pass.status === "used" && (
          <div className="mt-6">
            <div className="rounded-md bg-brandSoft px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[15px] font-bold text-brand">{isDelivery ? "📦 발송 완료" : "사용 완료"}</div>
                  {isDelivery ? (
                    <div className="mt-1 text-[14px] text-ink2 tabular-nums">
                      {pass.trackingNo ? `운송장 ${SBUI.trackingNo}` : "상품이 발송되었어요"}
                    </div>
                  ) : (
                    <div className="mt-1 text-[14px] text-ink2 tabular-nums">결제 {SBUI.price} · 지원 {SBUI.support}</div>
                  )}
                </div>
                {pass.usedAt && (
                  <div className="text-right">
                    <div className="text-[11px] text-muted">리뷰 마감</div>
                    <Countdown
                      expiresAt={pass.usedAt + REVIEW_DEADLINE_MS}
                      mode="dhm"
                      className="!text-[15px] mt-1"
                      expiredText="마감 지남"
                    />
                  </div>
                )}
              </div>
              {isDelivery && (
                <div className="mt-2 text-[12px] text-muted">
                  {campaign?.pointReward ? "리뷰가 검수를 통과하면 포인트가 적립돼요" : "수령 후 체험하고 리뷰를 등록해주세요"}
                </div>
              )}
            </div>

            {/* [2026-07-12 회의 §11-1] 리뷰 작성 화면의 친구 초대(코드) 카드 삭제 — 초대는 /r/rewards 전용 */}

            {passDisplayStatus(pass) === "overdue" ? (
              /* 제출 기한 초과 — 서버(/api/passes/review)도 기한 경과 제출을 차단하므로 폼 대신 안내만 */
              <div className="mt-9 rounded-md bg-sunken p-5 text-[14px] text-muted leading-[1.6]">
                리뷰 제출 기한(이용 후 7일)이 지나 제출할 수 없어요. 기한 초과는 등급 재평가에 감점으로 반영돼요.
              </div>
            ) : (
              <>
                <h2 className="mt-9 text-[18px] font-bold text-ink tracking-title">제출 전 마지막 확인</h2>
                <p className="mt-2 text-[14px] text-ink2 leading-[1.5]">
                  게시한 리뷰 URL을 제출하고, 작성 조건을 확인했는지 가볍게 점검해주세요.
                </p>
                <ReviewForm passId={pass.id} storeId={pass.storeId} channel={pass.reviewChannel ?? defaultChannel(campaign?.requiredChannels ?? []) ?? "naver_blog"} />
              </>
            )}
          </div>
        )}

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
            직접 취소한 체험권입니다. 같은 캠페인이 모집 중이면 취소 12시간 뒤부터 다시 참여할 수 있어요.
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
