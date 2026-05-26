import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDB } from "@/lib/db";
import QRView from "./QRView";
import ReviewForm from "./ReviewForm";
import Countdown from "./Countdown";

export const dynamic = "force-dynamic";

export default async function PassDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentReviewer();
  const { id } = await params;
  const db = getDB();
  const pass = db.passes.find((p) => p.id === id);
  if (!pass || pass.reviewerId !== me.id) return notFound();
  const store = db.stores.find((s) => s.id === pass.storeId);
  const campaign = db.campaigns.find((c) => c.id === pass.campaignId);

  // 자동 만료
  if (pass.status === "active" && Date.now() > pass.expiresAt) {
    pass.status = "expired";
  }

  return (
    <div className="pb-24">
      <div className="px-5 pt-12 pb-3 flex items-center gap-3">
        <Link href="/r/passes" className="w-9 h-9 rounded-full bg-surfaceSoft grid place-items-center text-[18px]">←</Link>
        <h1 className="text-[18px] font-bold">체험권 상세</h1>
      </div>

      <div className="px-5">
        <div className="rounded-md bg-ink text-white p-5">
          <div className="text-[12px] text-white/70">{campaign?.title}</div>
          <div className="text-[20px] font-bold mt-1">{store?.name}</div>
          <div className="mt-2 text-[13px] text-white/80">지원금 ₩{campaign?.supportAmount.toLocaleString()}</div>
        </div>

        {pass.status === "active" && (
          <>
            <div className="mt-5">
              <Countdown expiresAt={pass.expiresAt} />
            </div>
            <div className="mt-5 rounded-md border border-hairline p-5 flex flex-col items-center">
              <div className="text-[13px] text-muted mb-3">결제 전 사장님께 QR을 보여주세요</div>
              <QRView code={pass.code} />
              <div className="mt-4 font-mono text-[14px] tracking-wider">{pass.code}</div>
            </div>
          </>
        )}

        {pass.status === "used" && (
          <div className="mt-5">
            <div className="rounded-md bg-brandSoft border border-brand/20 p-4">
              <div className="text-[14px] font-semibold text-ink">사용 완료</div>
              <div className="mt-1 text-[13px]">결제 ₩{pass.paidAmount?.toLocaleString()} · 지원 ₩{pass.supportApplied?.toLocaleString()}</div>
              {pass.paidAmount && pass.supportApplied !== undefined && pass.paidAmount > pass.supportApplied && (
                <div className="mt-1 text-[12px] text-muted">초과분 ₩{(pass.paidAmount - pass.supportApplied).toLocaleString()}은 직접 결제하셨습니다</div>
              )}
            </div>
            <h2 className="mt-6 text-[18px] font-bold">리뷰 등록</h2>
            <p className="mt-1 text-[13px] text-muted">사진 5장 이상, 본문 500자 이상 권장 · 60일 이상 게시</p>
            <ReviewForm passId={pass.id} channels={campaign?.requiredChannels || []} />
          </div>
        )}

        {pass.status === "review_submitted" && (
          <div className="mt-5 rounded-md bg-surfaceSoft p-4 text-[14px]">
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
