import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";
import DeleteAccountButton from "@/components/DeleteAccountButton";
import Icon, { type IconName } from "@/components/Icon";
import { ownedRefills } from "@/lib/limit-refill";
import { coverForCampaign } from "@/lib/store-photo";

export const dynamic = "force-dynamic";

// 사장님 마이페이지 (2026-08-10 개편) — 와이어프레임 톤(이모지 아이콘·텍스트 화살표·
// 밋밋한 지표 카드)을 디자인 시스템 v2 문법으로 재구성:
//  · 프로필 카드 = 대표매장 실썸네일(88×66 — 매장 정보 카드와 동일 소스)+매장명+카테고리
//    +스탯 스트립 병합 (체험자 마이 프로필 카드와 동일 문법, 2026-08-05)
//  · 멤버십 = 메뉴 행에서 전용 다크 카드로 승격 — /o/membership 다크 히어로와 동일 아이덴티티
//    (플랜명·결제 방식 칩·보유 리필권, Free는 "플랜 시작하기" 유도)
//  · 메뉴 = SVG 아이콘 시스템(Icon — 이모지 폐기)+chevron, [운영 관리]/[알림·지원] 섹션 분리
export default async function OwnerMe() {
  const me = await getCurrentOwner();
  const db = await getDBAsync();
  const stores = db.stores.filter((s) => s.ownerId === me.id);
  // 대표 매장 (2026-07-31 — Owner.primaryStoreId, 미지정 시 첫 매장. 지정은 [매장 정보])
  const primaryStore = stores.find((s) => s.id === me.primaryStoreId) ?? stores[0];
  const passes = db.passes.filter((p) => p.ownerId === me.id);
  const totalReviews = passes.filter((p) => p.status === "completed").length;
  const totalSupport = passes.reduce((s, p) => s + (p.supportApplied || 0), 0);
  const unreadNotifications = db.notifications.filter((n) => n.role === "owner" && n.userId === me.id && !n.read).length;
  const ownedCoupons = ownedRefills(db, me.id).length; // 보유(미사용) 리필권

  // 대표매장 썸네일 — 매장 정보 카드와 동일 우선순위 (2026-08-04):
  // 플레이스 썸네일 → 최신 캠페인 대표 사진([0]) → 결정론 폴백
  const primaryThumb = primaryStore
    ? primaryStore.thumbnailUrl ??
      coverForCampaign(
        db.campaigns
          .filter((c) => c.storeId === primaryStore.id)
          .sort((a, b) => b.createdAt - a.createdAt)[0]?.photos,
        primaryStore.id,
        primaryStore.category,
      )
    : null;

  const isPaid = me.plan !== "Free";
  const billingLabel = me.billing === "yearly" ? "연간 결제" : "월간 결제";

  const OPS_MENU: { href: string; icon: IconName; label: string; sub?: string }[] = [
    { href: "/o/campaign/new", icon: "plus", label: "새 캠페인 등록", sub: "방문형·예약형 모집" },
    { href: "/o/logs", icon: "ticket", label: "체험권 사용 로그", sub: `${passes.length}건` },
    { href: "/o/report", icon: "clipboard", label: "성과 리포트", sub: "방문·리뷰·게시 현황" },
    { href: "/o/stores", icon: "store", label: "매장 정보", sub: `${stores.length}곳` },
  ];

  return (
    <div className="pb-24 bg-canvas">
      <div className="px-5 pt-12 pb-3 flex items-center justify-between">
        <h1 className="text-[20px] font-bold text-ink tracking-title">마이</h1>
        <Link
          href="/o/notifications"
          className="cp-action relative w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-ink"
          aria-label={`알림함${unreadNotifications ? ` — 새 알림 ${unreadNotifications}건` : ""}`}
        >
          <Icon name="bell" variant="border" size={22} />
          {unreadNotifications > 0 && (
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-error" aria-hidden />
          )}
        </Link>
      </div>

      <div className="px-5">
        {/* 프로필 카드 — 대표매장 썸네일 + 매장명/카테고리 + 스탯 스트립 병합 */}
        <div className="rounded-lg border border-hairline bg-canvas p-4">
          <div className="flex items-center gap-3.5">
            {primaryThumb && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={primaryThumb}
                alt={`${primaryStore?.name ?? ""} 썸네일`}
                width={88}
                height={66}
                className="w-[88px] h-[66px] rounded-md object-cover bg-sunken shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-brand">대표매장</div>
              <div className="mt-0.5 text-[17px] font-bold text-ink tracking-title truncate">
                {primaryStore?.name ?? me.storeName}
              </div>
              <div className="mt-0.5 text-[12px] text-muted truncate">{primaryStore?.category ?? me.category}</div>
            </div>
            <Link href="/o/stores" className="cp-action shrink-0 text-mutedSoft" aria-label="매장 정보">
              <Icon name="chevron-right" variant="border" size={16} />
            </Link>
          </div>
          <div className="mt-4 pt-3.5 border-t border-hairlineSoft grid grid-cols-3 text-center text-ink">
            <div>
              <div className="text-[18px] font-bold tabular-nums leading-none">{stores.length}</div>
              <div className="mt-1.5 text-[12px] text-muted">매장 수</div>
            </div>
            <div className="border-l border-r border-hairlineSoft">
              <div className="text-[18px] font-bold tabular-nums leading-none">{totalReviews}</div>
              <div className="mt-1.5 text-[12px] text-muted">완료 리뷰</div>
            </div>
            <div>
              <div className="text-[16px] font-bold tabular-nums leading-none pt-0.5">{totalSupport.toLocaleString()}원</div>
              <div className="mt-1.5 text-[12px] text-muted">누적 지원</div>
            </div>
          </div>
        </div>

        {/* 멤버십 카드 — /o/membership 다크 히어로와 동일 아이덴티티 (통합 화면 진입점) */}
        <Link href="/o/membership" className="cp-action mt-3 rounded-lg bg-ink text-white p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-white/60">내 멤버십</div>
            {isPaid ? (
              <>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[17px] font-bold tracking-title">{me.plan} 플랜</span>
                  <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-[5px] bg-white/15 text-[10px] font-semibold">
                    {billingLabel}
                  </span>
                </div>
                <div className="mt-1 text-[12px] text-white/70">
                  {ownedCoupons ? `리필권 ${ownedCoupons}장 보유` : "혜택·리필권·결제 관리"}
                </div>
              </>
            ) : (
              <>
                <div className="mt-1 text-[17px] font-bold tracking-title">멤버십 플랜 시작하기</div>
                <div className="mt-1 text-[12px] text-white/70">더 많은 체험단 모집과 캐치랭크 혜택</div>
              </>
            )}
          </div>
          <Icon name="chevron-right" variant="border" size={18} className="shrink-0 text-white/70" />
        </Link>

        {/* 운영 관리 */}
        <h2 className="mt-7 text-[13px] font-semibold text-muted">운영 관리</h2>
        <div className="mt-2 rounded-lg border border-hairline bg-canvas divide-y divide-hairlineSoft overflow-hidden">
          {OPS_MENU.map((m) => (
            <Link key={m.href} href={m.href} className="cp-action flex items-center gap-3 px-4 py-3.5 active:bg-parchment">
              <span className="w-9 h-9 rounded-full bg-sunken flex items-center justify-center text-ink shrink-0">
                <Icon name={m.icon} variant="border" size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-ink">{m.label}</div>
                {m.sub && <div className="text-[12px] text-muted mt-0.5">{m.sub}</div>}
              </div>
              <Icon name="chevron-right" variant="border" size={16} className="text-mutedSoft shrink-0" />
            </Link>
          ))}
        </div>

        {/* 알림 · 지원 */}
        <h2 className="mt-6 text-[13px] font-semibold text-muted">알림 · 지원</h2>
        <div className="mt-2 rounded-lg border border-hairline bg-canvas divide-y divide-hairlineSoft overflow-hidden">
          <Link href="/o/notifications" className="cp-action flex items-center gap-3 px-4 py-3.5 active:bg-parchment">
            <span className="w-9 h-9 rounded-full bg-sunken flex items-center justify-center text-ink shrink-0">
              <Icon name="bell" variant="border" size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-ink flex items-center gap-2">
                알림함
                {unreadNotifications > 0 && (
                  <span className="text-[10px] font-semibold bg-error text-white px-1.5 py-0.5 rounded-pill tabular-nums">
                    {unreadNotifications}
                  </span>
                )}
              </div>
              <div className="text-[12px] text-muted mt-0.5">
                {unreadNotifications ? `${unreadNotifications}건 새 알림` : "모두 읽음"}
              </div>
            </div>
            <Icon name="chevron-right" variant="border" size={16} className="text-mutedSoft shrink-0" />
          </Link>
          <a
            href="mailto:help@catchrank.co.kr?subject=[CATCHPASS] 사장님 문의"
            className="cp-action flex items-center gap-3 px-4 py-3.5 active:bg-parchment"
          >
            <span className="w-9 h-9 rounded-full bg-sunken flex items-center justify-center text-ink shrink-0">
              <Icon name="chat" variant="border" size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-ink">고객센터 / 문의</div>
              <div className="text-[12px] text-muted mt-0.5">매장 정보·결제·구독 해지 문의</div>
            </div>
            <Icon name="chevron-right" variant="border" size={16} className="text-mutedSoft shrink-0" />
          </a>
        </div>

        {/* 법적 고지 */}
        <div className="mt-6 flex items-center gap-4 text-[12px]">
          <Link href="/legal/terms" className="text-muted underline">이용약관</Link>
          <Link href="/legal/privacy" className="text-muted underline">개인정보처리방침</Link>
        </div>

        <div className="mt-8">
          <LogoutButton />
        </div>
        <div className="mt-6">
          <DeleteAccountButton />
        </div>
      </div>
    </div>
  );
}
