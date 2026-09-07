import Link from "next/link";
import { getCurrentAdmin } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { passDisplayStatus } from "@/lib/pass-display";

export const dynamic = "force-dynamic";

// 어드민 홈 대시보드 (2026-09-07 감사 개편) — 대기 큐 집계 + 감사 로그 + 스윕 헬스.
// 감사 결과 대기 건수는 각 탭에 들어가야 보였고(탭 배지 없음), 스윕·재평가가 도는지
// 운영팀이 알 방법이 없었다. /admin 진입 기본 화면.
export default async function AdminDashboard() {
  await getCurrentAdmin();
  const db = await getDBAsync();
  const now = Date.now();

  const reviewerIds = new Set(db.reviewers.map((r) => r.id));
  const pendingReviews = db.passes.filter((p) => p.status === "review_submitted");
  const ghostReviews = pendingReviews.filter((p) => !reviewerIds.has(p.reviewerId)).length;
  const overdueUsed = db.passes.filter((p) => p.status === "used" && passDisplayStatus(p, now) === "overdue").length;
  const resubmitExpired = db.passes.filter((p) => p.status === "rejected" && passDisplayStatus(p, now) === "resubmit_expired").length;

  const QUEUES: { label: string; count: number; href: string; note?: string }[] = [
    { label: "검수 대기", count: pendingReviews.length, href: "/admin/reviews", note: ghostReviews > 0 ? `탈퇴 회원 건 ${ghostReviews}` : undefined },
    { label: "사업자 인증 대기", count: db.owners.filter((o) => o.bizStatus === "pending").length, href: "/admin/owners" },
    { label: "출금 대기", count: (db.withdrawals ?? []).filter((w) => w.status === "requested").length, href: "/admin/points" },
    { label: "리뷰 기한 초과 (used)", count: overdueUsed, href: "/admin/passes?st=used", note: "구제는 체험권 탭 정정 도구" },
    { label: "재제출 소진·기한 초과", count: resubmitExpired, href: "/admin/passes?st=rejected", note: "[재제출 허용]으로 구제 가능" },
    { label: "예약 대기 (미확정)", count: db.passes.filter((p) => p.status === "active" && p.reservation && p.reservation.status !== "confirmed").length, href: "/admin/reservations" },
  ];

  const actions = [...(db.adminActions ?? [])].sort((a, b) => b.at - a.at).slice(0, 20);
  const fmt = (t: number) => new Date(t).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="pb-24">
      {/* 대기 큐 집계 */}
      <section className="px-5 pt-5 grid grid-cols-2 lg:grid-cols-3 gap-3">
        {QUEUES.map((q) => (
          <Link key={q.label} href={q.href} className="cp-action rounded-lg border border-hairline bg-canvas p-4">
            <div className="text-[12px] text-muted">{q.label}</div>
            <div className={`text-[22px] font-bold tracking-title tabular-nums mt-1 ${q.count > 0 ? "text-ink" : "text-mutedSoft"}`}>
              {q.count}건
            </div>
            {q.note && <div className="mt-1 text-[11px] text-warning">{q.note}</div>}
          </Link>
        ))}
      </section>

      {/* 시스템 헬스 — 스윕·재평가·시드 상태 */}
      <section className="px-5 mt-5">
        <div className="rounded-lg border border-hairline bg-canvas p-4">
          <h2 className="text-[14px] font-bold text-ink">시스템 상태</h2>
          <div className="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-2 text-[12px] text-ink2 tabular-nums">
            <div>월간 재평가: <b className="text-ink">{db.lastRegradeMonth ?? "미실행"}</b></div>
            <div>시드 버전: <b className="text-ink">{db.seedVersion ?? "—"}</b></div>
            <div>데이터 패치: <b className="text-ink">{(db.appliedPatches ?? []).length}건</b></div>
            <div>감사 로그: <b className="text-ink">{(db.adminActions ?? []).length}건</b></div>
          </div>
        </div>
      </section>

      {/* 최근 운영 처분 (감사 로그) */}
      <section className="px-5 mt-5">
        <h2 className="text-[15px] font-bold text-ink">최근 운영 처분</h2>
        <div className="mt-2 rounded-lg border border-hairline bg-canvas divide-y divide-hairlineSoft">
          {actions.length === 0 && <div className="p-6 text-center text-[13px] text-muted">기록된 처분이 없습니다.</div>}
          {actions.map((a) => (
            <div key={a.id} className="px-4 py-2.5 flex items-start gap-3">
              <span className="shrink-0 text-[11px] text-muted tabular-nums w-[92px]">{fmt(a.at)}</span>
              <div className="min-w-0 text-[12px]">
                <span className="font-semibold text-ink">{a.action}</span>
                <span className="text-muted"> · {a.targetType} {a.targetId.slice(-6)} · {a.adminEmail}</span>
                {a.detail && <div className="text-ink2 truncate">{a.detail}</div>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
