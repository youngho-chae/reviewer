import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { readRecentPasses } from "@/lib/recent-passes-cookie";
import PressWriteForm from "./PressWriteForm";

export const dynamic = "force-dynamic";

const ch_label: any = { naver_blog: "네이버 블로그", instagram: "인스타그램", youtube: "유튜브", tiktok: "틱톡" };
const ad_label: any = {
  naver_blog: "본 콘텐츠는 [매장명]으로부터 협찬 받아 작성되었습니다.",
  instagram: "#광고 #협찬 — [매장명] 협찬",
  youtube: "유료 광고 포함 (#광고)",
  tiktok: "#광고 #협찬",
};

export default async function PressWrite({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pass?: string }> }) {
  const me = await getCurrentReviewer();
  const { id } = await params;
  const { pass: passId } = await searchParams;
  const db = await getDBAsync();

  let c: any = db.campaigns.find((x) => x.id === id && x.kind === "press");
  let store: any = c ? db.stores.find((s) => s.id === c.storeId) : null;
  let pass: any = passId ? db.passes.find((p) => p.id === passId && p.reviewerId === me.id) : null;

  // 쿠키 stopgap — db에 없으면 쿠키에서 보충
  if (!pass || !c || !store) {
    const recent = await readRecentPasses();
    if (!pass && passId) {
      const hit = recent.find((r) => r.pass.id === passId && r.pass.reviewerId === me.id);
      if (hit) pass = hit.pass;
    }
    if (!c) {
      const hit = recent.find((r) => r.campaign?.id === id && r.campaign?.kind === "press");
      if (hit) c = hit.campaign;
    }
    if (!store && c) {
      const hit = recent.find((r) => r.store?.id === c.storeId);
      if (hit) store = hit.store;
    }
  }

  if (!c) return notFound();
  if (!store) return notFound();
  if (!pass) {
    if (passId) redirect(`/r/passes?pending=${encodeURIComponent(passId)}`);
    return notFound();
  }

  const statusLabel = ({
    active: "작성 가능",
    review_submitted: "검수 중",
    completed: "정산 완료",
    rejected: "반려",
    expired: "만료",
  } as any)[pass.status] || pass.status;

  return (
    <div className="pb-24">
      <div className="px-5 pt-12 pb-3">
        <Link href={`/r/press/${c.id}`} className="text-muted text-[14px]">← 브리프</Link>
        <h1 className="mt-3 text-[22px] font-bold">기자단 작성</h1>
        <div className="text-[13px] text-muted mt-1">{store.name} · {c.title}</div>
      </div>

      {/* 자료팩 풀공개 */}
      <h2 className="px-5 mt-6 text-[16px] font-bold">📦 자료팩 (풀공개)</h2>
      <div className="mx-5 mt-3 rounded-md border border-hairline overflow-hidden divide-y divide-hairline">
        {((c.pressMaterials as string[] | undefined) || []).map((m: string, i: number) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="text-[18px]">📎</div>
            <div className="flex-1 text-[13px]">{m}</div>
            <div className="text-[11px] text-ink underline cursor-pointer">다운로드</div>
          </div>
        ))}
      </div>

      {/* 키워드 체크 */}
      <h2 className="px-5 mt-6 text-[16px] font-bold">🏷️ 필수 키워드</h2>
      <div className="px-5 mt-3 flex flex-wrap gap-2">
        {((c.pressKeywords as string[] | undefined) || []).map((k: string) => (
          <span key={k} className="px-3 py-1.5 rounded-full bg-surfaceSoft text-[13px]">#{k}</span>
        ))}
      </div>
      <p className="px-5 mt-2 text-[11px] text-muted">위 키워드를 본문에 모두 포함시켜주세요</p>

      {/* 광고 표시 문구 */}
      <h2 className="px-5 mt-6 text-[16px] font-bold">📌 광고 표시 문구 (필수)</h2>
      <div className="mx-5 mt-3 rounded-md border border-warning/30 bg-warning/10 p-4">
        {(c.requiredChannels as string[]).map((ch: string) => (
          <div key={ch} className="text-[13px] py-1">
            <span className="font-medium">{ch_label[ch]}:</span>{" "}
            <span className="text-body">{(ad_label[ch] as string).replace("[매장명]", store.name)}</span>
          </div>
        ))}
      </div>

      {/* 작성 폼 */}
      <h2 className="px-5 mt-6 text-[16px] font-bold">✍️ 작성 제출</h2>
      <div className="px-5 mt-3">
        <div className="mb-3 text-[12px] text-muted">
          상태: <span className="text-ink font-medium">{statusLabel}</span>
        </div>
        {pass.status === "active" ? (
          <PressWriteForm
            passId={pass.id}
            channels={c.requiredChannels}
            keywords={c.pressKeywords || []}
          />
        ) : (
          <div className="rounded-md border border-hairline p-4">
            <div className="text-[13px] font-medium">제출된 URL</div>
            <a href={pass.reviewUrl} target="_blank" rel="noreferrer" className="block mt-1 text-[13px] text-ink underline truncate">{pass.reviewUrl}</a>
          </div>
        )}
      </div>
    </div>
  );
}
