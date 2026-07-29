import { getCurrentAdmin } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import VerifyOwnerButton from "./VerifyOwnerButton";

export const dynamic = "force-dynamic";

// 사장님 관리 (확정 정책 9·12) — 사업자 인증 큐(수기 인증) + 사장님 목록.
export default async function AdminOwners() {
  await getCurrentAdmin();
  const db = await getDBAsync();

  const owners = [...db.owners].sort((a, b) => b.createdAt - a.createdAt);
  const pending = owners.filter((o) => o.bizStatus === "pending");
  const verified = owners.filter((o) => o.bizStatus !== "pending"); // undefined = 제도 도입 전 → verified 간주

  const fmtBiz = (n?: string) => (n && n.length === 10 ? `${n.slice(0, 3)}-${n.slice(3, 5)}-${n.slice(5)}` : "—");

  return (
    <div className="pb-24">
      <section className="px-5 pt-5">
        <div className="rounded-lg border border-hairline bg-canvas p-5">
          <div className="text-[12px] text-muted">사업자 인증 대기</div>
          <div className="text-[22px] font-bold text-ink tracking-title tabular-nums mt-1">{pending.length}건</div>
          <div className="text-[12px] text-muted mt-2">영업일 기준 2~3일 이내 처리 — 인증 완료 시 사장님 화면 접근 권한 부여</div>
        </div>
      </section>

      {pending.length > 0 && (
        <section className="px-5 mt-5 space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start">
          <h2 className="text-[15px] font-bold text-ink">인증 대기</h2>
          {pending.map((o) => (
            <div key={o.id} className="rounded-lg border border-warning/40 bg-canvas p-4">
              <div className="flex items-center justify-between">
                <div className="text-[15px] font-bold text-ink">{o.storeName}</div>
                <span className="text-[11px] px-2 py-0.5 rounded-pill bg-warningSoft text-warning font-semibold">대기</span>
              </div>
              <div className="mt-1 text-[12px] text-muted">
                {o.email} · {o.category} · {o.area}
              </div>
              <div className="mt-1 text-[13px] text-ink2 tabular-nums">사업자등록번호 {fmtBiz(o.bizNumber)}</div>
              <div className="mt-1 text-[11px] text-muted tabular-nums">
                신청 {new Date(o.createdAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
              <VerifyOwnerButton ownerId={o.id} />
            </div>
          ))}
        </section>
      )}

      <section className="px-5 mt-6 space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-2 lg:items-start">
        <h2 className="text-[15px] font-bold text-ink">인증된 사장님</h2>
        {verified.map((o) => (
          <div key={o.id} className="rounded-md border border-hairline bg-canvas px-4 py-3 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-ink truncate">{o.storeName}</div>
              <div className="text-[11px] text-muted truncate">
                {o.email} · {o.plan} 플랜 · 사업자 {fmtBiz(o.bizNumber)}
              </div>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-pill bg-successSoft text-successStrong font-semibold shrink-0">인증됨</span>
          </div>
        ))}
        {verified.length === 0 && <div className="text-[13px] text-muted py-6 text-center">인증된 사장님이 없습니다.</div>}
      </section>
    </div>
  );
}
