import { redirect } from "next/navigation";
import Link from "next/link";
import { readSession } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session || session.role !== "admin") redirect("/admin/login");
  return (
    <div className="mobile-shell flex flex-col min-h-[100dvh] bg-canvas">
      <div className="sticky top-0 z-30 frosted-parchment border-b border-hairlineSoft">
        <div className="h-13 px-5 flex items-center justify-between">
          <Link href="/admin/reviews" className="text-[15px] font-semibold text-ink">운영팀 검수 콘솔</Link>
          <div className="w-24"><LogoutButton /></div>
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
