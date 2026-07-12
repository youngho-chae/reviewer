import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentReviewer } from "@/lib/server-helpers";
import { isSnsKind, oauthConfigured } from "@/lib/sns-oauth";
import { CHANNEL_LABEL } from "@/lib/channels";
import { SNS_PROVIDER_LOGIN_LABEL } from "@/lib/sns-oauth-labels";
import Icon from "@/components/Icon";
import DemoVerifyForm from "./DemoVerifyForm";

export const dynamic = "force-dynamic";

// 데모 검증 승인 화면 (OAuth 키 미설정 환경 전용) — /api/sns/{provider}/start가 폴백으로 보낸다.
// 실 프로바이더 로그인이 활성화된 채널은 이 화면을 쓰지 않는다(START가 실 OAuth로 리다이렉트).
export default async function DemoVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string; url?: string; influence?: string }>;
}) {
  await getCurrentReviewer();
  const sp = await searchParams;
  const provider = sp.provider ?? "";
  if (!isSnsKind(provider)) redirect("/r/me/channels");
  if (oauthConfigured(provider)) redirect(`/api/sns/${provider}/start`);

  return (
    <div className="pb-24 bg-canvas min-h-[100dvh]">
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-3 flex items-center gap-1">
          <Link href="/r/me/channels" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="채널 관리로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
          <h1 className="text-[18px] font-bold text-ink tracking-title">본인 채널 인증</h1>
        </div>
      </div>

      <div className="px-5 pt-2">
        {/* 데모 모드 고지 — 실 OAuth는 env 키 설정 시 이 화면 대신 프로바이더 로그인으로 이동 */}
        <div className="rounded-md bg-sunken px-4 py-3.5 text-[12px] text-muted leading-[1.6]">
          <span className="font-bold text-ink">데모 검증 모드</span> — 실제 {SNS_PROVIDER_LOGIN_LABEL[provider]}은
          OAuth 키(.env의 프로바이더 client ID/Secret) 설정 시 자동 활성화돼요. 지금은 검증 플로우를 시연하는
          화면이에요.
        </div>

        <h2 className="mt-6 text-[18px] font-bold text-ink tracking-title">
          {CHANNEL_LABEL[provider]} 계정이 본인 소유인지 확인해요
        </h2>
        <p className="mt-2 text-[14px] text-ink2 leading-[1.55]">
          실서비스에서는 {SNS_PROVIDER_LOGIN_LABEL[provider]} 화면으로 이동해 계정 로그인으로 소유를 확인해요.
        </p>

        <DemoVerifyForm provider={provider} url={sp.url ?? ""} influence={sp.influence ?? "0"} />
      </div>
    </div>
  );
}
