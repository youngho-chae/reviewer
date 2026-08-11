import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { reviewDeadline, REVIEW_DEADLINE_MS } from "@/lib/pass-lifecycle";
import { fmtKoDateTime } from "@/lib/dates";
import { SBUI, sbNum } from "@/lib/storyboard";

export const dynamic = "force-dynamic";

// 사용 처리 완료 안내 (2026-08-11 — QR 실시간 동기화) — 사장님 스캔/코드 입력으로
// 사용 처리가 끝나면 체험자 QR 화면이 이 페이지로 자동 전환된다.
// (app) 레이아웃 안이라 바텀 네비 유지 — 리뷰 작성으로 가거나 다른 탭으로 이동 가능.
export default async function PassComplete({ params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentReviewer();
  const { id } = await params;
  const db = await getDBAsync();
  const pass = db.passes.find((p) => p.id === id);
  if (!pass || pass.reviewerId !== me.id) return notFound();
  // 사용 처리 전·취소·만료는 안내 대상이 아님 — 상세(현재 상태 화면)로
  if (!["used", "review_submitted", "completed", "rejected"].includes(pass.status)) {
    redirect(`/r/passes/${pass.id}`);
  }
  const store = db.stores.find((s) => s.id === pass.storeId);
  const deadline = reviewDeadline(pass) ?? (pass.usedAt ?? Date.now()) + REVIEW_DEADLINE_MS;
  const submitted = pass.status !== "used";

  return (
    <div className="pb-24 bg-canvas min-h-[60dvh] flex flex-col">
      <div className="flex-1 px-5 pt-16 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-successSoft grid place-items-center text-[28px]" aria-hidden>
          ✓
        </div>
        <h1 className="mt-5 text-[20px] font-bold text-ink tracking-title leading-[1.35]">
          사용 처리가 완료되었습니다
        </h1>
        <p className="mt-2 text-[14px] text-ink2 leading-[1.6]">
          {store?.name ?? "매장"} 체험이 확인되었어요.
          <br />
          제출 기한까지 리뷰를 제출해 주세요.
        </p>

        {/* 리뷰 기한 카드 — 이용 후 7일 (예약형은 확정 방문일 +7일, reviewDeadline 정본) */}
        <div className="mt-6 mx-auto max-w-[320px] rounded-lg bg-brandSoft px-4 py-3.5">
          <div className="text-[12px] text-muted">리뷰 제출 기한</div>
          <div className="mt-1 text-[16px] font-bold text-brand tabular-nums">
            {sbNum(SBUI.dateTime, fmtKoDateTime(deadline))}까지
          </div>
        </div>

        <div className="mt-8 mx-auto max-w-[320px] space-y-2.5">
          <Link
            href={`/r/passes/${pass.id}`}
            className="cp-action flex h-[52px] items-center justify-center rounded-md bg-brand text-white text-[16px] font-bold"
          >
            {submitted ? "제출한 리뷰 보기" : "리뷰 작성하기"}
          </Link>
          <Link
            href="/r/passes"
            className="cp-action flex h-11 items-center justify-center rounded-md border border-hairline text-[14px] font-semibold text-ink"
          >
            내 체험권으로
          </Link>
        </div>
      </div>
    </div>
  );
}
