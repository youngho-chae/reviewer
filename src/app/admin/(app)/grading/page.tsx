import { getCurrentAdmin } from "@/lib/server-helpers";
import {
  REGRADE_WEIGHTS,
  F_WEIGHTS,
  PENALTY,
  GRADE_CUTS,
  WINWIN_BADGE,
  W_MIN_SUPPORT,
  W_FULL_SAMPLE,
} from "@/lib/grade-regrade";
import { INDEX_BANDS } from "@/lib/grade";

export const dynamic = "force-dynamic";

// 등급 평가 기준표 (2026-08-06 신설) — 담당자 전용. 가중치·산식·패널티 등 수치 기준은
// 이 화면이 유일한 노출 위치다 (체험자 /r/grade는 행동 가이드만 — 산식 수치 비노출 원칙).
// 모든 수치는 정본 상수(src/lib/grade-regrade.ts·grade.ts)에서 직접 렌더 — 문서-코드 자동 정합.
export default async function AdminGrading() {
  await getCurrentAdmin();

  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="pb-24 px-5">
      <section className="pt-5">
        <div className="rounded-lg border border-hairline bg-canvas p-5">
          <div className="text-[12px] text-muted">등급 평가 기준표 (내부 전용)</div>
          <div className="text-[18px] font-bold text-ink tracking-title mt-1">
            GS = {REGRADE_WEIGHTS.I}·I(지수) + {REGRADE_WEIGHTS.F}·F(성실 이행) + {REGRADE_WEIGHTS.W}·W(상생지수) − P(패널티)
          </div>
          <p className="text-[12px] text-muted mt-2 leading-[1.6]">
            매월 말(KST) 직전 1개월 활동을 lazy 스윕으로 재평가 — 정본 <code>src/lib/grade-regrade.ts</code> ·
            운영정책서 §10. 이 수치들은 코드 상수에서 직접 렌더되므로 항상 구현과 일치한다.
            <span className="text-error font-semibold"> 체험자 화면에는 수치를 노출하지 않는다</span> — 유저에게는
            행동 가이드(/r/grade)만 보여준다.
          </p>
        </div>
      </section>

      {/* I — 지수 점수 */}
      <section className="mt-4">
        <h2 className="text-[15px] font-bold text-ink mb-2">I · 지수 점수 (가중 {pct(REGRADE_WEIGHTS.I)}) — 채널별</h2>
        <div className="rounded-lg border border-hairline bg-canvas overflow-hidden text-[12px]">
          <div className="grid grid-cols-4 px-4 py-2.5 bg-sunken font-semibold text-ink2">
            <span>밴드</span><span>가중 영향력</span><span>점수 구간</span><span>비고</span>
          </div>
          {INDEX_BANDS.map((b) => (
            <div key={b.grade} className="grid grid-cols-4 px-4 py-2.5 border-t border-hairlineSoft text-ink tabular-nums">
              <span className="font-bold">{b.grade}</span>
              <span>{b.lo.toLocaleString()} ~ {b.hi.toLocaleString()}</span>
              <span>{b.slo} ~ {b.shi}점</span>
              <span className="text-muted">로그 보간</span>
            </div>
          ))}
          <div className="px-4 py-2.5 border-t border-hairlineSoft text-[11px] text-muted leading-[1.5]">
            가중 영향력 = 채널 영향력 × 채널 가중(네이버 블로그 ×1.2, 그 외 ×1). 연동 채널 전부 평가
            대상(URL 유무 무관). <b>연동 채널의 바닥 점수 = 30(C 컷)</b> — N 밴드는 없다(N = 채널 미연동
            전용 상태, 2026-08-06 6단계 개편).
          </div>
        </div>
      </section>

      {/* F — 성실 이행 */}
      <section className="mt-4">
        <h2 className="text-[15px] font-bold text-ink mb-2">F · 성실 이행 (가중 {pct(REGRADE_WEIGHTS.F)}) — 계정 공통</h2>
        <div className="rounded-lg border border-hairline bg-canvas p-4 text-[12px] text-ink leading-[1.7]">
          <div className="font-semibold">F = 완료율 × {pct(F_WEIGHTS.completion)} + 기한 준수율 × {pct(F_WEIGHTS.punctuality)}</div>
          <ul className="mt-2 space-y-1 text-ink2 list-disc pl-4">
            <li>완료율 = 완료 ÷ (완료 + 노쇼 만료 + 리뷰 기한 초과 + 반려 종착 + <b>반려 방치</b>)</li>
            <li>기한 준수율 = 완료 건별 (마감까지 남긴 시간 ÷ 전체 기한, 0~1)의 평균 — 이용 직후 제출 ≈1 · 마감 직전 ≈0. 기한 표본이 없으면 완료율 단독</li>
            <li>반려 방치 = 1차 반려 후 재제출 기한(7일) 경과까지 미재제출 — <b>분모에만 포함(감점 없음)</b></li>
            <li>기한 기준 = <code>reviewDeadline</code> 정본(예약형 = 확정 방문일 말 + 7일) — 판정·월 귀속·제출 API 동일</li>
          </ul>
        </div>
      </section>

      {/* W — 상생지수 */}
      <section className="mt-4">
        <h2 className="text-[15px] font-bold text-ink mb-2">W · 상생지수 (가중 {pct(REGRADE_WEIGHTS.W)}) — 계정 공통</h2>
        <div className="rounded-lg border border-hairline bg-canvas p-4 text-[12px] text-ink leading-[1.7]">
          <div className="font-semibold">W = min(r, 1.0)의 평균 × min(1, 표본 ÷ {W_FULL_SAMPLE}) × 100</div>
          <ul className="mt-2 space-y-1 text-ink2 list-disc pl-4">
            <li>건별 r = (결제액 − 적용 지원금) ÷ 적용 지원금 — 절대 금액은 어디에도 쓰지 않는다(등급 구매 차단)</li>
            <li>표본 = 결제 기록이 있는 방문형 완료 건. <b>적용 지원금 {W_MIN_SUPPORT.toLocaleString()}원 미만 건 제외</b>(소액 결제 만점 어뷰징 차단)</li>
            <li>표본 신뢰 가중 min(1, n/{W_FULL_SAMPLE}) — 1건 고액 결제 만점 방지 (뱃지 완료 {WINWIN_BADGE.minCompleted}건 기준과 일치)</li>
            <li><b>결제 표본 0건 월 = 상생 중립</b> — W 제외, GS = ({REGRADE_WEIGHTS.I}·I + {REGRADE_WEIGHTS.F}·F) ÷ {REGRADE_WEIGHTS.I + REGRADE_WEIGHTS.F} − P 재정규화 (이력 <code>wNeutral</code>)</li>
            <li>상생 리뷰어 뱃지 = W ≥ {WINWIN_BADGE.minW} & 완료 {WINWIN_BADGE.minCompleted}건↑ (표시 전용 · 유예 1개월 · 2개월 연속 미달 시 회수)</li>
          </ul>
        </div>
      </section>

      {/* P — 패널티 */}
      <section className="mt-4">
        <h2 className="text-[15px] font-bold text-ink mb-2">P · 패널티 (차감)</h2>
        <div className="rounded-lg border border-hairline bg-canvas overflow-hidden text-[12px]">
          <div className="grid grid-cols-3 px-4 py-2.5 bg-sunken font-semibold text-ink2">
            <span>사유</span><span>감점</span><span>판정</span>
          </div>
          {[
            { k: "노쇼 만료", v: `−${PENALTY.noShow}/건`, d: "미사용 만료 (expired)" },
            { k: "리뷰 기한 초과", v: `−${PENALTY.overdue}/건`, d: "reviewDeadline 경과 미제출" },
            { k: "반려 종착", v: `−${PENALTY.rejectedFinal}/건`, d: "1회 재제출 후 추가 반려" },
            { k: "연속 발생 가중", v: `×${PENALTY.repeatFactor}`, d: "직전 월에도 P>0이면" },
            { k: "월 차감 상한", v: `−${PENALTY.monthlyCap}`, d: "가중 적용 후 상한 — 어떤 달도 초과 불가" },
            { k: "취소", v: "0", d: "무패널티 — 12h 재신청 제한이 담당" },
          ].map((r, i) => (
            <div key={r.k} className={`grid grid-cols-3 px-4 py-2.5 text-ink tabular-nums ${i > 0 ? "border-t border-hairlineSoft" : "border-t border-hairlineSoft"}`}>
              <span className="font-semibold">{r.k}</span>
              <span>{r.v}</span>
              <span className="text-muted">{r.d}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 컷·안정 장치 */}
      <section className="mt-4">
        <h2 className="text-[15px] font-bold text-ink mb-2">등급 컷·안정 장치</h2>
        <div className="rounded-lg border border-hairline bg-canvas p-4 text-[12px] text-ink leading-[1.7]">
          <div className="font-semibold tabular-nums">
            컷: {GRADE_CUTS.map((c) => `${c.grade} ≥ ${c.min}`).join(" · ")} · N = 채널 미연동 전용(컷 없음)
          </div>
          <ul className="mt-2 space-y-1 text-ink2 list-disc pl-4">
            <li>6단계 체계(2026-08-06): S+ / S / A / B / C / N. <b>S까지 자동 평가</b>(구 &quot;S 수동 부여&quot; 폐기) — 채널 등급 상한은 S</li>
            <li><b>S+ = 계정 표기 등급</b> — 전월 표기 등급 S 이상 + 채널 최고 등급 S + F 100 + W 100(중립 아님) + P 0 + 표본 충족을 전부 만족한 달에만 부여(갓 S로 승급한 달은 불가 — 다음 달부터). 하나라도 미충족이면 다음 스윕에서 S로 하강(±1 정합). 혜택: 골드 배지 · 배송형 포인트 적립 +10% · 프로모션 최우선 · 검수 우선 처리 — <b>지원금 배율은 S와 동일 100%</b>(기준 지원금이 절대 상한, P2)</li>
            <li>연동 채널이 있으면 최저 C(GS 바닥) — N으로 강등되는 경우는 없다. N→평가 진입은 채널 연동 시 즉시</li>
            <li>월 변동 폭 ±1등급(채널 등급 기준) · S+는 조건 배지 성격 — 조건 미충족 시 즉시 해제(통상 S로, 채널이 함께 내려간 달은 그 등급으로)</li>
            <li>표본 부족(당월 이벤트 &lt; 2건) = F/W 중립 → GS = I − P · 이벤트 0건 = 스킵(등급 유지) — 중립·스킵(무활동) 월은 S+ 불가(보유 중이면 S로)</li>
            <li>평가월 중 가입자 제외(첫 재평가는 가입 다음 달 말) · 소급 없음 — 직전 1개월만</li>
            <li>리뷰 품질은 점수 요소에서 배제 — 반려 종착만 P로 반영 (<code>qualityScore</code> deprecated)</li>
            <li>[P1] 재평가 산출물(GS·패널티·뱃지·S+)은 혜택 크기에만 영향 — 참여/발급 분기 참조 금지</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
