import { redirect } from "next/navigation";

// /admin 진입 기본 화면 = 대시보드 (2026-09-07 감사 개편 — 구 검수 큐 직행에서 변경:
// 대기 큐 집계·감사 로그·스윕 헬스를 먼저 보고 탭으로 이동)
export default function AdminIndex() {
  redirect("/admin/dashboard");
}
