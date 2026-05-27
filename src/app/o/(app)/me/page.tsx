import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";

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
    <div className="pb-24">
      <div className="px-5 pt-12 pb-3">
        <h1 className="text-[22px] font-bold">더보기</h1>
      </div>

      <div className="px-5">
        <div className="rounded-md border border-hairline p-5">
          <div className="text-[12px] text-muted">{me.email}</div>
          <div className="text-[18px] font-semibold mt-1">{me.storeName}</div>
          <div className="text-[13px] text-muted mt-0.5">{me.area} · {me.category}</div>
        </div>

        <div className="mt-4 rounded-md border border-hairline p-4">
          <div className="text-[13px] font-semibold mb-3">누적 지표</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[11px] text-muted">매장 수</div>
              <div className="text-[18px] font-bold">{stores.length}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted">완료 리뷰</div>
              <div className="text-[18px] font-bold">{totalReviews}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted">누적 지원</div>
              <div className="text-[18px] font-bold">₩{totalSupport.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <h2 className="mt-6 text-[14px] font-bold text-muted">메뉴</h2>
        <div className="mt-2 rounded-md border border-hairline divide-y divide-hairline overflow-hidden">
          {MENU.map((m) => (
            <Link key={m.href} href={m.href} className="flex items-center gap-3 px-4 py-3.5 active:bg-surfaceSoft">
              <div className="text-[20px] w-7 text-center">{m.icon}</div>
              <div className="flex-1">
                <div className="text-[14px] font-medium flex items-center gap-2">
                  {m.label}
                  {m.badge ? <span className="text-[10px] bg-error text-white px-1.5 py-0.5 rounded-full">{m.badge}</span> : null}
                </div>
                {m.sub && <div className="text-[12px] text-muted mt-0.5">{m.sub}</div>}
              </div>
              <div className="text-muted">→</div>
            </Link>
          ))}
        </div>

        <div className="mt-8">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
