import BottomNav from "@/components/BottomNav";

// 게스트 브라우징 (2026-07-24) — 레이아웃 인증 게이트 없음.
// 공개 화면(홈·탐색·검색·매장 상세)은 getReviewerOrNull로 게스트를 허용하고,
// 나머지 (app) 하위 페이지는 반드시 getCurrentReviewer(미로그인 → /r/login)로
// **자체 방어**해야 한다 — 신규 페이지 추가 시 둘 중 하나를 빠뜨리면 조용히 공개된다.
export default async function ReviewerAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mobile-shell flex flex-col">
      <div className="flex-1">{children}</div>
      <BottomNav
        items={[
          { href: "/r/home", label: "홈", icon: "home" },
          { href: "/r/explore", label: "탐색", icon: "flag" },
          { href: "/r/passes", label: "체험권", icon: "ticket" },
          { href: "/r/rewards", label: "혜택", icon: "gift" },
          { href: "/r/me", label: "마이", icon: "user" },
        ]}
      />
    </div>
  );
}
