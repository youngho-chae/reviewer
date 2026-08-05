import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import Icon from "@/components/Icon";
import { coverForCampaign } from "@/lib/store-photo";
import PrimaryStoreButton from "./PrimaryStoreButton";

export const dynamic = "force-dynamic";

export default async function OwnerStores() {
  const me = await getCurrentOwner();
  const db = await getDBAsync();
  const stores = db.stores.filter((s) => s.ownerId === me.id);
  // 대표 매장 (2026-07-31) — 미지정/소유 아님이면 첫 매장 폴백 (새 캠페인 생성 기본 선택)
  const primaryStoreId =
    me.primaryStoreId && stores.some((s) => s.id === me.primaryStoreId) ? me.primaryStoreId : stores[0]?.id;
  // 실제 썸네일 1장 (2026-08-04) — 플레이스 첫 썸네일(thumbnailUrl) 우선,
  // 없으면 최신 캠페인 대표 사진([0]) → 결정론 폴백 (coverForCampaign)
  const thumbOf = (storeId: string, category: string, thumbnailUrl?: string) => {
    if (thumbnailUrl) return thumbnailUrl;
    const latest = db.campaigns.filter((c) => c.storeId === storeId).sort((a, b) => b.createdAt - a.createdAt)[0];
    return coverForCampaign(latest?.photos, storeId, category);
  };

  return (
    <div className="pb-24 bg-canvas">
      {/* top-app-bar — 뒤로가기 + 타이틀 */}
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-3 flex items-center">
          <Link href="/o/me" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="더보기로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
          <h1 className="text-[18px] font-bold text-ink tracking-title">매장 정보</h1>
        </div>
      </div>
      <p className="px-5 pt-1 pb-3 text-[13px] text-muted">기본 정보는 CatchRank 본체에서 관리합니다.</p>

      <div className="mx-5 mt-1 rounded-lg border border-hairline bg-canvas p-4">
        <div className="text-[14px] font-bold text-ink">운영 정책</div>
        <ul className="mt-2 space-y-1 text-[12px] text-ink2 leading-[1.5]">
          <li>· 매장명/주소/카테고리 수정은 운영팀(help@catchrank.co.kr) 문의</li>
          <li>· 영업시간/안내사항 변경은 매장 카드 우측 [편집] 예정 (운영팀 협의)</li>
          <li>· 매장 추가 신청은 CatchRank 본체 사이트에서 진행</li>
          <li>· <span className="text-ink font-medium">대표 매장</span>은 새 캠페인 등록 화면의 기본 선택 매장이 됩니다</li>
        </ul>
      </div>

      <h2 className="px-5 mt-7 text-[18px] font-bold text-ink tracking-title">내 매장 {stores.length}곳</h2>
      <div className="px-5 mt-3 space-y-3">
        {/* 매장 카드 (2026-08-04 개선) — 표기 항목 고정: 실제 썸네일 1장 · 매장명 ·
            카테고리 · 전체 주소 · [대표 매장으로 지정] · [네이버 플레이스에서 보기]
            (지역·평점·영업시간·이모지 커버는 제거) */}
        {stores.map((s) => (
          <div key={s.id} className="rounded-lg border border-hairline bg-canvas overflow-hidden">
            <div className="flex items-stretch">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbOf(s.id, s.category, s.thumbnailUrl)}
                alt={`${s.name} 썸네일`}
                className="w-24 shrink-0 object-cover bg-sunken"
              />
              <div className="flex-1 min-w-0 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[15px] font-semibold text-ink truncate">{s.name}</div>
                  <PrimaryStoreButton storeId={s.id} isPrimary={s.id === primaryStoreId} />
                </div>
                <div className="text-[12px] text-muted mt-0.5">{s.category}</div>
                {s.address && <div className="text-[12px] text-ink2 mt-1 leading-[1.5]">{s.address}</div>}
                {s.naverPlaceId && (
                  <a
                    href={`https://m.place.naver.com/place/${s.naverPlaceId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="cp-action inline-block mt-2 text-[12px] font-semibold text-brand"
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
