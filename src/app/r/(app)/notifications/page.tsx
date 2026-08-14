import Link from "next/link";
import PushOptIn from "@/components/PushOptIn";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync, saveDBAsync } from "@/lib/db";

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

export default async function ReviewerNotifications() {
  const me = await getCurrentReviewer();
  const db = await getDBAsync();
  const items = db.notifications
    .filter((n) => n.role === "reviewer" && n.userId === me.id)
    .sort((a, b) => b.createdAt - a.createdAt);

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
            <Link key={n.id} href={n.link || "#"} className="block px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-[14px] font-medium">{n.title}</div>
                  <div className="text-[13px] text-body mt-1">{n.body}</div>
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
    <div className="pb-24">
      <div className="px-5 pt-12 pb-3">
        <Link href="/r/me" className="text-muted text-[14px]">← MY</Link>
        <h1 className="mt-3 text-[22px] font-bold">알림함</h1>
        <div className="text-[13px] text-muted mt-1">{items.length}건</div>
      </div>

      {/* 웹푸시 켜기 (2026-08-13) — VAPID 미설정·미지원 브라우저면 렌더 안 됨 */}
      <div className="px-5 pb-2">
        <PushOptIn />
      </div>

      <Section title="오늘" list={today} />
      <Section title="이번 주" list={week} />
      <Section title="이전" list={older} />

      {items.length === 0 && (
        <div className="px-5 py-16 text-center text-muted text-[14px]">알림이 없어요</div>
      )}
    </div>
  );
}
