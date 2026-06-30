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
