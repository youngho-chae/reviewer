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

  return (
    <div className="pb-10">
      <Link href="/r/press" className="absolute left-4 top-4 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur grid place-items-center text-[18px]">←</Link>
      <div className="h-44 bg-surfaceSoft flex items-center justify-center text-[72px]">{store.coverEmoji}</div>

      <div className="px-5 pt-5">
        <div className="flex items-center justify-between">
          <h1 className="text-[20px] font-bold">{store.name}</h1>
          <GradeBadge grade={minNeededGrade} size="sm" />
        </div>
        <div className="mt-1 text-[14px] text-muted">{c.title}</div>

        <div className="mt-5 rounded-md border border-hairline p-4">
          <div className="text-[12px] text-muted">정산 예정금</div>
          <div className="text-[28px] font-bold text-ink mt-1">₩{c.supportAmount.toLocaleString()}</div>
          <div className="text-[11px] text-muted mt-1">검수 통과 시 익월 25일 입금</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
            <div>
              <div className="text-muted">잔여</div>
              <div className="text-ink font-medium">{remain}매</div>
            </div>
            <div>
              <div className="text-muted">최소 본문</div>
              <div className="text-ink font-medium">{c.pressMinChars?.toLocaleString() || 1000}자 이상</div>
            </div>
          </div>
        </div>

        <h2 className="mt-6 text-[18px] font-bold">자료팩 미리보기</h2>
        <div className="mt-3 rounded-md border border-hairline overflow-hidden">
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
        {!myPass && (
          <div className="mt-2 text-[11px] text-muted">참여 신청 후 자료팩이 풀공개됩니다</div>
        )}

        <h2 className="mt-6 text-[18px] font-bold">필수 키워드</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(c.pressKeywords || []).map((k) => (
            <span key={k} className="px-3 py-1.5 rounded-full bg-surfaceSoft text-[13px]">#{k}</span>
          ))}
        </div>

        <h2 className="mt-6 text-[18px] font-bold">필수 채널</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {c.requiredChannels.map((ch) => (
            <span key={ch} className="px-3 py-1.5 rounded-full bg-surfaceSoft text-[13px]">{ch_label[ch]}</span>
          ))}
        </div>

        <h2 className="mt-6 text-[18px] font-bold">캠페인 설명</h2>
        <p className="mt-2 text-[14px] text-body leading-relaxed">{c.description}</p>
      </div>

      <div className="sticky bottom-16 inset-x-0 px-5 mt-8">
        {myPass ? (
          <Link href={`/r/press/${c.id}/write?pass=${myPass.id}`} className="block h-14 rounded-sm bg-ink text-white grid place-items-center text-[16px] font-medium">
            기자단 작성하기 →
          </Link>
        ) : remain <= 0 ? (
          <button disabled className="w-full h-14 rounded-sm bg-surfaceStrong text-muted text-[16px] font-medium">마감되었습니다</button>
        ) : !accessible ? (
          <button disabled className="w-full h-14 rounded-sm bg-surfaceStrong text-muted text-[16px] font-medium">{minNeededGrade}등급부터 이용 가능합니다</button>
        ) : (
          <PressApplyButton campaignId={c.id} />
        )}
      </div>
    </div>
  );
}
