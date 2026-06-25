import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { createInvite } from "@/lib/referral";
import type { ShareChannel, UserKind } from "@/lib/types";

export const runtime = "nodejs";

const VALID_CHANNELS: ShareChannel[] = ["kakao", "sms", "instagram_dm", "copy_link"];

export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    targetKind?: UserKind;
    storeId?: string;
    campaignId?: string;
    channel?: ShareChannel;
  };
  const targetKind: UserKind = body.targetKind === "owner" ? "owner" : "reviewer";
  const channel: ShareChannel | undefined =
    body.channel && VALID_CHANNELS.includes(body.channel) ? body.channel : undefined;

  const db = await getDBAsync();
  const inv = createInvite(db, {
    referrerId: s.userId,
    referrerKind: s.role as UserKind,
    targetKind,
    storeId: body.storeId,
    campaignId: body.campaignId,
    channel,
  });
  await saveDBAsync();
  return NextResponse.json({ ok: true, token: inv.token, expiresAt: inv.expiresAt });
}
