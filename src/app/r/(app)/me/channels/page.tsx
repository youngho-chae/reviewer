import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { effectiveChannelState } from "@/lib/sns-cookie";
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
  searchParams: Promise<{ connected?: string; error?: string; welcome?: string }>;
}) {
  const me = await getCurrentReviewer();
  const { connected, error, welcome } = await searchParams;
  // 인스턴스 불일치 스톱갭 — 연동/해제 직후 본인 시점 최신 상태로 렌더 (sns-cookie.ts)
  const eff = await effectiveChannelState(me);

  const rows: ChannelRow[] = CHANNEL_ORDER.map((kind: SnsKind) => {
    const linked = eff.sns.find((s) => s.kind === kind);
    return {
      kind,
      connected: !!linked,
      url: linked?.url ?? "",
      influence: linked?.influence ?? 0,
      verified: !!linked?.verified,
      verifiedVia: linked?.verifiedVia ?? null,
      accountName: linked?.accountName ?? null,
      grade: eff.channelGrades[kind] ?? null,
    };
  });

  return (
    // 하단 시작 CTA(연결 1개 이상)와 겹치지 않게 여유 패딩
    <div className="pb-44 bg-canvas min-h-[100dvh]">
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-3 flex items-center gap-1">
          <Link href="/r/me" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="MY로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
        </div>
      </div>

      {/* 타이틀 (2026-07-23 시안 — 레퍼런스: 미디어 연결) */}
      <div className="px-5 pb-6">
        <h1 className="text-[24px] font-bold text-ink tracking-title">SNS 채널 연결</h1>
        <p className="mt-4 text-[16px] text-ink leading-[1.5]">
          {me.nickname}님, <b>SNS를 연결</b>해주세요.
        </p>
        <p className="mt-1.5 text-[14px] text-muted leading-[1.5]">지금 연결하고 더 많은 체험과 우리 동네 발견을 시작해 볼까요?</p>
      </div>

      {/* 가입 직후 온보딩 (2026-07-23) — 이메일·네이버·카카오 어느 경로로 가입해도 여기로 유도 */}
      {welcome === "1" && (
        <div className="mx-5 mb-3 rounded-md bg-brandSoft px-4 py-3.5">
          <div className="text-[14px] font-bold text-brand">🎉 가입을 환영해요!</div>
          <p className="mt-1 text-[13px] text-ink2 leading-[1.55]">
            SNS 채널을 연동하고 본인 인증하면 <b>등급이 산정</b>되고 지원 금액이 올라가요. 지금 바로 연동해보세요 —
            나중에 해도 괜찮아요.{" "}
            <Link href="/r/home" className="font-semibold text-brand underline">
              둘러보기부터 →
            </Link>
          </p>
        </div>
      )}
      <ChannelManager rows={rows} connected={connected ?? null} error={error ?? null} overallGrade={eff.grade} />

      {/* 하나 이상 연결되면 시작 CTA (2026-07-23) — 온보딩을 여기서 마치고 홈으로 */}
      {rows.some((r) => r.connected) && (
        <div className="fixed bottom-[var(--bottom-nav-h,72px)] left-0 right-0 mx-auto max-w-[480px] bg-canvas border-t border-hairlineSoft z-20">
          <div className="px-5 py-3">
            <Link
              href="/r/home"
              className="cp-action flex w-full h-[52px] items-center justify-center rounded-md bg-brand text-white text-[16px] font-bold"
            >
              이대로 시작하기
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
