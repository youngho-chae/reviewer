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
    <div className="pb-10">
      <Link href="/r/home" className="absolute left-4 top-4 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur grid place-items-center text-[18px]">←</Link>
      <div className="h-56 bg-surfaceSoft flex items-center justify-center text-[88px]">{store.coverEmoji}</div>

      <div className="px-5 pt-5">
        <h1 className="text-[22px] font-medium leading-tight">{store.name}</h1>
        <div className="mt-1 text-[14px] text-muted">{store.area} · {store.category} · ★ {store.rating} ({store.reviewCount})</div>

        <div className="mt-5 rounded-md border border-hairline p-4">
          <div className="text-[12px] text-muted">지원금</div>
          <div className="text-[28px] font-bold text-ink mt-1">₩{c.supportAmount.toLocaleString()}</div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
            <div>
              <div className="text-muted">잔여</div>
              <div className="text-ink font-medium">{remain}매</div>
            </div>
            <div>
              <div className="text-muted">사용기한</div>
              <div className="text-ink font-medium">참여 후 24시간</div>
            </div>
            <div>
              <div className="text-muted">영업시간</div>
              <div className="text-ink font-medium">{store.hours}</div>
            </div>
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

      <div className="sticky bottom-16 inset-x-0 px-5 mt-8">
        {myActivePass ? (
          <Link href={`/r/passes/${myActivePass.id}`} className="block h-14 rounded-sm bg-ink text-white grid place-items-center text-[16px] font-medium">
            내 체험권 보기 →
          </Link>
        ) : remain <= 0 ? (
          <button disabled className="w-full h-14 rounded-sm bg-surfaceStrong text-muted text-[16px] font-medium">마감되었습니다</button>
        ) : !["S","A","B","C","N"].includes(me.grade) || (() => { const order=["S","A","B","C","N"]; return order.indexOf(me.grade) > order.indexOf(minNeededGrade); })() ? (
          <button disabled className="w-full h-14 rounded-sm bg-surfaceStrong text-muted text-[16px] font-medium">{minNeededGrade}등급부터 이용 가능합니다</button>
        ) : (
          <ParticipateButton campaignId={c.id} myGrade={me.grade} />
        )}
      </div>
    </div>
  );
}
