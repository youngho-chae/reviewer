import { redirect } from "next/navigation";

// 현위치 설정은 홈 바텀시트(LocationSheet)로 전환됨 (2026-07-08 레퍼런스).
// 기존 딥링크 안전망으로 라우트만 유지 — 홈으로 보낸다.
export default function LocationPage() {
  redirect("/r/home");
}
