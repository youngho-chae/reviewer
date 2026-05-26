import { getCurrentOwner } from "@/lib/server-helpers";
import { getDBAsync } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function OwnerMe() {
  const me = await getCurrentOwner();
  const db = await getDBAsync();
  const stores = db.stores.filter((s) => s.ownerId === me.id);
  const passes = db.passes.filter((p) => p.ownerId === me.id);
  const totalReviews = passes.filter((p) => p.status === "completed").length;
  const totalSupport = passes.reduce((s, p) => s + (p.supportApplied || 0), 0);

  return (
    <div className="pb-24">
      <div className="px-5 pt-12 pb-3">
        <h1 className="text-[22px] font-bold">MY</h1>
      </div>

      <div className="px-5">
        <div className="rounded-md border border-hairline p-5">
          <div className="text-[12px] text-muted">{me.email}</div>
          <div className="text-[18px] font-semibold mt-1">{me.storeName}</div>
          <div className="text-[13px] text-muted mt-0.5">{me.area} · {me.category}</div>
        </div>

        <div className="mt-4 rounded-md border border-hairline p-4">
          <div className="text-[13px] font-semibold mb-2">멤버십</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[15px] font-medium">{me.plan} · ₩{({Basic:"13,900",Standard:"25,900",Premium:"38,900"} as any)[me.plan]}/월</div>
              <div className="text-[12px] text-muted">활성 등급: {({Basic:"C·B",Standard:"C·B·A",Premium:"C·B·A·S"} as any)[me.plan]}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-hairline p-4">
          <div className="text-[13px] font-semibold mb-3">누적 지표</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[11px] text-muted">매장 수</div>
              <div className="text-[18px] font-bold">{stores.length}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted">완료 리뷰</div>
              <div className="text-[18px] font-bold">{totalReviews}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted">누적 지원</div>
              <div className="text-[18px] font-bold">₩{totalSupport.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
