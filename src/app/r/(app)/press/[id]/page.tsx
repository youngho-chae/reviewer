import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import GradeBadge from "@/components/GradeBadge";
import { gradeMeets } from "@/lib/grade";
import PressApplyButton from "./PressApplyButton";

export const dynamic = "force-dynamic";

const ch_label: any = { naver_blog: "네이버 블로그", instagram: "인스타그램", youtube: "유튜브", tiktok: "틱톡" };

export default async function PressBrief({ params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentReviewer();
  const { id } = await params;
  const db = await getDBAsync();
  const c = db.campaigns.find((x) => x.id === id && x.kind === "press");
  if (!c) return notFound();
  const store = db.stores.find((s) => s.id === c.storeId);
  if (!store) return notFound();

  const totalQ = c.quota.S + c.quota.A + c.quota.B + c.quota.C;
  const usedQ = c.used.S + c.used.A + c.used.B + c.used.C;
  const remain = totalQ - usedQ;
  const minNeededGrade: "S" | "A" | "B" | "C" =
    c.quota.C > 0 ? "C" : c.quota.B > 0 ? "B" : c.quota.A > 0 ? "A" : "S";
  const accessible = gradeMeets(me.grade, minNeededGrade);
  const myPass = db.passes.find((p) => p.reviewerId === me.id && p.campaignId === c.id && p.status !== "expired" && p.status !== "rejected");
  const daysLeft = Math.max(0, Math.ceil((c.endAt - Date.now()) / 86400000));
  const slotsLow = remain > 0 && remain <= 2;
  const closed = remain === 0;

  return (
    <div className="pb-32 bg-canvas min-h-[100dvh]">
      {/* Top bar */}
      <div className="px-5 pt-12 pb-2 flex items-center gap-3">
        <Link href="/r/home" className="w-9 h-9 rounded-full bg-surfaceSoft grid place-items-center text-[18px]">←</Link>
        <div className="text-[13px] font-bold text-muted tracking-wide">기자단 캠페인 · 신청 전 확인</div>
      </div>

      {/* Hero card (dark) */}
      <div className="mx-5 mt-2 p-5 rounded-lg bg-ink text-white relative overflow-hidden">
        <div className="flex items-center gap-2 mb-2.5">
          <GradeBadge grade={minNeededGrade} size="sm" inverted />
          <span className="text-[11px] font-bold tracking-wider text-white/70">기자단 · {minNeededGrade}등급 · 비방문</span>
        </div>
        <div className="text-[22px] font-extrabold tracking-tight">{store.name}</div>
        <div className="text-[13px] text-white/60 mt-1">{store.area} · {store.category}</div>

        <div className="mt-4 pt-3.5 border-t border-white/10 grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10.5px] text-white/55 font-semibold tracking-wide">정산 예정금</div>
            <div className="text-[22px] font-extrabold mt-0.5 tracking-tight">
              {c.supportAmount.toLocaleString()}<span className="text-[12px] font-semibold">원</span>
            </div>
            <div className="text-[10px] text-white/45 mt-0.5">3.3% 원천징수 후 입금</div>
          </div>
          <div>
            <div className="text-[10.5px] text-white/55 font-semibold tracking-wide">모집 마감</div>
            <div className={`text-[18px] font-bold mt-1 ${daysLeft <= 1 ? "text-brand" : "text-white"}`}>D-{daysLeft}</div>
            <div className="text-[10px] text-white/45 mt-0.5">신청 후 자료 즉시 전달</div>
          </div>
        </div>

        <div className={`mt-3.5 px-3 py-2.5 rounded-md flex items-center justify-between ${closed ? "bg-error/20" : slotsLow ? "bg-brand/20" : "bg-white/[0.06]"}`}>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${closed ? "bg-error" : slotsLow ? "bg-brand" : "bg-success"}`} />
            <span className="text-[12px] font-bold">{closed ? "모집 마감" : `잔여 ${remain}자리 / 총 ${totalQ}명`}</span>
          </div>
          {!closed && slotsLow && <span className="text-[10.5px] font-bold text-brand tracking-wide">곧 마감</span>}
        </div>
      </div>

      {/* 자료팩 */}
      <div className="px-5 mt-5">
        <div className="flex items-baseline justify-between mb-2.5">
          <h3 className="text-[15px] font-extrabold tracking-tight">📦 자료팩 미리보기</h3>
          <span className="text-[11px] font-semibold text-muted">총 {c.pressMaterials?.length || 0}장 · 신청 후 다운로드</span>
        </div>
        <div className="rounded-md border border-hairline overflow-hidden">
          {(c.pressMaterials || []).map((m, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 ${myPass ? "" : "blur-[2px] select-none"} ${i > 0 ? "border-t border-hairline" : ""}`}>
              <div className="text-[18px]">📎</div>
              <div className="flex-1 text-[13px]">{m}</div>
              {!myPass && <div className="text-[11px] text-muted">🔒</div>}
            </div>
          ))}
          {(!c.pressMaterials || c.pressMaterials.length === 0) && (
            <div className="px-4 py-6 text-center text-muted text-[13px]">자료가 등록되지 않았습니다</div>
          )}
        </div>
      </div>

      {/* 매장 정보 */}
      <div className="px-5 mt-5">
        <h3 className="text-[15px] font-extrabold tracking-tight mb-2.5">🏪 매장 정보</h3>
        <div className="p-3.5 bg-surfaceSoft border border-hairline rounded-md text-[13px] leading-7 text-ink">
          <div><span className="text-muted font-semibold mr-2">위치</span>{store.area} · {store.category}</div>
          <div><span className="text-muted font-semibold mr-2">영업시간</span>{store.hours}</div>
          <div><span className="text-muted font-semibold mr-2">제출 방식</span>본인 채널에 작성 후 URL 제출</div>
        </div>
      </div>

      {/* 필수 키워드 */}
      <div className="px-5 mt-5">
        <h3 className="text-[15px] font-extrabold tracking-tight">✓ 필수 키워드</h3>
        <p className="text-[12px] text-muted mt-1 leading-relaxed">아래 키워드를 모두 포함해 작성해야 검수를 통과합니다.</p>
        <div className="flex gap-1.5 flex-wrap mt-2.5">
          {(c.pressKeywords || []).map((k) => (
            <span key={k} className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-ink text-white"># {k}</span>
          ))}
        </div>
      </div>

      {/* 채널 */}
      <div className="px-5 mt-5">
        <h3 className="text-[15px] font-extrabold tracking-tight mb-2.5">📣 리뷰 게시 채널</h3>
        <div className="flex gap-2 flex-wrap">
          {c.requiredChannels.map((ch) => (
            <span key={ch} className="text-[12px] font-semibold px-3 py-2 rounded-md bg-white border border-hairline">{ch_label[ch]}</span>
          ))}
        </div>
        <div className="text-[11px] text-muted mt-2 leading-relaxed">위 중 1개 이상 채널에 게시. 광고 표시 문구는 자동 안내됩니다.</div>
      </div>

      {/* 캠페인 설명 */}
      <div className="px-5 mt-5">
        <h3 className="text-[15px] font-extrabold tracking-tight mb-2.5">📝 캠페인 설명</h3>
        <p className="text-[14px] text-body leading-relaxed">{c.description}</p>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-[var(--bottom-nav-h,72px)] left-0 right-0 mx-auto max-w-[480px] px-5 py-3.5 bg-white/95 backdrop-blur border-t border-hairline z-20">
        {myPass ? (
          <Link href={`/r/press/${c.id}/write?pass=${myPass.id}`} className="block h-14 rounded-full bg-ink text-white grid place-items-center text-[16px] font-bold">
            기자단 작성하기 →
          </Link>
        ) : closed ? (
          <button disabled className="w-full h-14 rounded-full bg-surfaceStrong text-muted text-[16px] font-bold">마감되었습니다</button>
        ) : !accessible ? (
          <button disabled className="w-full h-14 rounded-full bg-surfaceStrong text-muted text-[16px] font-bold">{minNeededGrade}등급부터 이용 가능합니다</button>
        ) : (
          <PressApplyButton campaignId={c.id} />
        )}
      </div>
    </div>
  );
}
