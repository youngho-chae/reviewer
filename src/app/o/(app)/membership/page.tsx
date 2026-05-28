import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import PlanPicker from "./PlanPicker";

export const dynamic = "force-dynamic";

const PLANS = [
  { key: "Basic", price: "13,900", grades: "A·B·C 랜덤", desc: "초기 진입 — 진성 리뷰어 확보" },
  { key: "Standard", price: "25,900", grades: "A·B·C · A등급 우선", desc: "안정적 캠페인 운영" },
  { key: "Premium", price: "38,900", grades: "S·A·B·C · S등급 우선", desc: "프리미엄 — 상위 등급 우선 노출" },
] as const;

export default async function MembershipPage() {
  const me = await getCurrentOwner();
  return (
    <div className="pb-24">
      <div className="px-5 pt-12 pb-3">
        <Link href="/o/me" className="text-muted text-[14px]">← 더보기</Link>
        <h1 className="mt-3 text-[22px] font-bold">멤버십 / 구독 관리</h1>
      </div>

      <div className="mx-5 mt-4 rounded-md bg-ink text-white p-5 shadow-card">
        <div className="text-[12px] text-white/70">현재 플랜</div>
        <div className="mt-1 text-[24px] font-bold">{me.plan}</div>
        <div className="text-[13px] text-white/80 mt-1">
          ₩{({Basic:"13,900",Standard:"25,900",Premium:"38,900"} as any)[me.plan]}/월 · {({Basic:"A·B·C 랜덤 노출",Standard:"A·B·C · A등급 우선",Premium:"S·A·B·C · S등급 우선"} as any)[me.plan]}
        </div>
      </div>

      <h2 className="px-5 mt-6 text-[16px] font-bold">플랜 비교</h2>
      <div className="px-5 mt-3 space-y-3">
        {PLANS.map((p) => {
          const isCurrent = p.key === me.plan;
          return (
            <div key={p.key} className={`rounded-md border p-4 ${isCurrent ? "border-ink bg-surfaceSoft" : "border-hairline"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[16px] font-semibold">{p.key}</div>
                  <div className="text-[12px] text-muted mt-0.5">{p.desc}</div>
                </div>
                <div className="text-right">
                  <div className="text-[18px] font-bold">₩{p.price}</div>
                  <div className="text-[11px] text-muted">/월</div>
                </div>
              </div>
              <div className="mt-3 text-[12px] text-body">활성 등급: <span className="font-medium">{p.grades}</span></div>
              {isCurrent && <div className="mt-2 text-[12px] text-ink font-medium">✓ 현재 사용 중</div>}
            </div>
          );
        })}
      </div>

      <div className="px-5 mt-6">
        <PlanPicker current={me.plan} />
      </div>

      <div className="px-5 mt-8">
        <div className="text-[13px] font-semibold mb-2">결제 내역</div>
        <div className="rounded-md border border-hairline p-4 text-[13px] text-muted">
          연동된 결제 수단이 없습니다. 결제 연동은 운영팀이 진행합니다 (help@catchrank.co.kr).
        </div>
      </div>

      <div className="px-5 mt-6">
        <button disabled className="w-full h-12 rounded-sm border border-hairline text-muted text-[14px]">
          구독 해지 (운영팀 문의 필요)
        </button>
      </div>
    </div>
  );
}
