import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import GradeBadge from "@/components/GradeBadge";
import { gradeMeets } from "@/lib/grade";

export const dynamic = "force-dynamic";

export default async function PressArchive() {
  const me = await getCurrentReviewer();
  const db = await getDBAsync();
  const now = Date.now();
  const press = db.campaigns
    .filter((c) => c.kind === "press" && c.endAt > now)
    .map((c) => {
      const store = db.stores.find((s) => s.id === c.storeId)!;
      const totalQ = c.quota.S + c.quota.A + c.quota.B + c.quota.C;
      const usedQ = c.used.S + c.used.A + c.used.B + c.used.C;
      const remain = totalQ - usedQ;
      const minNeededGrade: "S" | "A" | "B" | "C" =
        c.quota.C > 0 ? "C" : c.quota.B > 0 ? "B" : c.quota.A > 0 ? "A" : "S";
      return { c, store, remain, minNeededGrade, accessible: gradeMeets(me.grade, minNeededGrade) };
    });

  const myPressPasses = db.passes.filter((p) => {
    const c = db.campaigns.find((x) => x.id === p.campaignId);
    return p.reviewerId === me.id && c?.kind === "press";
  });

  // 단계별 그룹
  const inProgress = myPressPasses.filter((p) => p.status === "active");
  const inReview = myPressPasses.filter((p) => p.status === "review_submitted");
  const done = myPressPasses.filter((p) => p.status === "completed");

  const pendingPay = inReview.reduce((s, p) => {
    const c = db.campaigns.find((x) => x.id === p.campaignId);
    return s + (c?.supportAmount || 0);
  }, 0);

  return (
    <div className="pb-24">
      <div className="px-5 pt-12 pb-3">
        <Link href="/r/me" className="text-muted text-[14px]">← MY</Link>
        <h1 className="mt-3 text-[22px] font-bold">기자단 보관소</h1>
        <p className="text-[13px] text-muted mt-1">신청 → 자료 수령 → 작성 → 검수 → 정산</p>
      </div>

      <div className="mx-5 mt-4 rounded-md bg-ink text-white p-4">
        <div className="text-[12px] text-white/70">정산 예정금</div>
        <div className="text-[22px] font-bold mt-1">₩{pendingPay.toLocaleString()}</div>
        <div className="text-[11px] text-white/60 mt-1">검수 통과 시 익월 25일 입금</div>
      </div>

      {/* 내 진행 중 */}
      {(inProgress.length + inReview.length + done.length) > 0 && (
        <>
          <h2 className="px-5 mt-6 text-[16px] font-bold">내 기자단</h2>
          <div className="px-5 mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-surfaceSoft p-3">
              <div className="text-[11px] text-muted">작성 중</div>
              <div className="text-[18px] font-bold mt-1">{inProgress.length}</div>
            </div>
            <div className="rounded-md bg-surfaceSoft p-3">
              <div className="text-[11px] text-muted">검수 중</div>
              <div className="text-[18px] font-bold mt-1">{inReview.length}</div>
            </div>
            <div className="rounded-md bg-surfaceSoft p-3">
              <div className="text-[11px] text-muted">정산 완료</div>
              <div className="text-[18px] font-bold mt-1">{done.length}</div>
            </div>
          </div>
          <div className="px-5 mt-3 space-y-2">
            {[...inProgress, ...inReview, ...done].map((p) => {
              const c = db.campaigns.find((x) => x.id === p.campaignId)!;
              const store = db.stores.find((s) => s.id === p.storeId)!;
              const statusLabel = ({
                active: "작성 중",
                review_submitted: "검수 중",
                completed: "정산 완료",
              } as any)[p.status] || p.status;
              return (
                <Link key={p.id} href={`/r/press/${c.id}/write?pass=${p.id}`} className="block rounded-md border border-hairline p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[14px] font-semibold">{store.name}</div>
                    <span className="text-[11px] bg-surfaceStrong text-ink px-2 py-0.5 rounded-full">{statusLabel}</span>
                  </div>
                  <div className="text-[12px] text-muted mt-1">{c.title} · 정산 ₩{c.supportAmount.toLocaleString()}</div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* 모집 중 기자단 */}
      <h2 className="px-5 mt-8 text-[16px] font-bold">모집 중 기자단</h2>
      <div className="px-5 mt-3 space-y-3">
        {press.map(({ c, store, remain, minNeededGrade, accessible }) => (
          <Link
            key={c.id}
            href={`/r/press/${c.id}`}
            className={`block rounded-md border border-hairline overflow-hidden ${accessible ? "" : "opacity-50"}`}
          >
            <div className="flex">
              <div className="w-24 bg-surfaceSoft grid place-items-center text-[40px]">{store.coverEmoji}</div>
              <div className="flex-1 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-[14px] font-semibold">{store.name}</div>
                  <GradeBadge grade={minNeededGrade} size="sm" />
                </div>
                <div className="text-[12px] text-muted mt-0.5 line-clamp-1">{c.title}</div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-[13px] font-medium text-ink">정산 ₩{c.supportAmount.toLocaleString()}</div>
                  <div className="text-[11px] text-muted">잔여 {remain}매</div>
                </div>
                {!accessible && (
                  <div className="mt-1 text-[11px] text-error">{minNeededGrade}등급부터 가능</div>
                )}
              </div>
            </div>
          </Link>
        ))}
        {press.length === 0 && (
          <div className="rounded-md border border-dashed border-hairline p-6 text-center text-muted text-[14px]">
            모집 중인 기자단이 없습니다
          </div>
        )}
      </div>
    </div>
  );
}
