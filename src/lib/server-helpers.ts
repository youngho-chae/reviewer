import { redirect } from "next/navigation";
import { readSession } from "./auth";
import { getDBAsync } from "./db";
import { AdminUser, Owner, Reviewer } from "./types";

export async function getCurrentReviewer(): Promise<Reviewer> {
  const s = await readSession();
  if (!s || s.role !== "reviewer") redirect("/r/login");
  const db = await getDBAsync();
  const r = db.reviewers.find((x) => x.id === s.userId);
  if (!r) redirect("/r/login");
  return r;
}
// 게스트 브라우징 (2026-07-24) — 공개 화면(홈·탐색·검색·매장 상세) 전용.
// 미로그인이면 redirect 대신 null을 반환한다. 개인화 값(금액·통계·관심)은
// 호출부가 null 분기로 마스크("로그인 후 확인"/"회원 전용")하고 로그인 CTA를 노출한다.
export async function getReviewerOrNull(): Promise<Reviewer | null> {
  const s = await readSession();
  if (!s || s.role !== "reviewer") return null;
  const db = await getDBAsync();
  return db.reviewers.find((x) => x.id === s.userId) ?? null;
}
export async function getCurrentOwner(): Promise<Owner> {
  const s = await readSession();
  if (!s || s.role !== "owner") redirect("/o/login");
  const db = await getDBAsync();
  const o = db.owners.find((x) => x.id === s.userId);
  if (!o) redirect("/o/login");
  return o;
}
export async function getCurrentAdmin(): Promise<AdminUser> {
  const s = await readSession();
  if (!s || s.role !== "admin") redirect("/admin/login");
  const db = await getDBAsync();
  const a = (db.admins ?? []).find((x) => x.id === s.userId);
  if (!a) redirect("/admin/login");
  return a;
}
