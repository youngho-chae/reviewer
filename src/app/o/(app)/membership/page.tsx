import Link from "next/link";
import { getCurrentOwner } from "@/lib/server-helpers";
import Icon from "@/components/Icon";
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
  { key: "Premium", price: "38,900", desc: "무제한 모집 — 대규모 캠페인 운영" },
];

// [확정 정책 4·8-3] 플랜 차이는 월 모집 팀 수뿐 — 등급 우선(부스팅) 표기는 도입하지 않는다
function planSummary(plan: PlanKey): string {
  const p = PLAN_POLICY[plan];
  return p.monthlyTeamLimit === null ? "월 무제한 모집" : `월 ${p.monthlyTeamLimit}팀 모집`;
}

export default async function MembershipPage() {
  const me = await getCurrentOwner();
  return (
    <div className="pb-24 bg-canvas">
      {/* top-app-bar — 뒤로가기 + 타이틀 */}
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="h-[52px] px-3 flex items-center">
          <Link href="/o/me" className="cp-action w-10 h-10 rounded-full flex items-center justify-center text-ink" aria-label="더보기로">
            <Icon name="chevron-left" variant="border" size={22} />
          </Link>
          <h1 className="text-[18px] font-bold text-ink tracking-title">멤버십 / 구독 관리</h1>
        </div>
      </div>

      <div className="mx-5 mt-2 rounded-lg border border-hairline bg-canvas p-5">
        <div className="text-[12px] font-semibold text-brand">현재 플랜</div>
        <div className="mt-1 text-[20px] font-bold text-ink tracking-title">{me.plan}</div>
        <div className="text-[13px] text-ink2 mt-1">
          <span className="font-bold text-ink tabular-nums">{(PLANS.find((p) => p.key === me.plan)?.price ?? "0")}원</span>/월 · {planSummary(me.plan)}
        </div>
      </div>

      <h2 className="px-5 mt-7 text-[18px] font-bold text-ink tracking-title">플랜 비교</h2>
      <div className="px-5 mt-3 space-y-3">
        {PLANS.map((p) => {
          const isCurrent = p.key === me.plan;
          return (
            <div key={p.key} className={`rounded-md bg-canvas p-4 ${isCurrent ? "border-[1.5px] border-brand" : "border border-hairline"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[16px] font-bold text-ink">{p.key}</div>
                  <div className="text-[12px] text-muted mt-0.5">{p.desc}</div>
                </div>
                <div className="text-right">
                  <div className="text-[18px] font-bold text-ink tabular-nums">{p.price}원</div>
                  <div className="text-[11px] text-muted">/월</div>
                </div>
              </div>
              <div className="mt-3 text-[12px] text-ink2">정책: <span className="font-medium text-ink">{planSummary(p.key)}</span></div>
              <div className="mt-1 text-[11px] text-muted">모집 등급 S·A·B·C 전등급</div>
              {isCurrent && <div className="mt-2 text-[12px] text-brand font-semibold">✓ 현재 사용 중</div>}
            </div>
          );
        })}
      </div>

      <div className="px-5 mt-6">
        <PlanPicker current={me.plan} />
      </div>

      <div className="px-5 mt-8">
        <div className="text-[14px] font-bold text-ink mb-2">결제 내역</div>
        <div className="rounded-md border border-hairline p-4 text-[13px] text-muted leading-[1.5]">
          연동된 결제 수단이 없습니다. 결제(PG) 연동 전까지 요금 청구는 운영팀이 진행합니다 (help@catchrank.co.kr).
        </div>
      </div>

      <div className="px-5 mt-6">
        <button disabled className="w-full h-12 rounded-md bg-sunken text-mutedSoft text-[14px] font-semibold">
          구독 해지 (운영팀 문의 필요)
        </button>
        <p className="mt-3 text-[11px] text-muted leading-[1.6]">
          해지·환불 안내: 플랜 변경은 다음 결제 주기부터 적용되며, 이용하지 않은 기간의 환불은
          전자상거래법에 따라 고객센터를 통해 처리됩니다. 자세한 내용은{" "}
          <Link href="/legal/terms" className="text-brand font-medium">이용약관 제10조</Link>를 확인해주세요.
        </p>
      </div>
    </div>
  );
}
