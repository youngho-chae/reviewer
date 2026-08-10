import { redirect } from "next/navigation";

// 쿠폰함 (2026-08-10 통합) — 리필권 구매·보유·사용 내역이 멤버십 화면으로 흡수됨.
// 구 링크·북마크 호환용 리다이렉트만 유지.
export default function OwnerCoupons() {
  redirect("/o/membership#refill");
}
