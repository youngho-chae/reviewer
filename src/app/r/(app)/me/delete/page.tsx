import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import { pointBalance } from "@/lib/points";
import Icon from "@/components/Icon";
import WinWinBadge from "@/components/WinWinBadge";
import DeleteConfirmBar from "@/components/DeleteConfirmBar";

export const dynamic = "force-dynamic";

// 체험자 회원 탈퇴 (2026-08-18 — 사장님 /o/me/delete와 동일 패턴) — 구 인라인 확인 박스 폐기:
// 내 등급 카드 → 확인 3항목(보유 포인트·완료 리뷰·진행 중인 체험권) → 미사용 혜택 소멸 안내 →
// 재가입 안내 → 법령 고지 불릿 → 동의 체크 게이트 + 2버튼. 수치는 전부 실측(P4).
// 탈퇴 시 진행 중인 체험권은 취소·모집 슬롯 즉시 복구 (account API), 잔여 포인트·미사용 혜택 소멸.
export default async function DeleteAccountPage() {
  const me = await getCurrentReviewer();
  const db = await getDBAsync();
  const now = Date.now();

  const myPasses = db.passes.filter((p) => p.reviewerId === me.id);
  const points = pointBalance(db, me.id);
  const completedReviews = myPasses.filter((p) => p.status === "completed").length;
  const activePasses = myPasses.filter((p) => p.status === "active").length;
  const unusedRewards = (db.rewards ?? []).filter(
    (r) => r.ownerUserId === me.id && !r.usedAt && r.expiresAt > now,
  ).length;

  return (
    <div className="pb-52 bg-canvas min-h-[100dvh]">
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-3 grid grid-cols-[40px_1fr_40px] items-center">
          <Link href="/r/me" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="MY로">
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

        {/* 내 등급 — 사장님 화면의 플랜 카드 대응 (퍼플 아웃라인) */}
        <div className="mt-5 rounded-lg border-[1.5px] border-brand bg-canvas p-4">
          <div className="text-[12px] text-muted">내 등급</div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[18px] font-bold text-ink tracking-title leading-none">{me.grade}등급</span>
            {me.winWinBadge && <WinWinBadge size={17} />}
          </div>
          <p className="mt-1.5 text-[12px] text-muted">탈퇴하면 지금까지 쌓은 등급과 활동 이력이 사라져요.</p>
        </div>

        {/* 확인 3항목 — 실측 수치 (P4) */}
        <div className="mt-3 rounded-lg border border-hairline bg-canvas p-4 space-y-5">
          {(
            [
              {
                no: 1,
                label: "보유 포인트",
                // 출금(P5)을 두고 탈퇴하면 소멸 — 잔액이 있으면 출금 후 탈퇴 유도
                sub: "탈퇴하면 출금하지 않은 포인트도 소멸돼요",
                subCls: points > 0 ? "text-error" : "text-muted",
                value: `${points.toLocaleString()}P`,
              },
              {
                no: 2,
                label: "완료 리뷰",
                sub: "게시한 리뷰는 남지만, 활동 기록과 등급은 사라져요",
                subCls: "text-muted",
                value: `${completedReviews}건`,
              },
              {
                no: 3,
                label: "진행 중인 체험권",
                // account API가 active 패스 일괄 취소 + 모집 슬롯 복구
                sub: "탈퇴 시 진행 중인 체험권과 예약은 모두 취소돼요",
                subCls: "text-error",
                value: `${activePasses}장`,
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

        {/* 미사용 혜택 — 탈퇴 시 소멸 (account API가 미사용분 삭제) */}
        <Link
          href="/r/rewards"
          className="cp-action mt-3 flex items-center gap-3.5 rounded-lg bg-sunken px-4 py-4"
        >
          <span className="shrink-0 w-11 h-11 rounded-md bg-brand text-white grid place-items-center">
            <Icon name="gift" variant="border" size={22} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-bold text-ink">
              사용하지 않은 혜택 <span className="text-brand tabular-nums">{unusedRewards}개</span> 있어요
            </span>
            <span className="block mt-0.5 text-[12px] text-muted">탈퇴하면 보유한 혜택도 소멸돼요</span>
          </span>
          <Icon name="chevron-right" variant="border" size={16} className="shrink-0 text-mutedSoft" />
        </Link>

        <div className="mt-3 rounded-md bg-brandSoft px-4 py-3 text-[13px] font-semibold text-brand leading-[1.5]">
          ⓘ 탈퇴 후 재가입해도 등급·포인트·활동 기록은 복구되지 않아요.
        </div>

        <ul className="mt-5 space-y-1.5 text-[13px] text-ink2 leading-[1.55]">
          <li className="flex gap-2"><span className="text-mutedSoft">·</span>계정 정보(이메일·닉네임·연동 채널)와 미사용 혜택이 삭제돼요.</li>
          <li className="flex gap-2"><span className="text-mutedSoft">·</span>체험권 사용 기록은 전자상거래법에 따라 비식별 상태로 보존돼요.</li>
          <li className="flex gap-2"><span className="text-mutedSoft">·</span>탈퇴 후에는 데이터를 복구할 수 없어요.</li>
        </ul>
      </div>

      <DeleteConfirmBar backHref="/r/me" />
    </div>
  );
}
