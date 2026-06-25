import { redirect } from "next/navigation";
import Link from "next/link";
import { readSession } from "@/lib/auth";
import { getDBAsync } from "@/lib/db";
import { refereePreview, markInviteClicked, matrixOf } from "@/lib/referral";
import { saveDBAsync } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 비회원 또는 로그인 사용자가 추천 토큰 링크로 진입하는 랜딩.
 * (app) 그룹 바깥이라 BottomNav 없음. 인증 게이트도 없음.
 *
 * 동작:
 *  - 이미 로그인된 사용자 → /r/welcome/box?token=<token>으로 자동 이동 (보상 발행)
 *  - 비회원 → 미리보기 카드 + [박스 받고 가입하기 →] /r/signup?invite=<token>
 */
export default async function RefereeLandingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await readSession();

  const db = await getDBAsync();
  const inv = (db.invites ?? []).find((i) => i.token === token);

  if (inv) {
    markInviteClicked(db, token);
    await saveDBAsync();
  }

  // 이미 로그인 — 박스 오픈 화면으로 이동
  if (session) {
    redirect(`/welcome/box?token=${encodeURIComponent(token)}`);
  }

  // 만료 / 미존재 / 이미 사용
  const expired = !inv || inv.status === "expired" || (inv && Date.now() > inv.expiresAt);
  const used = inv?.status === "signed_up";

  const referrer = inv
    ? inv.referrerKind === "reviewer"
      ? db.reviewers.find((r) => r.id === inv.referrerId)
      : db.owners.find((o) => o.id === inv.referrerId)
    : null;
  const referrerName = referrer
    ? (("nickname" in referrer && referrer.nickname) || ("storeName" in referrer && referrer.storeName) || "친구")
    : "친구";
  const m = inv ? matrixOf(inv.referrerKind, inv.targetKind) : null;
  const preview = m ? refereePreview(m) : "환영 박스";

  return (
    <div className="mobile-shell min-h-[100dvh] bg-canvas flex flex-col">
      <div className="flex-1 px-6 pt-12 pb-10">
        {expired ? (
          <div className="rounded-md border border-hairline bg-canvas p-6 text-center">
            <div className="text-[40px] mb-3">⏰</div>
            <div className="font-display text-[22px] text-ink">만료된 초대예요</div>
            <div className="text-[13px] text-muted mt-2">14일이 지났어요. 다른 친구에게 새 박스를 받아보세요.</div>
            <Link href="/r/signup" className="cp-action mt-6 inline-flex h-11 px-5 rounded-pill bg-ink text-white items-center text-[14px] font-medium">
              그래도 가입할래요 →
            </Link>
          </div>
        ) : used ? (
          <div className="rounded-md border border-hairline bg-canvas p-6 text-center">
            <div className="text-[40px] mb-3">🎁</div>
            <div className="font-display text-[22px] text-ink">이미 받아간 박스예요</div>
            <div className="text-[13px] text-muted mt-2">한 토큰은 한 명만 받을 수 있어요.</div>
            <Link href="/r/login" className="cp-action mt-6 inline-flex h-11 px-5 rounded-pill bg-ink text-white items-center text-[14px] font-medium">
              로그인 →
            </Link>
          </div>
        ) : (
          <>
            {/* Hero — 친구가 보낸 박스 */}
            <div className="rounded-2xl bg-gradient-to-br from-brand to-[#0040a0] text-white p-7 text-center relative overflow-hidden">
              <div className="absolute -right-8 -top-8 text-[160px] opacity-15 select-none" aria-hidden>🎁</div>
              <div className="relative">
                <div className="text-[60px] leading-none mb-3" aria-hidden>🎁</div>
                <div className="text-[14px] opacity-90">{referrerName}님이 선물을 보냈어요</div>
                <div className="font-display text-[28px] leading-[1.1] mt-3 tracking-[-0.022em]">
                  {preview}
                </div>
                <div className="text-[12px] opacity-85 mt-3">
                  + 박스 오픈 시 0~5,000원 보너스 캐시
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-md border border-hairline bg-parchment p-4">
              <div className="text-[12px] text-muted leading-[1.5]">
                30초만에 가입하고 박스를 받으세요.
                <br />
                가입은 무료, 박스 유효기간 14일 · 보상은 캐치랭크 마케팅 정책에 따라 지급됩니다.
              </div>
            </div>

            <Link
              href={inv?.targetKind === "owner"
                ? `/o/signup?invite=${encodeURIComponent(token)}`
                : `/r/signup?invite=${encodeURIComponent(token)}`}
              className="cp-action mt-6 flex items-center justify-center h-12 rounded-pill bg-ink text-white text-[16px] font-semibold"
            >
              박스 받고 가입하기 →
            </Link>

            <div className="mt-3 text-center">
              <Link
                href={`/r/login?invite=${encodeURIComponent(token)}`}
                className="text-[12px] text-muted underline decoration-hairline underline-offset-4"
              >
                이미 계정이 있어요
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
