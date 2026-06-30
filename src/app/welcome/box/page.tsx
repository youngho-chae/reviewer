import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import WelcomeBoxStage from "./WelcomeBoxStage";

export const dynamic = "force-dynamic";

/**
 * 가입 직후(reviewer/owner 공용) 박스 오픈 화면.
 * 진입 즉시 클라이언트에서 POST /api/referral/accept 호출 → 양면 보상 발행.
 *
 * 라우트 그룹 바깥 — BottomNav 없음 (몰입을 위해 전체화면 박스 연출).
 * 미로그인 시 토큰을 보존한 채로 랜딩 페이지로 redirect.
 */
export default async function WelcomeBoxPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = (sp.token || "").trim();

  if (!token) {
    return (
      <div className="mobile-shell min-h-[100dvh] bg-canvas flex flex-col items-center justify-center px-6 text-center">
        <div className="text-[40px] mb-3">🎁</div>
        <div className="font-display text-[22px] text-ink">받을 박스가 없어요</div>
        <div className="text-[13px] text-muted mt-2">토큰이 누락됐어요.</div>
        <Link href="/r/home" className="cp-action mt-6 h-11 px-5 rounded-pill bg-ink text-white inline-flex items-center text-[14px]">
          홈으로 →
        </Link>
      </div>
    );
  }

  const session = await readSession();
  if (!session) {
    redirect(`/r/i/${encodeURIComponent(token)}`);
  }
  // 운영팀(admin) 계정은 보상 대상이 아님 → 검수 콘솔로
  if (session.role !== "reviewer" && session.role !== "owner") {
    redirect("/admin/reviews");
  }

  const role: "reviewer" | "owner" = session.role;
  const homeHref = role === "owner" ? "/o/home" : "/r/home";
  return <WelcomeBoxStage token={token} homeHref={homeHref} role={role} />;
}
