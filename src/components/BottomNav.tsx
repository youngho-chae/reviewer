"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: string };

// Apple sub-nav-style bottom dock — frosted parchment, quiet inert chrome,
// active item picks up Action Blue. No icons styled with color noise.
export default function BottomNav({ items }: { items: Item[] }) {
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
            >
              <span className="text-[20px] leading-none">{it.icon}</span>
              <span className="text-[11px] tracking-[-0.011em]">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
