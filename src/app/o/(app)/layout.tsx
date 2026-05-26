import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";

export default async function OwnerAppLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session || session.role !== "owner") redirect("/o/login");
  return (
    <div className="mobile-shell flex flex-col">
      <div className="flex-1">{children}</div>
      <BottomNav
        items={[
          { href: "/o/home", label: "홈", icon: "🏠" },
          { href: "/o/scan", label: "QR 스캔", icon: "📷" },
          { href: "/o/reviews", label: "리뷰", icon: "📝" },
          { href: "/o/me", label: "MY", icon: "👤" },
        ]}
      />
    </div>
  );
}
