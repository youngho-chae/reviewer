import { getCurrentAdmin } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import NotifyForm, { type Recipient } from "./NotifyForm";

export const dynamic = "force-dynamic";

// 어드민 알림 발송 (2026-08-13) — 체험자/사장님을 선택해 알림함(푸시) 공지 발송.
// 수신자 식별정보(이메일 등)는 어드민 전용 화면이라 노출 가능 (§4-5는 사장님 화면 한정).
export default async function AdminNotify() {
  await getCurrentAdmin();
  const db = await getDBAsync();

  const reviewers: Recipient[] = db.reviewers
    .map((r) => ({ id: r.id, name: r.nickname, sub: r.email }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const owners: Recipient[] = db.owners
    .map((o) => ({ id: o.id, name: o.storeName || o.email, sub: o.email }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return (
    <div className="pb-24">
      <section className="px-5 pt-5">
        <div className="rounded-lg border border-hairline bg-canvas p-5">
          <div className="text-[12px] text-muted">알림 발송</div>
          <div className="text-[18px] font-bold text-ink tracking-title mt-1">체험자·사장님 공지 푸시</div>
          <p className="text-[12px] text-muted mt-2 leading-[1.5]">
            선택한 대상의 <span className="text-ink font-medium">알림함</span>으로 발송돼요 (체험자 {reviewers.length}명 ·
            사장님 {owners.length}명). 발송 후에는 회수할 수 없어요.
          </p>
        </div>
      </section>
      <NotifyForm reviewers={reviewers} owners={owners} />
    </div>
  );
}
