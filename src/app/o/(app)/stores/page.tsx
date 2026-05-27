import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function OwnerStores() {
  const me = await getCurrentOwner();
  const db = await getDBAsync();
  const stores = db.stores.filter((s) => s.ownerId === me.id);

  return (
    <div className="pb-24">
      <div className="px-5 pt-12 pb-3">
        <Link href="/o/me" className="text-muted text-[14px]">← 더보기</Link>
        <h1 className="mt-3 text-[22px] font-bold">매장 정보</h1>
        <p className="text-[13px] text-muted mt-1">기본 정보는 CatchRank 본체에서 관리합니다.</p>
      </div>

      <div className="px-5 mt-4 rounded-md border border-hairline p-4 bg-surfaceSoft">
        <div className="text-[13px] font-semibold">운영 정책</div>
        <ul className="mt-2 space-y-1 text-[12px] text-body">
          <li>· 매장명/주소/카테고리 수정은 운영팀(help@catchrank.co.kr) 문의</li>
          <li>· 영업시간/안내사항 변경은 매장 카드 우측 [편집] 예정 (운영팀 협의)</li>
          <li>· 매장 추가 신청은 CatchRank 본체 사이트에서 진행</li>
        </ul>
      </div>

      <h2 className="px-5 mt-6 text-[16px] font-bold">내 매장 {stores.length}곳</h2>
      <div className="px-5 mt-3 space-y-3">
        {stores.map((s) => (
          <div key={s.id} className="rounded-md border border-hairline overflow-hidden">
            <div className="flex">
              <div className="w-24 bg-surfaceSoft grid place-items-center text-[44px]">{s.coverEmoji}</div>
              <div className="flex-1 p-3">
                <div className="text-[15px] font-semibold">{s.name}</div>
                <div className="text-[12px] text-muted mt-0.5">{s.area} · {s.category} · ★ {s.rating}</div>
                {s.address && <div className="text-[12px] text-muted mt-1">📍 {s.address}</div>}
                <div className="text-[12px] text-muted mt-1">🕐 {s.hours}</div>
                {s.naverPlaceId && (
                  <a
                    href={`https://m.place.naver.com/place/${s.naverPlaceId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-2 text-[12px] text-ink underline"
                  >
                    네이버 플레이스에서 보기 →
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
        {stores.length === 0 && (
          <div className="rounded-md border border-dashed border-hairline p-6 text-center text-muted text-[14px]">
            등록된 매장이 없습니다
          </div>
        )}
      </div>
    </div>
  );
}
