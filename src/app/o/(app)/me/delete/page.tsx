import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { ownedRefills } from "@/lib/limit-refill";
import Icon from "@/components/Icon";
import DeleteConfirm from "./DeleteConfirm";

export const dynamic = "force-dynamic";

// 사장님 회원 탈퇴 (2026-08-18 와이어프레임 개편) — 구 인라인 확인 박스를 전용 화면으로:
// 이용중인 플랜 카드 → 확인 3항목(최근 30일 상생 매출·완료 리뷰·진행 중인 캠페인) →
// 미사용 리필권 소멸 안내 → 재가입 안내 → 법령 고지 불릿 → 동의 체크 게이트 + 2버튼.
// 수치는 전부 실측(P4) — 상생 매출은 리포트와 동일 산식 Σ max(0, 결제 − 지원 적용액).
// 시안의 파랑 액센트·파랑 금액은 v2 규칙으로 치환(퍼플=인터랙션·검정=가치).
export default async function DeleteAccountPage() {
  const me = await getCurrentOwner();
  const db = await getDBAsync();
  const now = Date.now();

  const myPasses = db.passes.filter((p) => p.ownerId === me.id);
  // 최근 30일 상생 매출 — 결제 기록이 있는 사용 처리 건 (리포트 §12와 동일: 폴백 건 0 하한)
  const winwin30d = myPasses
    .filter((p) => p.usedAt && now - p.usedAt <= 30 * 24 * 60 * 60 * 1000 && typeof p.paidAmount === "number")
    .reduce((sum, p) => sum + Math.max(0, (p.paidAmount as number) - (p.supportApplied ?? 0)), 0);
  const completedReviews = myPasses.filter((p) => p.status === "completed").length;
  const myStoreIds = new Set(db.stores.filter((x) => x.ownerId === me.id).map((x) => x.id));
  const runningCampaigns = db.campaigns.filter((c) => myStoreIds.has(c.storeId) && c.endAt > now).length;
  const refillCount = ownedRefills(db, me.id).length;
  const isFree = me.plan === "Free";
  const billing = isFree ? null : (me.billing ?? "monthly");

  return (
    <div className="pb-52 bg-canvas min-h-[100dvh]">
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-3 grid grid-cols-[40px_1fr_40px] items-center">
          <Link href="/o/me" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="마이로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
          <h1 className="text-[16px] font-bold text-ink tracking-title text-center">회원 탈퇴</h1>
          <span />
        </div>
      </div>

      <div className="px-5 pt-4">
        <h2 className="text-[22px] font-bold text-ink tracking-title leading-[1.35]">
          회원 탈퇴 후에는
          <br />
          데이터를 복구할 수 없어요
        </h2>
        <p className="mt-2.5 text-[14px] text-ink2">탈퇴하기 전에 아래 내용을 꼭 확인해주세요.</p>

        {/* 이용중인 플랜 — 내 멤버십 플랜 카드와 동일 아이덴티티 (퍼플 아웃라인) */}
        <div className="mt-5 rounded-lg border-[1.5px] border-brand bg-canvas p-4">
          <div className="text-[12px] text-muted">이용중인 플랜</div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[18px] font-bold text-ink tracking-title leading-none">{me.plan}</span>
            {billing && (
              <span className="shrink-0 inline-flex items-center px-2 py-1 rounded-pill bg-brandSoft text-[11px] font-bold text-brand">
                {billing === "yearly" ? "연간 이용 중" : "월간 이용 중"}
              </span>
            )}
          </div>
        </div>

        {/* 확인 3항목 — 실측 수치 (P4) */}
        <div className="mt-3 rounded-lg border border-hairline bg-canvas p-4 space-y-5">
          {(
            [
              {
                no: 1,
                label: "최근 30일 상생 매출",
                sub: "체험단을 통해 추가로 발생한 매출이에요",
                subCls: "text-muted",
                value: `${winwin30d.toLocaleString()}원`,
              },
              {
                no: 2,
                label: "완료 리뷰",
                sub: "리뷰는 남지만, 성과 리포트는 종료돼요",
                subCls: "text-muted",
                value: `${completedReviews}건`,
              },
              {
                no: 3,
                label: "진행 중인 캠페인",
                // 탈퇴 시 endAt 즉시 종료 (account API) — 이미 발급된 체험권은 정상 진행
                sub: "탈퇴 시 진행 중인 캠페인 모집이 즉시 종료돼요",
                subCls: "text-error",
                value: `${runningCampaigns}건`,
              },
            ] as const
          ).map((row) => (
            <div key={row.no} className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-ink text-white text-[12px] font-bold grid place-items-center">
                {row.no}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-bold text-ink">{row.label}</div>
                <p className={`mt-0.5 text-[12px] leading-[1.5] ${row.subCls}`}>{row.sub}</p>
              </div>
              <span className="shrink-0 text-[17px] font-bold text-ink tabular-nums">{row.value}</span>
            </div>
          ))}
        </div>

        {/* 미사용 리필권 — 탈퇴 시 소멸 (account API가 미사용분 삭제) */}
        <Link
          href="/o/membership#refill"
          className="cp-action mt-3 flex items-center gap-3.5 rounded-lg bg-sunken px-4 py-4"
        >
          <span className="shrink-0 w-11 h-11 rounded-md bg-brand text-white grid place-items-center">
            <Icon name="ticket" variant="border" size={22} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-bold text-ink">
              사용하지 않은 리필권 <span className="text-brand tabular-nums">{refillCount}장</span> 있어요
            </span>
            <span className="block mt-0.5 text-[12px] text-muted">탈퇴하면 보유 리필권도 소멸돼요</span>
          </span>
          <Icon name="chevron-right" variant="border" size={16} className="shrink-0 text-mutedSoft" />
        </Link>

        <div className="mt-3 rounded-md bg-brandSoft px-4 py-3 text-[13px] font-semibold text-brand leading-[1.5]">
          ⓘ 탈퇴 후 재가입해도 플랜·리필권·활동 기록은 복구되지 않아요.
        </div>

        <ul className="mt-5 space-y-1.5 text-[13px] text-ink2 leading-[1.55]">
          <li className="flex gap-2"><span className="text-mutedSoft">·</span>계정 정보(이메일·매장 연결 정보)와 미사용 혜택이 삭제돼요.</li>
          <li className="flex gap-2"><span className="text-mutedSoft">·</span>체험권 사용 기록은 전자상거래법에 따라 비식별 상태로 보존돼요.</li>
          <li className="flex gap-2"><span className="text-mutedSoft">·</span>탈퇴 후에는 데이터를 복구할 수 없어요.</li>
        </ul>
      </div>

      <DeleteConfirm />
    </div>
  );
}
