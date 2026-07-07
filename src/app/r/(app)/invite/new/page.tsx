import Link from "next/link";
import { getCurrentReviewer } from "@/lib/server-helpers";
import Icon from "@/components/Icon";
import InviteComposer from "./InviteComposer";

export const dynamic = "force-dynamic";

export default async function NewInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; campaign?: string; target?: string }>;
}) {
  const me = await getCurrentReviewer();
  const sp = await searchParams;
  const initialTarget = sp.target === "owner" ? "owner" : "reviewer";

  return (
    <div className="pb-24 bg-canvas min-h-[100dvh]">
      <div className="sticky top-0 z-30 bg-canvas">
        <div className="h-13 px-5 flex items-center gap-3">
          <Link href="/r/rewards" className="cp-action inline-flex items-center gap-1 text-[17px] text-brand">
            <Icon name="chevron-left" variant="border" size={18} />
            <span>혜택</span>
          </Link>
          <h1 className="text-[17px] font-semibold text-ink">친구에게 쏘기</h1>
        </div>
      </div>

      <InviteComposer
        nickname={me.nickname}
        myKind="reviewer"
        initialTarget={initialTarget}
        storeId={sp.store}
        campaignId={sp.campaign}
      />
    </div>
  );
}
