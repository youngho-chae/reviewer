import { redirect } from "next/navigation";
import Link from "next/link";
import { readSession } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import AdminTabs from "./AdminTabs";

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session || session.role !== "admin") redirect("/admin/login");
  return (
    <div className="mobile-shell flex flex-col min-h-[100dvh] bg-canvas">
      <div className="sticky top-0 z-30 bg-canvas border-b border-hairline">
        <div className="h-[52px] px-5 flex items-center justify-between">
          <Link href="/admin/reviews" className="cp-action text-[16px] font-bold text-ink tracking-title">운영팀 콘솔</Link>
          <div className="w-24"><LogoutButton /></div>
        </div>
        {/* 어드민 탭 (확정 정책 12) — 검수 / 회원 / 캠페인 / 사장님(인증) */}
        <AdminTabs />
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
