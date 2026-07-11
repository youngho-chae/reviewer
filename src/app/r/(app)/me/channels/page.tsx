import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { oauthConfigured } from "@/lib/sns-oauth";
import { CHANNEL_ORDER } from "@/lib/channels";
import Icon from "@/components/Icon";
import ChannelManager, { type ChannelRow } from "./ChannelManager";
import type { SnsKind } from "@/lib/types";

export const dynamic = "force-dynamic";

// 채널 관리 (R-15, 2026-07-10) — SNS 채널 연동/해제 + 본인 소유 검증.
// 연동 여부는 참여 조건(채널 미연동만 차단 — P1 무관), verified는 신뢰 표식.
export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const me = await getCurrentReviewer();
  const { connected, error } = await searchParams;

  const rows: ChannelRow[] = CHANNEL_ORDER.map((kind: SnsKind) => {
    const linked = me.sns.find((s) => s.kind === kind);
    return {
      kind,
      connected: !!linked,
      url: linked?.url ?? "",
      influence: linked?.influence ?? 0,
      verified: !!linked?.verified,
      verifiedVia: linked?.verifiedVia ?? null,
      accountName: linked?.accountName ?? null,
      grade: me.channelGrades?.[kind] ?? null,
      // 프로바이더 OAuth 키 설정 여부 — false면 start가 데모 검증 화면으로 폴백 (서버 env만 접근)
      oauthReady: oauthConfigured(kind),
    };
  });

  return (
    <div className="pb-24 bg-canvas min-h-[100dvh]">
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-3 flex items-center gap-1">
          <Link href="/r/me" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="MY로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
          <h1 className="text-[18px] font-bold text-ink tracking-title">채널 관리</h1>
        </div>
      </div>

      <p className="px-5 pt-1 pb-4 text-[13px] text-muted leading-[1.55]">
        채널을 연동하면 해당 채널 캠페인에 참여할 수 있어요. 연동 시 프로바이더 로그인으로{" "}
        <span className="font-semibold text-ink2">본인 채널인지 검증</span>해요.
      </p>

      <ChannelManager rows={rows} connected={connected ?? null} error={error ?? null} overallGrade={me.grade} />
    </div>
  );
}
