import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { photoForStore } from "@/lib/store-photo";
import { channelOffers, bestEligibleSupport } from "@/lib/grade";
import type { Grade } from "@/lib/types";
import Icon from "@/components/Icon";
import StoreParticipate from "./StoreParticipate";
import NaverMapButton from "./NaverMapButton";

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
  const minNeededGrade: Grade =
    c.quota.C > 0 ? "C" : c.quota.B > 0 ? "B" : c.quota.A > 0 ? "A" : "S";
  const myActivePass = db.passes.find((p) => p.reviewerId === me.id && p.campaignId === c.id && (p.status === "active" || p.status === "used" || p.status === "review_submitted"));

  // 채널별 등급으로 내가 받을 수 있는 최대 혜택
  const offers = channelOffers(c.requiredChannels, me.channelGrades, minNeededGrade, c.supportAmount);
  const myBest = bestEligibleSupport(offers);

  return (
    <div className="pb-32 bg-canvas">
      {/* Frosted parchment top nav (Apple sub-nav-frosted) */}
      <div className="sticky top-0 z-10 frosted-parchment border-b border-hairlineSoft">
        <div className="h-13 px-5 flex items-center justify-between">
          <Link href="/r/home" className="cp-action inline-flex items-center gap-1 text-[17px] text-brand">
            <Icon name="chevron-left" variant="border" size={18} />
            <span>홈</span>
          </Link>
          <div className="text-[14px] text-ink font-medium">{store.category}</div>
        </div>
      </div>

      {/* Hero — full-bleed photographic tile (real store photo) */}
      <section className="relative aspect-[4/3] bg-parchment overflow-hidden">
        <Image
          src={photoForStore(store.id, store.category)}
          alt={store.name}
          fill
          priority
          sizes="(max-width: 480px) 100vw, 480px"
          className="object-cover"
        />
      </section>

      {/* Light product-tile content */}
      <section className="px-6 pt-12 pb-10 text-center bg-canvas">
        <div className="text-[12px] tracking-[0.18em] text-muted uppercase mb-2">{store.area}</div>
        <h1 className="font-display text-[40px] leading-[1.07] text-ink">
          {store.name}
        </h1>
        <p className="mt-3 text-[19px] leading-[1.4] text-ink2">
          {store.category} · ★ {store.rating} <span className="text-muted">(네이버 리뷰 {store.reviewCount.toLocaleString()}건)</span>
        </p>
        {store.address && <p className="mt-2 text-[14px] text-muted">{store.address}</p>}
      </section>

      {/* Dark product tile — pricing hero */}
      <section className="bg-tile1 text-white py-16 px-6 text-center">
        <div className="text-[12px] tracking-[0.18em] text-mutedSoft uppercase mb-3">
          {myBest > 0 ? "내가 받을 수 있는 지원금" : "최대 멤버십 할인 지원금"}
        </div>
        <div className="font-display text-[56px] leading-[1.07] tracking-[-0.026em]">
          ₩{(myBest > 0 ? myBest : c.supportAmount).toLocaleString()}
        </div>
        <p className="mt-4 text-[15px] text-mutedSoft leading-[1.4]">
          {myBest > 0
            ? "연동 채널·등급에 따라 자동 계산된 금액이에요."
            : `최대 ₩${c.supportAmount.toLocaleString()} (S등급) · 채널·등급에 따라 달라져요.`}
        </p>
        <div className="mt-8 max-w-[280px] mx-auto grid grid-cols-3 gap-3 text-left">
          <div className="text-center">
            <div className="text-[19px] font-semibold tracking-[-0.022em]">{remain}매</div>
            <div className="text-[12px] text-mutedSoft mt-1">잔여</div>
          </div>
          <div className="text-center border-l border-r border-white/10">
            <div className="text-[19px] font-semibold tracking-[-0.022em]">24시간</div>
            <div className="text-[12px] text-mutedSoft mt-1">사용 기한</div>
          </div>
          <div className="text-center">
            <div className="text-[14px] font-semibold tracking-[-0.022em]">{store.hours}</div>
            <div className="text-[12px] text-mutedSoft mt-1">영업</div>
          </div>
        </div>
      </section>

      {/* Light tile — how it works */}
      <section className="bg-canvas py-16 px-6">
        <h2 className="font-display text-[34px] leading-[1.1] text-ink text-center mb-10">이용 방법, 3단계.</h2>
        <div className="space-y-7 max-w-[340px] mx-auto">
          {[
            { n: "1", t: "참여하기", d: "QR이 내 체험권에 발급됩니다." },
            { n: "2", t: "QR 제시", d: "결제 전, 사장님께 한 번 보여주세요." },
            { n: "3", t: "리뷰 작성", d: "평소처럼 후기를 남기고 URL 제출." },
          ].map((s) => (
            <div key={s.n} className="flex gap-4">
              <div className="text-[14px] font-semibold text-brand w-6 flex-shrink-0 pt-1">{s.n}</div>
              <div>
                <div className="text-[17px] font-semibold text-ink">{s.t}</div>
                <div className="text-[15px] text-ink2 mt-1 leading-[1.47]">{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Parchment tile — required menus */}
      {c.requiredMenus.length > 0 && (
        <section className="bg-parchment py-14 px-6">
          <h3 className="text-[12px] tracking-[0.18em] text-muted uppercase mb-3">필수 주문 메뉴 (택 1)</h3>
          <div className="space-y-2">
            {c.requiredMenus.map((m, i) => (
              <div key={`${m.name}-${i}`} className="bg-canvas border border-hairline rounded-md px-4 py-3 flex items-center gap-3">
                <span className="text-[12px] text-muted w-4 flex-shrink-0">{i + 1}</span>
                <span className="text-[15px] text-ink flex-1">{m.name}</span>
                {typeof m.price === "number" && m.price > 0 && (
                  <span className="text-[14px] font-medium text-ink tabular-nums">
                    ₩{m.price.toLocaleString()}
                  </span>
                )}
              </div>
            ))}
          </div>
          {c.requiredMenus.some((m) => typeof m.price === "number" && m.price > 0) && (
            <p className="mt-3 text-[12px] text-muted leading-[1.5]">
              위 메뉴 결제 시 내 채널 등급에 맞춘 지원금(최대 <span className="text-ink font-medium">₩{c.supportAmount.toLocaleString()}</span>)이
              매장 할인으로 즉시 차감됩니다.
            </p>
          )}
        </section>
      )}

      {/* Light tile — 매장 소개 + 강조 키워드 */}
      <section className="bg-canvas py-14 px-6">
        <h3 className="text-[12px] tracking-[0.18em] text-muted uppercase mb-3">매장 소개</h3>
        <p className="text-[17px] text-ink leading-[1.47] whitespace-pre-line">{c.description}</p>

        {c.highlightKeywords && c.highlightKeywords.length > 0 && (
          <div className="mt-8">
            <h4 className="text-[12px] tracking-[0.18em] text-muted uppercase mb-3">후기에 꼭 강조해주세요</h4>
            <div className="flex flex-wrap gap-2">
              {c.highlightKeywords.map((kw) => (
                <span key={kw} className="px-3 py-1.5 rounded-pill bg-brandSoft border border-brand/20 text-[13px] text-brand font-medium">
                  #{kw}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 참여 채널 선택 + 등급별 지원금 자동 계산 + 리뷰 조건 (client) */}
      <StoreParticipate
        campaignId={c.id}
        base={c.supportAmount}
        minGrade={minNeededGrade}
        requiredChannels={c.requiredChannels}
        myChannelGrades={me.channelGrades ?? {}}
        myActivePassId={myActivePass?.id ?? null}
        remain={remain}
      />

      {/* Floating 길찾기 FAB — sticky CTA 바 위 우측, 네이버 지도 deep link */}
      <div
        className="fixed inset-x-0 mx-auto max-w-[480px] z-20 pointer-events-none"
        style={{ bottom: "calc(var(--bottom-nav-h, 72px) + 80px)" }}
      >
        <div className="flex justify-end px-5 pointer-events-auto">
          <NaverMapButton
            storeName={store.name}
            lat={store.lat}
            lng={store.lng}
            naverPlaceId={store.naverPlaceId}
            address={store.address}
          />
        </div>
      </div>
    </div>
  );
}
