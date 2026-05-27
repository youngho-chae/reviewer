import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import GradeBadge from "@/components/GradeBadge";
import QRView from "./QRView";
import ReviewForm from "./ReviewForm";
import Countdown from "./Countdown";

export const dynamic = "force-dynamic";

export default async function PassDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentReviewer();
  const { id } = await params;
  const db = await getDBAsync();
  const pass = db.passes.find((p) => p.id === id);
  if (!pass || pass.reviewerId !== me.id) return notFound();
  const store = db.stores.find((s) => s.id === pass.storeId);
  const campaign = db.campaigns.find((c) => c.id === pass.campaignId);

  if (pass.status === "active" && Date.now() > pass.expiresAt) {
    pass.status = "expired";
  }

  // Active 상태일 때 V3 다크 티켓 디자인
  if (pass.status === "active") {
    return (
      <div className="fixed inset-0 z-30 mx-auto max-w-[480px] bg-ink text-white overflow-y-auto">
        <div className="pt-12 px-5 pb-3 flex items-center justify-between">
          <Link href="/r/passes" className="flex items-center gap-1.5 text-[14px] font-semibold">
            <span>←</span>
            <span>닫기</span>
          </Link>
          <div className="text-[13px] text-white/60">화면 밝기를 최대로</div>
        </div>

        {/* 티켓 카드 */}
        <div className="mx-5 mt-2 bg-white rounded-[24px] overflow-hidden relative">
          {/* perforation 좌우 원형 절단점 */}
          <div className="absolute -left-3 top-[210px] w-6 h-6 rounded-full bg-ink" />
          <div className="absolute -right-3 top-[210px] w-6 h-6 rounded-full bg-ink" />

          {/* 상단: 매장 정보 */}
          <div className="px-6 pt-6 pb-7">
            <div className="flex items-center gap-2 mb-3.5">
              <GradeBadge grade={pass.reviewerGrade} size="sm" />
              <span className="text-[12px] font-bold tracking-wider text-ink">CATCHPASS · {pass.reviewerGrade}등급</span>
            </div>
            <h2 className="text-[22px] font-extrabold tracking-tight text-ink mb-1">{store?.name}</h2>
            <div className="text-[13px] text-muted">{store?.area} · {store?.category}</div>

            <div className="mt-5 flex items-start justify-between">
              <div>
                <div className="text-[11px] text-muted font-semibold">할인 금액</div>
                <div className="text-[28px] font-extrabold text-ink tracking-tight leading-tight">
                  {campaign?.supportAmount.toLocaleString()}<span className="text-[14px] font-semibold">원</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-muted font-semibold">유효기간</div>
                <Countdown expiresAt={pass.expiresAt} />
              </div>
            </div>
          </div>

          {/* 절단선 */}
          <div className="border-t-[1.5px] border-dashed border-hairline mx-6" />

          {/* 하단: QR */}
          <div className="px-6 pt-7 pb-8 flex flex-col items-center">
            <div className="p-3.5 bg-white rounded-md border border-hairline">
              <QRView code={pass.code} />
            </div>
            <div className="font-mono text-[12px] text-muted mt-3.5 tracking-widest">
              CP · {pass.code}
            </div>
            <div className="mt-4 text-center text-[13px] font-semibold text-ink leading-relaxed">
              결제 시 사장님께 보여주세요<br />
              <span className="text-muted font-medium">&quot;캐치랭크 멤버십 쿠폰 사용할게요&quot;</span>
            </div>
          </div>
        </div>

        <div className="h-20" />
      </div>
    );
  }

  // 그 외 상태(used/review_submitted/completed/expired/rejected): 일반 페이지
  return (
    <div className="pb-24">
      <div className="px-5 pt-12 pb-3 flex items-center gap-3">
        <Link href="/r/passes" className="w-9 h-9 rounded-full bg-surfaceSoft grid place-items-center text-[18px]">←</Link>
        <h1 className="text-[18px] font-bold tracking-tight">체험권 상세</h1>
      </div>

      <div className="px-5">
        <div className="rounded-md bg-ink text-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <GradeBadge grade={pass.reviewerGrade} size="sm" inverted />
            <span className="text-[11px] font-bold tracking-wider">CATCHPASS · {pass.reviewerGrade}등급</span>
          </div>
          <div className="text-[13px] text-white/70">{campaign?.title}</div>
          <div className="text-[20px] font-bold mt-1">{store?.name}</div>
          <div className="mt-2 text-[13px] text-white/80">지원금 ₩{campaign?.supportAmount.toLocaleString()}</div>
        </div>

        {pass.status === "used" && (
          <div className="mt-5">
            <div className="rounded-md bg-brand/20 border border-brand p-4">
              <div className="text-[14px] font-bold text-ink">사용 완료</div>
              <div className="mt-1 text-[13px]">결제 ₩{pass.paidAmount?.toLocaleString()} · 지원 ₩{pass.supportApplied?.toLocaleString()}</div>
              {pass.paidAmount && pass.supportApplied !== undefined && pass.paidAmount > pass.supportApplied && (
                <div className="mt-1 text-[12px] text-muted">초과분 ₩{(pass.paidAmount - pass.supportApplied).toLocaleString()}은 직접 결제하셨습니다</div>
              )}
            </div>
            <h2 className="mt-6 text-[18px] font-bold tracking-tight">리뷰 인증하기</h2>
            <p className="mt-1 text-[13px] text-muted">사진 5장 이상, 본문 500자 이상 권장 · 60일 이상 게시</p>
            <ReviewForm passId={pass.id} channels={campaign?.requiredChannels || []} />
          </div>
        )}

        {pass.status === "review_submitted" && (
          <div className="mt-5 rounded-md bg-surfaceSoft border border-hairline p-4 text-[14px]">
            ✅ 리뷰가 등록되었습니다. 사장님/운영팀 검수를 기다려주세요.
          </div>
        )}
        {pass.status === "completed" && (
          <div className="mt-5 rounded-md bg-success/10 border border-success/20 p-4 text-[14px]">
            🎉 리뷰 검수 통과! 등급 점수가 반영되었습니다.
          </div>
        )}
        {pass.status === "expired" && (
          <div className="mt-5 rounded-md bg-surfaceStrong p-4 text-[14px] text-muted">
            ⌛ 24시간이 지나 만료된 체험권입니다.
          </div>
        )}
        {pass.status === "rejected" && (
          <div className="mt-5 rounded-md bg-error/10 border border-error/20 p-4 text-[14px]">
            반려된 리뷰입니다. 운영팀 검수가 진행됩니다 (최대 72시간).
          </div>
        )}
      </div>
    </div>
  );
}
