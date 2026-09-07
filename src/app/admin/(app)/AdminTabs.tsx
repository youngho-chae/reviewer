"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/reviews", label: "검수" },
  { href: "/admin/reservations", label: "예약" }, // 예약 로그·수동 취소 (2026-07-22 §13)
  { href: "/admin/members", label: "회원" },
  { href: "/admin/campaigns", label: "캠페인" },
  { href: "/admin/owners", label: "사장님" },
  // 출금(포인트) — 배송형 비활성(main 릴리스) 시 숨김 (적립 경로가 배송형 리뷰 승인뿐)
  // 출금 탭 상시 노출 (2026-09-07 감사) — 배송 플래그 off여도 출금 API가 살아 있어
  // 신청 유입 시 도달 경로가 없던 문제. 도먼트면 빈 큐 화면일 뿐.
  { href: "/admin/points", label: "출금" },
  { href: "/admin/refills", label: "리필" }, // 모집 한도 리필권 구매 내역 (2026-07-31 BM)
  { href: "/admin/grading", label: "등급 기준" }, // 평가 기준표 — 산식 수치는 내부 전용 (2026-08-06)
  { href: "/admin/notify", label: "알림" }, // 체험자/사장님 알림함 공지 발송 (2026-08-13)
];

export default function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="px-5 flex gap-1 pb-0">
      {TABS.map((t) => {
        const active = pathname?.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`cp-action px-3.5 py-2.5 text-[14px] border-b-2 -mb-px ${
              active ? "border-brand text-brand font-bold" : "border-transparent text-muted font-medium"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
