import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { supportForGrade } from "@/lib/grade";
import { CHANNEL_LABEL, defaultChannel } from "@/lib/channels";
import { findSupportBoost, boostedLimit } from "@/lib/referral";
import { REVIEW_DEADLINE_MS } from "@/lib/pass-lifecycle";
import { readRecentPasses } from "@/lib/recent-passes-cookie";
import GradeBadge from "@/components/GradeBadge";
import Icon from "@/components/Icon";
import { SBUI } from "@/lib/storyboard";
import QRView from "./QRView";
import ReviewForm from "./ReviewForm";
import Countdown from "./Countdown";
import OwnerUseForm from "./OwnerUseForm";
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

  // Active state — 화이트 캔버스 위 티켓 카드 (v2: shadow-card + 퍼플 액센트 + 점선 절취선)
  if (pass.status === "active") {
    return (
      <div className="fixed inset-0 z-30 mx-auto max-w-[480px] bg-canvas overflow-y-auto">
        {/* top-app-bar — 화이트 52px */}
        <div className="sticky top-0 z-10 bg-canvas border-b border-hairlineSoft">
          <div className="h-[52px] px-5 flex items-center justify-between">
            <Link href="/r/passes" className="cp-action inline-flex items-center gap-1 text-[15px] font-semibold text-brand">
              <Icon name="chevron-left" variant="border" size={18} />
              <span>닫기</span>
            </Link>
            <div className="text-[12px] text-muted">화면 밝기를 최대로</div>
          </div>
        </div>

        {/* Ticket card — 화이트 카드 + 떠 있는 표면 그림자 */}
        <div className="px-5 py-8">
          <div className="bg-canvas rounded-lg relative shadow-card overflow-visible">
            {/* perforation cutouts — 캔버스색 노치 */}
            <div className="absolute -left-3 top-[208px] w-6 h-6 rounded-full bg-canvas" />
            <div className="absolute -right-3 top-[208px] w-6 h-6 rounded-full bg-canvas" />

            {/* Top half — store info */}
            <div className="px-7 pt-7 pb-6">
              <div className="flex items-center gap-2 mb-4">
                <GradeBadge grade={pass.reviewerGrade} size="sm" />
                <span className="text-[12px] font-medium text-muted">CATCHPASS · {pass.reviewerGrade}등급</span>
              </div>
              <h2 className="text-[20px] font-bold text-ink tracking-title leading-[1.3]">{store?.name}</h2>
              <div className="text-[13px] text-muted mt-1">{store?.area} · {store?.category}</div>

              <div className="mt-5 flex items-start justify-between">
                <div>
                  <div className="text-[12px] text-muted">할인 금액</div>
                  <div className="text-[20px] font-bold text-ink tabular-nums leading-[1.3] mt-1">
                    {SBUI.support}
                  </div>
                  {boost && displaySupport > entitledSupport && (
                    <div className="mt-1 text-[11px] text-brand font-semibold">
                      🎁 초대 보상 부스트 포함
                    </div>
                  )}
                  <div className="mt-1 text-[11px] text-muted">매장에서 결제 시 즉시 할인해 드려요</div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] text-brand font-semibold">남은 시간</div>
                  <div className="mt-1">
                    <Countdown expiresAt={pass.expiresAt} />
                  </div>
                </div>
              </div>
            </div>

            {/* Perforation line */}
            <div className="border-t border-dashed border-hairline mx-7" />

            {/* QR section — QR은 항상 화이트 위 */}
            <div className="px-7 pt-6 pb-8 flex flex-col items-center">
              <div className="p-4 bg-canvas border border-hairline rounded-md">
                <QRView code={pass.code} />
              </div>

              <p className="mt-5 text-center text-[15px] text-ink leading-[1.5]">
                결제 시 사장님께 보여주세요<br />
                <span className="text-muted">&ldquo;캐치랭크 멤버십 쿠폰 사용할게요&rdquo;</span>
              </p>

              {/* 사장님 사용 처리 — 코드를 노출하지 않고 직접 입력받음 */}
              <OwnerUseForm passId={pass.id} supportAmount={displaySupport} />

              {/* 방문이 어려운 경우 취소 유도 — 슬롯을 다른 체험자에게 돌려줌 */}
              <CancelPassButton passId={pass.id} />
            </div>
          </div>
        </div>
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
        <p className="mt-1.5 text-[14px] text-ink2">{campaign?.title}</p>
        <p className="mt-1 text-[13px] text-muted">
          지원금 <span className="font-bold text-ink tabular-nums">{SBUI.support}</span>
          {pass.reviewChannel ? ` · ${CHANNEL_LABEL[pass.reviewChannel]} ${pass.reviewerGrade}등급` : ""}
        </p>
      </section>

      <div className="px-5">
        {pass.status === "used" && (
          <div className="mt-6">
            <div className="rounded-md bg-brandSoft px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[15px] font-bold text-brand">사용 완료</div>
                  <div className="mt-1 text-[14px] text-ink2 tabular-nums">결제 {SBUI.price} · 지원 {SBUI.support}</div>
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
              <div className="mt-2 text-[12px] text-muted">초과분 {SBUI.price}은 직접 결제하셨습니다</div>
            </div>

            {/* T1 트리거 — 패스 사용 직후 친구 초대 카드 (viral) */}
            <Link
              href={`/r/invite/new?store=${encodeURIComponent(pass.storeId)}&campaign=${encodeURIComponent(pass.campaignId)}`}
              className="cp-action mt-4 flex items-center gap-3 p-4 rounded-md border border-hairline bg-canvas"
            >
              <span className="text-[28px]" aria-hidden>🎁</span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-ink">
                  {SBUI.support} 절약 완료! 친구도 받게 해줄래요?
                </div>
                <div className="text-[11px] text-muted mt-0.5">친구 가입 즉시 내 행운 박스 오픈 + 친구는 첫 캠페인 +50% 지원금</div>
              </div>
              <span className="text-brand text-[18px] shrink-0">›</span>
            </Link>

            <h2 className="mt-9 text-[18px] font-bold text-ink tracking-title">리뷰 인증</h2>
            <p className="mt-2 text-[14px] text-ink2 leading-[1.5]">
              실제 게시 후 URL을 제출해주세요. 작성 조건·광고 표시 문구는 매장 상세에서 미리 확인했어요 — 여기서는 자가 점검만 진행해요.
            </p>
            <ReviewForm passId={pass.id} storeId={pass.storeId} channel={pass.reviewChannel ?? defaultChannel(campaign?.requiredChannels ?? []) ?? "naver_blog"} />
          </div>
        )}

        {pass.status === "review_submitted" && (
          <div className="mt-6 rounded-md border border-hairline bg-canvas p-5 text-[15px] text-ink">
            ✓ 리뷰가 등록되었습니다. 운영팀이 광고 표시·작성 조건을 검수합니다 (최대 72시간).
          </div>
        )}
        {pass.status === "completed" && (
          <>
            <div className="mt-6 rounded-md bg-successSoft p-5 text-[15px] text-ink">
              <span className="text-successStrong font-semibold">✓ 리뷰 검수 통과.</span> 등급 점수가 반영되었습니다.
            </div>
            {/* T2 트리거 — 검수 통과 후 친구 초대 */}
            <Link
              href={`/r/invite/new?store=${encodeURIComponent(pass.storeId)}&campaign=${encodeURIComponent(pass.campaignId)}`}
              className="cp-action mt-3 flex items-center gap-3 p-4 rounded-md border border-hairline bg-canvas"
            >
              <span className="text-[28px]" aria-hidden>🎁</span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-ink">검수 통과! 행운 박스 더 키우러 갈까요?</div>
                <div className="text-[11px] text-muted mt-0.5">친구 3명 더 모으면 실버 박스 · 5명이면 골드 박스</div>
              </div>
              <span className="text-brand text-[18px] shrink-0">›</span>
            </Link>
          </>
        )}
        {pass.status === "expired" && (
          <div className="mt-6 rounded-md bg-sunken p-5 text-[15px] text-muted">
            사용 기한(발급 후 72시간)이 지나 만료된 체험권입니다. 만료된 체험권은 연장·복구되지 않으며, 모집 자리는 다른 체험자에게 돌아갔어요.
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
                    재제출 기한이 지났거나 이미 재제출했습니다. 이의가 있으면 고객센터(help@catchrank.co.kr)로 문의해주세요.
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
