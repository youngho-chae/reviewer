import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { getDBAsync } from "@/lib/db";
import BottomNav from "@/components/BottomNav";
import LogoutButton from "@/components/LogoutButton";

export default async function OwnerAppLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session || session.role !== "owner") redirect("/o/login");

  // 사업자 인증 가드 (확정 정책 9) — 인증 완료("인증된 사장님") 전에는 사장님 화면 대신 대기 화면.
  // bizStatus undefined = 인증 제도 도입 전 계정 → verified 간주(폴백).
  const db = await getDBAsync();
  const owner = db.owners.find((o) => o.id === session.userId);
  if (owner && owner.bizStatus === "pending") {
    return (
      <div className="mobile-shell flex flex-col bg-canvas">
        <div className="flex-1 px-6 pt-24 text-center">
          <div className="text-[44px]" aria-hidden>🧾</div>
          <h1 className="mt-4 text-[20px] font-bold text-ink tracking-title">사업자 인증을 확인하고 있어요</h1>
          <p className="mt-3 text-[14px] text-ink2 leading-[1.6]">
            운영팀이 사업자등록번호
            {owner.bizNumber ? (
              <span className="text-ink font-semibold tabular-nums"> {owner.bizNumber.slice(0, 3)}-{owner.bizNumber.slice(3, 5)}-{owner.bizNumber.slice(5)} </span>
            ) : " "}
            를 확인 중입니다.
            <br />
            영업일 기준 <b>2~3일 이내</b> 인증 완료를 안내드려요.
          </p>
          <p className="mt-4 text-[12px] text-muted leading-[1.6]">
            인증이 완료되면 캠페인 생성 등 사장님 기능을 모두 이용할 수 있습니다.
            <br />
            문의: help@catchrank.co.kr
          </p>
          <div className="mt-8">
            <LogoutButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-shell flex flex-col">
      <div className="flex-1">{children}</div>
      <BottomNav
        items={[
          { href: "/o/home", label: "홈", icon: "home" },
          // [관리] (2026-07-28 개편) — 캠페인 관리 + 예약관리. 홈 무한 스크롤 분산 목적
          { href: "/o/manage", label: "관리", icon: "calendar-check" },
          { href: "/o/scan", label: "QR 스캔", icon: "camera" },
          { href: "/o/reviews", label: "리뷰 관리", icon: "clipboard" }, // 용어 통일 (§4-6 — 후기→리뷰)
          { href: "/o/me", label: "마이", icon: "user" },
        ]}
      />
    </div>
  );
}
