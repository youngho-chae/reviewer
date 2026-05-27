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
          { href: "/r/passes", label: "내 체험권", icon: "ticket" },
          { href: "/r/grade", label: "등급", icon: "trophy" },
          { href: "/r/me", label: "MY", icon: "user" },
        ]}
      />
    </div>
  );
}
