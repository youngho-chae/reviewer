import { redirect } from "next/navigation";

// 리뷰 관리 (2026-08-03) — [관리] 탭으로 병합. 구 경로는 알림 딥링크(/o/reviews,
// pass-lifecycle·검수 알림·시드)와 북마크 호환을 위해 리다이렉트로 유지 (?st= 필터 보존).
export default async function OwnerReviewsRedirect({ searchParams }: { searchParams: Promise<{ st?: string }> }) {
  const { st } = await searchParams;
  redirect(st ? `/o/manage?tab=reviews&st=${st}` : "/o/manage?tab=reviews");
}
