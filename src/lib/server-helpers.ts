import { redirect } from "next/navigation";
import { readSession } from "./auth";
import { getDB } from "./db";
import { Owner, Reviewer } from "./types";

export async function getCurrentReviewer(): Promise<Reviewer> {
  const s = await readSession();
  if (!s || s.role !== "reviewer") redirect("/r/login");
  const db = getDB();
  const r = db.reviewers.find((x) => x.id === s.userId);
  if (!r) redirect("/r/login");
  return r;
}
export async function getCurrentOwner(): Promise<Owner> {
  const s = await readSession();
  if (!s || s.role !== "owner") redirect("/o/login");
  const db = getDB();
  const o = db.owners.find((x) => x.id === s.userId);
  if (!o) redirect("/o/login");
  return o;
}
