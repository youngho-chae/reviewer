"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { IconName } from "./Icon";

export type BottomNavItem = { href: string; label: string; icon: IconName };

export default function BottomNav({ items }: { items: BottomNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 left-0 right-0 bg-canvas border-t border-hairlineSoft safe-bottom">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((it) => {
          const external = it.href.startsWith("http"); // 외부 서비스 탭 (캐치랭크 — 새 탭, 2026-08-12)
          const active = !external && (pathname === it.href || pathname.startsWith(it.href + "/"));
          const cls = `flex flex-col items-center justify-center py-2.5 gap-1 ${active ? "text-brand" : "text-muted"}`;
          const inner = (
            <>
              <Icon name={it.icon} variant={active ? "bold" : "border"} size={22} />
              <span className={`text-[11px]  ${active ? "font-semibold" : "font-normal"}`}>{it.label}</span>
            </>
          );
          return external ? (
            <a key={it.href} href={it.href} target="_blank" rel="noreferrer" className={cls}>
              {inner}
            </a>
          ) : (
            <Link key={it.href} href={it.href} className={cls} aria-current={active ? "page" : undefined}>
              {inner}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
