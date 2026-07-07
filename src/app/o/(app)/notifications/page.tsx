import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

function group(items: { createdAt: number }[]) {
  const now = Date.now();
  const today: any[] = [];
  const week: any[] = [];
  const older: any[] = [];
  for (const it of items) {
    const diff = now - it.createdAt;
    if (diff < 86400000) today.push(it);
    else if (diff < 86400000 * 7) week.push(it);
    else older.push(it);
  }
  return { today, week, older };
}

export default async function OwnerNotifications() {
  const me = await getCurrentOwner();
  const db = await getDBAsync();
  const items = db.notifications
    .filter((n) => n.role === "owner" && n.userId === me.id)
    .sort((a, b) => b.createdAt - a.createdAt);

  // 진입 즉시 모두 읽음 처리
  let touched = false;
  for (const n of items) {
    if (!n.read) { n.read = true; touched = true; }
  }
  if (touched) await saveDBAsync();

  const { today, week, older } = group(items);

  const Section = ({ title, list }: { title: string; list: typeof items }) =>
    list.length === 0 ? null : (
      <div className="mt-5">
        <div className="px-5 text-[12px] text-muted font-medium">{title}</div>
        <div className="mt-2 divide-y divide-hairline border-y border-hairline">
          {list.map((n) => (
            <Link key={n.id} href={n.link || "#"} className="block px-5 py-4 active:bg-parchment">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-[14px] font-semibold text-ink">{n.title}</div>
                  <div className="text-[13px] text-ink2 mt-1 leading-[1.5]">{n.body}</div>
                </div>
                <div className="text-[11px] text-muted whitespace-nowrap">
                  {new Date(n.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );

  return (
    <div className="pb-24 bg-canvas">
      {/* top-app-bar — 뒤로가기 + 타이틀 */}
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-3 flex items-center">
          <Link href="/o/me" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="더보기로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
          <h1 className="text-[18px] font-bold text-ink tracking-title">알림함</h1>
        </div>
      </div>
      <div className="px-5 pt-1 text-[13px] text-muted tabular-nums">{items.length}건</div>

      <Section title="오늘" list={today} />
      <Section title="이번 주" list={week} />
      <Section title="이전" list={older} />

      {items.length === 0 && (
        <div className="px-5 py-16 text-center text-muted text-[14px]">알림이 없어요</div>
      )}
    </div>
  );
}
