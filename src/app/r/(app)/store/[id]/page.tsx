import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import GradeBadge from "@/components/GradeBadge";
import ParticipateButton from "./ParticipateButton";

export const dynamic = "force-dynamic";

export default async function StoreDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ campaign?: string }> }) {
  const me = await getCurrentReviewer();
  const { id } = await params;
  const { campaign: campaignId } = await searchParams;
  const db = await getDBAsync();
  const store = db.stores.find((s) => s.id === id);
  if (!store) return notFound();
  const campaigns = db.campaigns.filter((c) => c.storeId === store.id && c.endAt > Date.now());
  const c = campaigns.find((x) => x.id === campaignId) || campaigns[0];
  if (!c) return notFound();

  const totalQ = c.quota.S + c.quota.A + c.quota.B + c.quota.C;
  const usedQ = c.used.S + c.used.A + c.used.B + c.used.C;
  const remain = totalQ - usedQ;
  const minNeededGrade: "S" | "A" | "B" | "C" =
    c.quota.C > 0 ? "C" : c.quota.B > 0 ? "B" : c.quota.A > 0 ? "A" : "S";
  // 이미 참여 중인지
  const myActivePass = db.passes.find((p) => p.reviewerId === me.id && p.campaignId === c.id && (p.status === "active" || p.status === "used" || p.status === "review_submitted"));

  return (
    <div className="pb-32 bg-canvas">
      <Link href="/r/home" className="fixed left-4 top-12 z-10 w-10 h-10 rounded-full bg-white/95 backdrop-blur grid place-items-center text-[18px] shadow-card">←</Link>
      <div className="h-80 bg-surfaceSoft flex items-center justify-center text-[100px]">{store.coverEmoji}</div>

      <div className="px-5 pt-5 bg-canvas rounded-t-[24px] -mt-6 relative">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">{store.name}</h1>
        <div className="mt-1.5 text-[14px] text-muted">{store.area} · {store.category} · ★ {store.rating} <span className="text-mutedSoft">({store.reviewCount.toLocaleString()})</span></div>
        {store.address && (
          <div className="mt-1 text-[13px] text-muted">📍 {store.address}</div>
        )}
        {store.naverPlaceId && (
          <a
            href={`https://m.place.naver.com/place/${store.naverPlaceId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-2 text-[12px] text-ink underline"
          >
            네이버 플레이스에서 보기 →
          </a>
        )}

        <div className="mt-5 rounded-md bg-surfaceSoft border border-hairline p-5">
          <div className="text-[12px] text-muted font-semibold tracking-wide">멤버십 할인 지원금</div>
          <div className="text-[36px] font-extrabold text-ink leading-none tracking-tight mt-1.5">
            {c.supportAmount.toLocaleString()}<span className="text-[18px] font-semibold">원</span>
          </div>
          <div className="h-px bg-hairline my-3.5" />
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between"><span className="text-muted">모집 인원</span><span className="font-semibold">{remain}<span className="text-muted"> / {totalQ}매 남음</span></span></div>
            <div className="flex justify-between"><span className="text-muted">사용 기한</span><span className="font-semibold">발급 후 24시간</span></div>
            <div className="flex justify-between"><span className="text-muted">방문 가능 시간</span><span className="font-semibold">{store.hours}</span></div>
          </div>
        </div>

        <h2 className="mt-6 text-[18px] font-bold">이용 방법</h2>
        <ol className="mt-3 space-y-2 text-[14px]">
          <li className="flex gap-2"><span className="w-6 h-6 rounded-full bg-ink text-white grid place-items-center text-[12px] font-bold">1</span> 참여하기 → 24시간 이내 사용</li>
          <li className="flex gap-2"><span className="w-6 h-6 rounded-full bg-ink text-white grid place-items-center text-[12px] font-bold">2</span> 매장 방문 후 결제 전 QR 제시</li>
          <li className="flex gap-2"><span className="w-6 h-6 rounded-full bg-ink text-white grid place-items-center text-[12px] font-bold">3</span> 60일 이상 게시 가능한 리뷰 작성</li>
        </ol>

        <h2 className="mt-6 text-[18px] font-bold">필수 리뷰 채널 (택1)</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {c.requiredChannels.map((ch) => (
            <span key={ch} className="px-3 py-1.5 rounded-full bg-surfaceSoft text-[13px]">{({
              naver_blog: "네이버 블로그", instagram: "인스타그램", youtube: "유튜브", tiktok: "틱톡"
            } as any)[ch]}</span>
          ))}
        </div>

        <h2 className="mt-6 text-[18px] font-bold">필수 주문 메뉴 (택1)</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {c.requiredMenus.map((m) => (
            <span key={m} className="px-3 py-1.5 rounded-full bg-surfaceSoft text-[13px]">{m}</span>
          ))}
        </div>

        <h2 className="mt-6 text-[18px] font-bold">캠페인 소개</h2>
        <p className="mt-2 text-[14px] text-body leading-relaxed">{c.description}</p>
      </div>

      <div className="fixed bottom-[var(--bottom-nav-h,72px)] left-0 right-0 mx-auto max-w-[480px] px-5 py-3.5 bg-white/95 backdrop-blur border-t border-hairline z-20">
        {myActivePass ? (
          <Link href={`/r/passes/${myActivePass.id}`} className="block h-14 rounded-full bg-ink text-white grid place-items-center text-[16px] font-bold">
            내 체험권 보기 →
          </Link>
        ) : remain <= 0 ? (
          <button disabled className="w-full h-14 rounded-full bg-surfaceStrong text-muted text-[16px] font-bold">마감되었습니다</button>
        ) : !["S","A","B","C","N"].includes(me.grade) || (() => { const order=["S","A","B","C","N"]; return order.indexOf(me.grade) > order.indexOf(minNeededGrade); })() ? (
          <button disabled className="w-full h-14 rounded-full bg-surfaceStrong text-muted text-[16px] font-bold">{minNeededGrade}등급부터 이용 가능합니다</button>
        ) : (
          <ParticipateButton campaignId={c.id} myGrade={me.grade} />
        )}
      </div>
    </div>
  );
}
