import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { photoForStore } from "@/lib/store-photo";
import { SBUI, STORYBOARD, sbNum } from "@/lib/storyboard";
import { campaignRemain, campaignExposure } from "@/lib/campaign-visibility";
import { CANCEL_REAPPLY_COOLDOWN_MS } from "@/lib/pass-lifecycle";
import Icon from "@/components/Icon";
import InterestToggle from "./InterestToggle";
import ChannelIcons from "@/components/ChannelIcons";
import StoreParticipate from "./StoreParticipate";
import AddressCopy from "./AddressCopy";

export const dynamic = "force-dynamic";

export default async function StoreDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ campaign?: string }> }) {
  const me = await getCurrentReviewer();
  const { id } = await params;
  const { campaign: campaignId } = await searchParams;
  const db = await getDBAsync();
  const store = db.stores.find((s) => s.id === id);
  if (!store) return notFound();
  const now = Date.now();
  // 종료된 캠페인도 상세는 렌더한다 (관심 목록에서 진입 가능) — 단 신청은 차단 (2026-07-07 회의)
  const allCampaigns = db.campaigns.filter((c) => c.storeId === store.id && c.kind === "visit");
  const openCampaigns = allCampaigns.filter((c) => c.endAt > now);
  const c = allCampaigns.find((x) => x.id === campaignId) || openCampaigns[0];
  if (!c) return notFound();

  const ended = c.endAt <= now;
  const remain = campaignRemain(c);
  // 노출 상태 재사용 (재구현 금지) — issued_out = 잔여 0이지만 살아있는 체험권이 남아
  // 만료·취소 시 슬롯이 복구될 수 있는 상태 (완전 종료 아님, 2026-07-10 §1-2)
  const exposure = campaignExposure(c, db.passes, now);
  const interested = (db.interests ?? []).some((i) => i.reviewerId === me.id && i.campaignId === c.id);
  const myActivePass = db.passes.find((p) => p.reviewerId === me.id && p.campaignId === c.id && (p.status === "active" || p.status === "used" || p.status === "review_submitted"));
  // 취소 후 12h 재신청 쿨다운 — 발급 API와 동일 판정을 서버에서 미리 계산해 CTA에 반영 (§1-1)
  const recentCancel = db.passes.find(
    (p) =>
      p.reviewerId === me.id &&
      p.campaignId === c.id &&
      p.status === "cancelled" &&
      typeof p.cancelledAt === "number" &&
      now - p.cancelledAt < CANCEL_REAPPLY_COOLDOWN_MS,
  );
  const cooldownLeftH = recentCancel
    ? Math.max(1, Math.ceil((CANCEL_REAPPLY_COOLDOWN_MS - (now - (recentCancel.cancelledAt as number))) / 3600000))
    : null;

  const endDate = new Date(c.endAt);
  // 체험 마감일 표기 형식: "00월 00일 까지" (SBUI.endDate 마스크와 동일)
  const endLabel = `${String(endDate.getMonth() + 1).padStart(2, "0")}월 ${String(endDate.getDate()).padStart(2, "0")}일`;
  const placeUrl = store.naverPlaceId ? `https://m.place.naver.com/restaurant/${store.naverPlaceId}` : null;
  const mapLink = `https://map.naver.com/p/search/${encodeURIComponent(store.name)}`;

  return (
    <div className="pb-40 bg-canvas">
      {/* top-app-bar — 뒤로가기 + 관심 목록 토글 */}
      <div className="sticky top-0 z-30 bg-canvas">
        <div className="h-[52px] px-3 flex items-center justify-between">
          <Link href="/r/explore" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="뒤로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
          {/* 관심 목록 — 캠페인 단위 저장 (2026-07-07 회의) */}
          <InterestToggle campaignId={c.id} initialSaved={interested} />
        </div>
      </div>

      {/* 히어로 — full-bleed 사진 */}
      <section className="relative aspect-[4/3] bg-sunken overflow-hidden">
        <Image
          src={photoForStore(store.id, store.category)}
          alt={store.name}
          fill
          priority
          sizes="(max-width: 480px) 100vw, 480px"
          className="object-cover"
        />
      </section>

      {/* 매장 헤더 — 배지 + 이름 + 플레이스 링크 */}
      <section className="px-5 pt-4">
        <ChannelIcons channels={c.requiredChannels} />
        <h1 className="mt-2 text-[20px] font-bold text-ink tracking-title">{store.name}</h1>
        {placeUrl && (
          <a href={STORYBOARD ? undefined : placeUrl} className="mt-1 block text-[13px] text-info truncate">
            {sbNum("매장 플레이스 URL", placeUrl)}
          </a>
        )}

        {/* info-strip — 체험 마감일 / 리뷰 마감 기한 / 잔여 */}
        <div className="mt-4 rounded-md border border-hairline grid grid-cols-3">
          <div className="py-3.5 px-2 text-center">
            <div className="text-[12px] text-muted">체험 마감일</div>
            <div className="mt-1 text-[14px] font-semibold text-ink tabular-nums">{sbNum(SBUI.endDate, `${endLabel} 까지`)}</div>
          </div>
          <div className="py-3.5 px-2 text-center border-l border-r border-hairlineSoft">
            <div className="text-[12px] text-muted">리뷰 마감 기한</div>
            <div className="mt-1 text-[14px] font-semibold text-ink">이용 후 7일 이내</div>
          </div>
          <div className="py-3.5 px-2 text-center">
            <div className="text-[12px] text-brand font-semibold">🎫 잔여</div>
            <div className="mt-1 text-[14px] font-bold text-brand tabular-nums">{sbNum(SBUI.remain, `${remain}개`)}</div>
          </div>
        </div>

        {/* 종료 캠페인 — 관심 목록 경유 진입 시 신청 불가 안내 (2026-07-07 회의) */}
        {ended && (
          <div className="mt-3 rounded-md bg-sunken px-3.5 py-3 flex items-center gap-2">
            <span aria-hidden>⏰</span>
            <span className="text-[13px] font-semibold text-muted">종료된 체험입니다 · 새 캠페인이 열리면 다시 참여할 수 있어요.</span>
          </div>
        )}

        {/* 신청 완료 — 이미 참여 중인 체험 재접근 시 상태 안내 (§1-1) */}
        {!ended && myActivePass && (
          <div className="mt-3 rounded-md bg-successSoft px-3.5 py-3 flex items-center gap-2">
            <span aria-hidden>✅</span>
            <span className="text-[13px] font-semibold text-successStrong">
              이미 신청한 체험이에요 · 진행 상황은 내 체험권에서 확인할 수 있어요.
            </span>
          </div>
        )}

        {/* 체험권 일시 소진 — 완전 종료가 아님을 구분 안내 (§1-2: 72h 미사용 만료 시 복구 가능) */}
        {!ended && !myActivePass && exposure === "issued_out" && (
          <div className="mt-3 rounded-md bg-sunken px-3.5 py-3 flex items-center gap-2">
            <span aria-hidden>🎫</span>
            <span className="text-[13px] font-semibold text-muted">
              현재 신청 가능한 체험권이 없습니다 · 미사용 체험권이 발생하면 다시 신청할 수 있어요.
            </span>
          </div>
        )}

        {/* notice-banner — 사용 기한 고지 (정책: 발급 후 72시간, 연장·복구 불가) */}
        <div className="mt-3 rounded-md bg-brandSoft px-3.5 py-3 flex items-center gap-2">
          <span aria-hidden>💬</span>
          <span className="text-[13px] font-semibold text-brand">체험권 발급 후 72시간 내로 사용하지 않으면 사라져요.</span>
        </div>
      </section>

      {/* 채널 선택(라디오) + 정적 섹션 + 리뷰 조건 + CTA — StoreParticipate가 순서 관리 */}
      <StoreParticipate
        campaignId={c.id}
        base={c.supportAmount}
        requiredChannels={c.requiredChannels}
        myChannelGrades={me.channelGrades ?? {}}
        myActivePassId={myActivePass?.id ?? null}
        remain={remain}
        ended={ended}
        exposure={exposure}
        cooldownLeftH={cooldownLeftH}
      >
        {/* 필수 주문 메뉴 */}
        {c.requiredMenus.length > 0 && (
          <section className="px-5 mt-9">
            <h3 className="text-[18px] font-bold text-ink tracking-title">
              필수로 주문해야하는 메뉴가 있어요 <span className="text-brand">(택 1)</span>
            </h3>
            <p className="mt-1 text-[13px] text-muted">아래 메뉴를 필수로 주문해야 지원금을 받을 수 있어요</p>
            <div className="mt-3 space-y-2">
              {c.requiredMenus.map((m, i) => (
                <div key={`${m.name}-${i}`} className="rounded-sm bg-brandSoft px-3.5 py-3 flex items-center justify-between">
                  <span className="text-[15px] font-semibold text-brand">{m.name}</span>
                  {typeof m.price === "number" && m.price > 0 && (
                    <span className="text-[14px] font-semibold text-ink tabular-nums">{sbNum(SBUI.price, `${m.price.toLocaleString()}원`)}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 강조 키워드 */}
        {c.highlightKeywords && c.highlightKeywords.length > 0 && (
          <section className="px-5 mt-9">
            <h3 className="text-[18px] font-bold text-ink tracking-title">리뷰에 꼭 작성해주세요</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {c.highlightKeywords.map((kw, i) => (
                <span key={`${kw}-${i}`} className="px-3 py-1.5 rounded-pill bg-sunken text-[14px] text-ink2 font-medium">
                  #{kw}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* 매장 소개 */}
        <section className="px-5 mt-9">
          <h3 className="text-[18px] font-bold text-ink tracking-title">매장 소개</h3>
          <p className="mt-3 text-[15px] text-ink leading-[1.6] whitespace-pre-line">{c.description}</p>

          {/* 지도 스니펫 + 주소 — 탭 시 네이버 지도 */}
          <a href={mapLink} target="_blank" rel="noreferrer" className="cp-action block mt-4 rounded-md overflow-hidden border border-hairline" aria-label="네이버 지도에서 보기">
            {STORYBOARD ? (
              <div className="h-[140px] bg-sunken grid place-items-center text-[13px] text-muted">지도 영역 (탭 시 네이버 지도)</div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/map/static?center=${store.lng ?? 126.978},${store.lat ?? 37.5665}&level=15&w=800&h=280&marker=${encodeURIComponent(`type:t|size:mid|pos:${store.lng ?? 126.978} ${store.lat ?? 37.5665}`)}`}
                alt="매장 위치"
                className="w-full h-[140px] object-cover"
              />
            )}
          </a>
          {store.address && <AddressCopy address={STORYBOARD ? store.address : store.address} />}
        </section>

        {/* 이용 방법 — step-timeline */}
        <section className="px-5 mt-9">
          <h3 className="text-[18px] font-bold text-ink tracking-title">체험권 이용방법이 궁금해요</h3>
          <div className="mt-4 space-y-0">
            {[
              { t: "체험권 발급받기", d: "내 체험권에 QR이 발급됩니다." },
              { t: "QR 제시", d: "결제 전, 사장님께 발급받은 QR을 보여주세요." },
              { t: "리뷰 작성", d: "평소처럼 후기를 남기고 URL을 제출하면 완료!" },
            ].map((s, i, arr) => (
              <div key={s.t} className="flex gap-3.5">
                <div className="flex flex-col items-center">
                  <span className="w-6 h-6 rounded-full bg-brand text-white text-[12px] font-bold grid place-items-center shrink-0">{i + 1}</span>
                  {i < arr.length - 1 && <span className="w-[2px] flex-1 bg-brandTint my-1" />}
                </div>
                <div className="pb-5">
                  <div className="text-[15px] font-semibold text-ink leading-6">{s.t}</div>
                  <div className="mt-0.5 text-[13px] text-muted">{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </StoreParticipate>
    </div>
  );
}
