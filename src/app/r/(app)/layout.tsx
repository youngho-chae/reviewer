import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";

export default async function ReviewerAppLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session || session.role !== "reviewer") redirect("/r/login");
  return (
    <div className="mobile-shell flex flex-col">
      <div className="flex-1">{children}</div>
      <BottomNav
        items={[
          { href: "/r/home", label: "홈", icon: "home" },
          { href: "/r/explore", label: "탐색", icon: "flag" },
          { href: "/r/passes", label: "체험권", icon: "ticket" },
          { href: "/r/rewards", label: "혜택", icon: "gift" },
          { href: "/r/me", label: "마이", icon: "user" },
        ]}
      />
    </div>
  );
}
