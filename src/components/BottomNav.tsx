"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: string };

export default function BottomNav({ items }: { items: Item[] }) {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 left-0 right-0 bg-white border-t border-hairline safe-bottom">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex flex-col items-center justify-center py-2.5 text-[11px] gap-0.5 ${active ? "text-ink" : "text-muted"}`}
            >
              <span className="text-[20px]">{it.icon}</span>
              <span className="font-medium">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
