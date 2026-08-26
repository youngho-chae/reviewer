import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { getDBAsync } from "@/lib/db";
import BottomNav from "@/components/BottomNav";
import LogoutButton from "@/components/LogoutButton";
import BizInfoForm from "./BizInfoForm";

export default async function OwnerAppLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session || session.role !== "owner") redirect("/o/login");

  // 사업자 인증 가드 (확정 정책 9) — 인증 완료("인증된 사장님") 전에는 사장님 화면 대신 대기 화면.
  // bizStatus undefined = 인증 제도 도입 전 계정 → verified 간주(폴백).
  // 2026-08-18 가입 항목 축소: 사업자번호 미제출(pending+bizNumber 없음)이면 제출 폼을 겸한다.
  const db = await getDBAsync();
  const owner = db.owners.find((o) => o.id === session.userId);
  if (owner && owner.bizStatus === "pending") {
    const submitted = !!owner.bizNumber;
    return (
      <div className="mobile-shell flex flex-col bg-canvas">
        <div className="flex-1 px-6 pt-20 text-center">
          <div className="text-[44px]" aria-hidden>🧾</div>
          {submitted ? (
            <>
              <h1 className="mt-4 text-[20px] font-bold text-ink tracking-title">사업자 인증을 확인하고 있어요</h1>
              <p className="mt-3 text-[14px] text-ink2 leading-[1.6]">
                운영팀이 사업자등록번호
                <span className="text-ink font-semibold tabular-nums"> {owner.bizNumber!.slice(0, 3)}-{owner.bizNumber!.slice(3, 5)}-{owner.bizNumber!.slice(5)} </span>
                를 확인 중입니다.
                <br />
                영업일 기준 <b>2~3일 이내</b> 인증 완료를 안내드려요.
              </p>
              <p className="mt-4 text-[12px] text-muted leading-[1.6]">
                인증이 완료되면 캠페인 생성 등 사장님 기능을 모두 이용할 수 있습니다.
                <br />
                문의: help@catchrank.co.kr
              </p>
            </>
          ) : (
            <>
              {/* 2026-08-18 진위확인 개편 — 국세청 조회로 즉시 승인 (구 수기 2~3일 안내 폐기) */}
              <h1 className="mt-4 text-[20px] font-bold text-ink tracking-title">사업자 정보를 등록해주세요</h1>
              <p className="mt-3 text-[14px] text-ink2 leading-[1.6]">
                사업자등록번호가 확인되면 <b>즉시 인증이 완료</b>되고
                <br />
                바로 사장님 기능을 이용할 수 있어요.
              </p>
              <BizInfoForm />
            </>
          )}
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
          // [관리] (2026-07-28 개편) — 캠페인 + 예약 관리 + 리뷰 관리(2026-08-03 병합 —
          // 구 단독 '리뷰 관리' 메뉴 흡수, 바텀 네비 4개 운영)
          { href: "/o/manage", label: "관리", icon: "calendar-check" },
          { href: "/o/scan", label: "QR 스캔", icon: "camera" },
          { href: "/o/me", label: "마이", icon: "user" },
          // 캐치랭크 본체 (2026-08-12 마이 개편 와이어프레임 — 5번째 탭, 외부 새 탭)
          { href: "https://www.catchrank.co.kr", label: "캐치랭크", icon: "rank" },
        ]}
      />
    </div>
  );
}
