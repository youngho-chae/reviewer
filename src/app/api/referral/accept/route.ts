import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { acceptInvite, markInviteClicked } from "@/lib/referral";

export const runtime = "nodejs";

/**
 * 두 가지 동작:
 *  - mode="click": 토큰 클릭 시 (비회원도 호출). 발신자 stats만 갱신.
 *  - mode="accept" (기본): 신규 가입자가 토큰 소비. 양면 보상 즉시 발행.
 *    accept는 로그인된 신규 사용자가 호출 — 회원가입 직후 /r/welcome/box로 이동하기 전에 호출.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    mode?: "click" | "accept";
  };
  const token = String(body.token || "").trim();
  if (!token) return NextResponse.json({ error: "token 누락" }, { status: 400 });

  const db = await getDBAsync();
  const mode = body.mode === "click" ? "click" : "accept";

  if (mode === "click") {
    const inv = markInviteClicked(db, token);
    if (!inv) return NextResponse.json({ error: "유효하지 않은 토큰" }, { status: 404 });
    await saveDBAsync();
    return NextResponse.json({
      ok: true,
      referrerKind: inv.referrerKind,
      targetKind: inv.targetKind,
      status: inv.status,
      storeId: inv.storeId,
      campaignId: inv.campaignId,
    });
  }

  // accept — 신규 가입자 본인이 호출
  const s = await readSession();
  if (!s) return NextResponse.json({ error: "로그인 후 호출하세요" }, { status: 401 });

  const r = acceptInvite(db, {
    token,
    refereeId: s.userId,
    refereeKind: s.role,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  await saveDBAsync();
  return NextResponse.json({
    ok: true,
    referrerReward: r.result.referrerReward,
    refereeMainReward: r.result.refereeMainReward,
    refereeBonusReward: r.result.refereeBonusReward,
  });
}
