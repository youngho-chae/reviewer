import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";
import Icon, { type IconName } from "@/components/Icon";
import { ownedRefills } from "@/lib/limit-refill";
import { coverForCampaign } from "@/lib/store-photo";

export const dynamic = "force-dynamic";

// 사장님 마이 (2026-08-12 와이어프레임 개편 v2 — 2026-08-10 v1 개정):
//  · 헤더 = 로고(홈과 동일) + 벨(새 알림 도트)
//  · 프로필 = 플랫(테두리 없음): 정사각 썸네일 + 대표매장 라벨 + 가게명 1줄 + 카테고리 → 매장 정보
//  · 스탯 바(sunken 1행) = 완료 리뷰 | 누적 지원 (매장 수 제거)
//  · 멤버십 = 퍼플 아웃라인 카드: 플랜명 + "{월간|연간} 이용 중" 칩 + 리필권 n장 보유 → 내 멤버십
//  · 메뉴 = 플랫 아이콘 행(서브텍스트·섹션 헤더·원형 타일 폐기) + **약관 행 신설**
//  · 로그아웃 아웃라인 풀폭 + 회원 탈퇴 텍스트. 바텀 네비 5탭(캐치랭크 외부)은 layout.
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
  const ownedCoupons = ownedRefills(db, me.id).length;

  // 대표매장 썸네일 — 매장 정보 카드와 동일 우선순위 (플레이스 썸네일 → 최신 캠페인 대표 → 폴백)
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

  const isFree = me.plan === "Free";
  const billingLabel = (me.billing ?? "monthly") === "yearly" ? "연간 이용 중" : "월간 이용 중";

  const MENU: { href: string; icon: IconName; label: string; external?: boolean }[] = [
    { href: "/o/campaign/new", icon: "plus", label: "새 캠페인 등록" },
    { href: "/o/logs", icon: "ticket", label: "체험권 사용 로그" },
    { href: "/o/report", icon: "pie", label: "성과 리포트" },
    { href: "/o/stores", icon: "store", label: "매장 정보" },
    { href: "/o/notifications", icon: "bell", label: "알림함" },
    { href: "mailto:help@catchrank.co.kr?subject=[CATCHPASS] 사장님 문의", icon: "chat", label: "고객센터/문의", external: true },
    { href: "/legal/terms", icon: "clipboard", label: "약관" },
  ];

  return (
    <div className="pb-24 bg-canvas">
      {/* 헤더 — 로고(홈과 동일) + 벨 (와이어프레임) */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between">
        <span className="text-[15px] font-bold text-brand tracking-title">CATCHPASS</span>
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
        {/* 프로필 — 플랫: 정사각 썸네일 + 대표매장 + 가게명 1줄 + 카테고리 → 매장 정보 */}
        <Link href="/o/stores" className="cp-action flex items-center gap-4">
          {primaryThumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={primaryThumb}
              alt={`${primaryStore?.name ?? ""} 썸네일`}
              width={88}
              height={88}
              className="w-[88px] h-[88px] rounded-lg object-cover bg-sunken shrink-0"
            />
          )}
          <span className="flex-1 min-w-0">
            <span className="block text-[12px] font-semibold text-brand">대표매장</span>
            <span className="mt-1 block text-[18px] font-bold text-ink tracking-title leading-[1.3] truncate">
              {primaryStore?.name ?? me.storeName}
            </span>
            <span className="mt-0.5 block text-[13px] text-muted truncate">{primaryStore?.category ?? me.category}</span>
          </span>
          <Icon name="chevron-right" variant="border" size={16} className="shrink-0 text-mutedSoft" />
        </Link>

        {/* 스탯 바 — 완료 리뷰 | 누적 지원 (와이어프레임 — 매장 수 제거, 좌우 2분할) */}
        <div className="mt-4 rounded-lg bg-sunken px-4 py-3.5 grid grid-cols-[1fr_auto_1.4fr] items-center gap-3 text-[13px] tabular-nums">
          <span className="flex items-center justify-between gap-2">
            <span className="text-muted">완료 리뷰</span>
            <span className="text-[16px] font-bold text-ink">{totalReviews}</span>
          </span>
          <span className="h-4 w-px bg-hairline" aria-hidden />
          <span className="flex items-center justify-between gap-2">
            <span className="text-muted">누적 지원</span>
            <span className="text-[16px] font-bold text-ink">{totalSupport.toLocaleString()}원</span>
          </span>
        </div>

        {/* 멤버십 카드 — 퍼플 아웃라인 (내 멤버십 플랜 카드와 동일 아이덴티티) */}
        <Link
          href="/o/membership"
          className="cp-action mt-3 rounded-lg border-[1.5px] border-brand bg-canvas p-4 flex items-center gap-3"
        >
          <span className="flex-1 min-w-0">
            <span className="flex items-center gap-2">
              <span className="text-[17px] font-bold text-ink tracking-title">{me.plan}</span>
              {!isFree && (
                <span className="shrink-0 inline-flex items-center px-2 py-1 rounded-pill bg-brandSoft text-[11px] font-bold text-brand">
                  {billingLabel}
                </span>
              )}
            </span>
            <span className="mt-1.5 block text-[13px] text-ink2">
              {isFree ? "이용 중인 멤버십이 없어요" : `리필권 ${ownedCoupons}장 보유`}
            </span>
          </span>
          <Icon name="chevron-right" variant="border" size={16} className="shrink-0 text-mutedSoft" />
        </Link>

        {/* 메뉴 — 플랫 아이콘 행 (서브텍스트·섹션·타일 없음, 와이어프레임) */}
        <div className="mt-5">
          {MENU.map((m) =>
            m.external ? (
              <a key={m.label} href={m.href} className="cp-action flex items-center gap-3.5 py-4">
                <Icon name={m.icon} variant="border" size={22} className="shrink-0 text-ink" />
                <span className="flex-1 text-[15px] font-medium text-ink">{m.label}</span>
                <Icon name="chevron-right" variant="border" size={16} className="shrink-0 text-mutedSoft" />
              </a>
            ) : (
              <Link key={m.label} href={m.href} className="cp-action flex items-center gap-3.5 py-4">
                <Icon name={m.icon} variant="border" size={22} className="shrink-0 text-ink" />
                <span className="flex-1 text-[15px] font-medium text-ink">{m.label}</span>
                <Icon name="chevron-right" variant="border" size={16} className="shrink-0 text-mutedSoft" />
              </Link>
            ),
          )}
        </div>

        <div className="mt-6">
          <LogoutButton />
        </div>
        <div className="mt-5 flex items-center gap-4">
          {/* 탈퇴 = 전용 화면 (2026-08-18 개편 — 구 인라인 확인 박스 폐기) */}
          <Link href="/o/me/delete" className="cp-action text-[13px] text-muted underline">
            회원 탈퇴
          </Link>
          <Link href="/legal/privacy" className="text-[12px] text-muted underline">
            개인정보처리방침
          </Link>
        </div>
      </div>
    </div>
  );
}
