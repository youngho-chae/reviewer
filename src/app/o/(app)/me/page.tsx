import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";
import DeleteAccountButton from "@/components/DeleteAccountButton";

export const dynamic = "force-dynamic";

export default async function OwnerMe() {
  const me = await getCurrentOwner();
  const db = await getDBAsync();
  const stores = db.stores.filter((s) => s.ownerId === me.id);
  const passes = db.passes.filter((p) => p.ownerId === me.id);
  const totalReviews = passes.filter((p) => p.status === "completed").length;
  const totalSupport = passes.reduce((s, p) => s + (p.supportApplied || 0), 0);
  const unreadNotifications = db.notifications.filter((n) => n.role === "owner" && n.userId === me.id && !n.read).length;

  const MENU: { href: string; icon: string; label: string; sub?: string; badge?: number }[] = [
    { href: "/o/campaign/new", icon: "🎯", label: "새 캠페인", sub: "방문형/기자단 모집" },
    { href: "/o/membership", icon: "💎", label: "멤버십 / 구독", sub: `${me.plan} 플랜` },
    { href: "/o/logs", icon: "📋", label: "체험권 사용 로그", sub: `${passes.length}건` },
    { href: "/o/report", icon: "📊", label: "성과 리포트", sub: "최근 30일" },
    { href: "/o/stores", icon: "🏪", label: "매장 정보", sub: `${stores.length}곳` },
    { href: "/o/notifications", icon: "🔔", label: "알림함", sub: unreadNotifications ? `${unreadNotifications}건 새 알림` : "모두 읽음", badge: unreadNotifications },
  ];

  return (
    <div className="pb-24 bg-canvas">
      <div className="px-5 pt-12 pb-3">
        <h1 className="text-[20px] font-bold text-ink tracking-title">더보기</h1>
      </div>

      <div className="px-5">
        <div className="rounded-lg border border-hairline bg-canvas p-5">
          <div className="text-[12px] text-muted">{me.email}</div>
          <div className="text-[18px] font-bold text-ink mt-1 tracking-title">{me.storeName}</div>
          <div className="text-[13px] text-muted mt-0.5">{me.area} · {me.category}</div>
        </div>

        <div className="mt-3 rounded-lg border border-hairline bg-canvas p-4">
          <div className="text-[14px] font-bold text-ink mb-3">누적 지표</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[12px] text-muted">매장 수</div>
              <div className="text-[18px] font-bold text-ink tabular-nums mt-1">{stores.length}</div>
            </div>
            <div className="border-l border-r border-hairlineSoft">
              <div className="text-[12px] text-muted">완료 리뷰</div>
              <div className="text-[18px] font-bold text-ink tabular-nums mt-1">{totalReviews}</div>
            </div>
            <div>
              <div className="text-[12px] text-muted">누적 지원</div>
              <div className="text-[18px] font-bold text-ink tabular-nums mt-1">₩{totalSupport.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <h2 className="mt-7 text-[13px] font-semibold text-muted">메뉴</h2>
        <div className="mt-2 rounded-lg border border-hairline bg-canvas divide-y divide-hairlineSoft overflow-hidden">
          {MENU.map((m) => (
            <Link key={m.href} href={m.href} className="flex items-center gap-3 px-4 py-3.5 active:bg-parchment">
              <div className="text-[20px] w-7 text-center">{m.icon}</div>
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-ink flex items-center gap-2">
                  {m.label}
                  {m.badge ? <span className="text-[10px] font-semibold bg-error text-white px-1.5 py-0.5 rounded-pill tabular-nums">{m.badge}</span> : null}
                </div>
                {m.sub && <div className="text-[12px] text-muted mt-0.5">{m.sub}</div>}
              </div>
              <div className="text-mutedSoft">→</div>
            </Link>
          ))}
          <a
            href="mailto:help@catchrank.co.kr?subject=[CATCHPASS] 사장님 문의"
            className="flex items-center gap-3 px-4 py-3.5 active:bg-parchment border-t border-hairlineSoft"
          >
            <div className="text-[20px] w-7 text-center">💬</div>
            <div className="flex-1">
              <div className="text-[14px] font-medium">고객센터 / 문의</div>
              <div className="text-[12px] text-muted mt-0.5">매장 정보·결제·구독 해지 문의</div>
            </div>
            <div className="text-muted">→</div>
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
