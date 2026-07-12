"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/reviews", label: "검수" },
  { href: "/admin/members", label: "회원" },
  { href: "/admin/campaigns", label: "캠페인" },
  { href: "/admin/owners", label: "사장님" },
  { href: "/admin/points", label: "출금" },
];

export default function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="px-5 flex gap-1 pb-0">
      {TABS.map((t) => {
        const active = pathname?.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`cp-action px-3.5 py-2.5 text-[14px] border-b-2 -mb-px ${
              active ? "border-brand text-brand font-bold" : "border-transparent text-muted font-medium"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
