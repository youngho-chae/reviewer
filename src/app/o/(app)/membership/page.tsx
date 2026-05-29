import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import PlanPicker from "./PlanPicker";
import { PLAN_POLICY, type PlanKey } from "@/lib/plan-policy";

export const dynamic = "force-dynamic";

interface PlanRow {
  key: PlanKey;
  price: string;
  desc: string;
}

const PLANS: PlanRow[] = [
  { key: "Free", price: "0", desc: "멤버십 미가입 — 최소 운영" },
  { key: "Basic", price: "13,900", desc: "초기 진입 — 진성 리뷰어 확보" },
  { key: "Standard", price: "25,900", desc: "안정적 캠페인 운영" },
  { key: "Premium", price: "38,900", desc: "무제한 모집 — 상위 등급 우선 노출" },
];

function planSummary(plan: PlanKey): string {
  const p = PLAN_POLICY[plan];
  const grade = p.priorityGrade ? `${p.priorityGrade}등급 우선` : "등급 랜덤";
  const limit = p.monthlyTeamLimit === null ? "월 무제한" : `월 ${p.monthlyTeamLimit}팀`;
  return `${grade} · ${limit}`;
}

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
          ₩{(PLANS.find((p) => p.key === me.plan)?.price ?? "0")}/월 · {planSummary(me.plan)}
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
              <div className="mt-3 text-[12px] text-body">정책: <span className="font-medium">{planSummary(p.key)}</span></div>
              <div className="mt-1 text-[11px] text-muted">모집 등급 S·A·B·C 전등급</div>
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
