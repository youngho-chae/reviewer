"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { IconName } from "./Icon";

export type BottomNavItem = { href: string; label: string; icon: IconName };

export default function BottomNav({ items }: { items: BottomNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 left-0 right-0 frosted-parchment border-t border-hairline safe-bottom">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex flex-col items-center justify-center py-2.5 gap-1 ${active ? "text-brand" : "text-muted"}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon name={it.icon} variant={active ? "bold" : "border"} size={22} />
              <span
                className={`text-[11px] tracking-[-0.011em] ${active ? "font-semibold" : "font-normal"}`}
              >
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
