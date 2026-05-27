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

  // Active state — Apple environment-quote-card / dark product tile treatment
  if (pass.status === "active") {
    return (
      <div className="fixed inset-0 z-30 mx-auto max-w-[480px] bg-tile1 overflow-y-auto">
        {/* Frosted dark top bar */}
        <div className="sticky top-0 bg-tile1/90 backdrop-blur-md border-b border-white/10">
          <div className="h-13 px-5 flex items-center justify-between">
            <Link href="/r/passes" className="cp-action text-[17px]" style={{ color: "#2997ff" }}>← 닫기</Link>
            <div className="text-[13px] text-mutedSoft">화면 밝기를 최대로</div>
          </div>
        </div>

        {/* Ticket card — light canvas resting on dark tile, Apple product-shadow */}
        <div className="px-6 py-10">
          <div className="bg-canvas rounded-lg relative product-shadow overflow-visible">
            {/* perforation cutouts */}
            <div className="absolute -left-3 top-[208px] w-6 h-6 rounded-full bg-tile1" />
            <div className="absolute -right-3 top-[208px] w-6 h-6 rounded-full bg-tile1" />

            {/* Top half — store info */}
            <div className="px-8 pt-8 pb-7">
              <div className="flex items-center gap-2 mb-4">
                <GradeBadge grade={pass.reviewerGrade} size="sm" />
                <span className="text-[12px] tracking-[0.18em] uppercase text-muted">CATCHPASS · {pass.reviewerGrade}등급</span>
              </div>
              <h2 className="font-display text-[28px] leading-[1.14] text-ink">{store?.name}</h2>
              <div className="text-[14px] text-muted mt-1">{store?.area} · {store?.category}</div>

              <div className="mt-6 flex items-start justify-between">
                <div>
                  <div className="text-[12px] text-muted">할인 금액</div>
                  <div className="font-display text-[34px] leading-[1.1] text-ink mt-1">
                    ₩{campaign?.supportAmount.toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] text-muted">남은 시간</div>
                  <div className="mt-1">
                    <Countdown expiresAt={pass.expiresAt} />
                  </div>
                </div>
              </div>
            </div>

            {/* Perforation line */}
            <div className="border-t border-dashed border-hairline mx-8" />

            {/* QR section */}
            <div className="px-8 pt-7 pb-9 flex flex-col items-center">
              <div className="p-4 bg-canvas border border-hairline rounded-md">
                <QRView code={pass.code} />
              </div>
              <div className="font-mono text-[12px] text-muted mt-4 tracking-widest">
                CP · {pass.code}
              </div>
              <p className="mt-5 text-center text-[15px] text-ink leading-[1.5]">
                결제 시 사장님께 보여주세요<br />
                <span className="text-muted">&ldquo;캐치랭크 멤버십 쿠폰 사용할게요&rdquo;</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Other states — light canvas product page
  return (
    <div className="pb-24 bg-canvas min-h-[100dvh]">
      <div className="sticky top-0 z-10 frosted-parchment border-b border-hairlineSoft">
        <div className="h-13 px-5 flex items-center justify-between">
          <Link href="/r/passes" className="cp-action text-[17px] text-brand">← 내 체험권</Link>
          <div className="text-[14px] text-ink font-medium">체험권 상세</div>
        </div>
      </div>

      {/* Parchment header */}
      <section className="bg-parchment px-6 pt-10 pb-8 text-center">
        <div className="flex justify-center mb-3">
          <GradeBadge grade={pass.reviewerGrade} size="lg" />
        </div>
        <h1 className="font-display text-[28px] leading-[1.14] text-ink">{store?.name}</h1>
        <p className="mt-2 text-[15px] text-ink2">{campaign?.title}</p>
        <p className="mt-1 text-[14px] text-muted">지원금 ₩{campaign?.supportAmount.toLocaleString()}</p>
      </section>

      <div className="px-6">
        {pass.status === "used" && (
          <div className="mt-8">
            <div className="rounded-md bg-brandSoft border border-brand/20 px-4 py-4">
              <div className="text-[15px] font-semibold text-ink">사용 완료</div>
              <div className="mt-1 text-[14px] text-ink2">결제 ₩{pass.paidAmount?.toLocaleString()} · 지원 ₩{pass.supportApplied?.toLocaleString()}</div>
              {pass.paidAmount && pass.supportApplied !== undefined && pass.paidAmount > pass.supportApplied && (
                <div className="mt-1 text-[12px] text-muted">초과분 ₩{(pass.paidAmount - pass.supportApplied).toLocaleString()}은 직접 결제하셨습니다</div>
              )}
            </div>
            <h2 className="mt-10 font-display text-[28px] leading-[1.14] text-ink">리뷰 인증</h2>
            <p className="mt-2 text-[15px] text-ink2 leading-[1.47]">사진 5장 이상, 본문 500자 이상 권장 · 60일 이상 게시</p>
            <ReviewForm passId={pass.id} channels={campaign?.requiredChannels || []} />
          </div>
        )}

        {pass.status === "review_submitted" && (
          <div className="mt-8 rounded-md bg-parchment border border-hairline p-5 text-[15px] text-ink">
            ✓ 리뷰가 등록되었습니다. 사장님/운영팀 검수를 기다려주세요.
          </div>
        )}
        {pass.status === "completed" && (
          <div className="mt-8 rounded-md bg-brandSoft border border-brand/20 p-5 text-[15px] text-ink">
            ✓ 리뷰 검수 통과. 등급 점수가 반영되었습니다.
          </div>
        )}
        {pass.status === "expired" && (
          <div className="mt-8 rounded-md bg-parchment p-5 text-[15px] text-muted">
            24시간이 지나 만료된 체험권입니다.
          </div>
        )}
        {pass.status === "rejected" && (
          <div className="mt-8 rounded-md bg-error/5 border border-error/20 p-5 text-[15px] text-ink">
            반려된 리뷰입니다. 운영팀 검수가 진행됩니다 (최대 72시간).
          </div>
        )}
      </div>
    </div>
  );
}
