# CATCHPASS · Viral Referral Test (Standalone)

> 본 디렉토리는 메인 catchpass(`/src`, `/PRD.md`)와 **완전히 분리된** 자체 로컬 프로토타입입니다.
> 기존 코드/데이터/세션을 일체 건드리지 않습니다. 별도 포트(5180)에서 독립 실행됩니다.

## 무엇이 들어있나

- Toss 바이럴 6원리(즉시보상·양면인센티브·마찰최소화·소셜증거·게이미피케이션·재방문훅)를 적용한 자발적 홍보(레퍼럴) 흐름.
- 6개 화면: Home / 초대 작성 / 피추천자 랜딩 / 환영 박스 / 추천 현황 대시보드 / 보상.
- 4종 추천 매트릭스: RR(체험자→체험자), RO(체험자→사장님), OR(사장님→체험자), OO(사장님→사장님).
- 실시간 N명 카운터(mock SSE) + 라이브 스트림 ticker.
- 슬롯 머신 스타일 가변 보상 박스 + 컨페티 + 진행도 바.
- localStorage 기반 mock store(`catchpass.viral.v1`) — 새로고침 후 상태 유지.

## 사전 요구
- Node.js ≥ 18.18

## 설치 + 실행 (`/test-viral` 에서)

```bash
cd test-viral
npm install
npm run dev
# → http://localhost:5180
```

빌드:
```bash
npm run build
npm run preview
```

## 데모 시나리오 (5분)

1. http://localhost:5180 진입 → 기본 데모 사용자 "앨리스 (체험자)" 로 로그인된 상태.
2. **트리거 시뮬레이션**: 홈 하단 "T1 — 패스 사용 완료 시뮬레이션" 클릭 → 추천 카드 상단에 노출.
3. **초대 작성**: 추천 카드 클릭 → /invite/new → "체험자 초대" 선택 → [🎁 친구에게 쏘기] → 공유 시트 → "카톡" 또는 "링크 복사" 선택.
4. **피추천자 시점 진입**: 시트 닫힘 후 [피추천자 시점에서 진입해보기 →] 버튼 클릭 → 토큰 딥링크로 이동.
5. **가입 + 박스**: 닉네임 확인 → [박스 받고 가입하기 →] → 슬롯 머신 회전 → 환영 박스(+50% 쿠폰 + 보너스 캐시) 결과 카드.
6. **양면 보상 확인**: /debug에서 "앨리스"로 다시 전환 → /rewards 에서 행운 박스 캐시 보상 확인 / /dashboard 에서 가입 카운트 +1.
7. **K-factor 확인**: /dashboard 하단 시스템 K-factor 카드 — 0.5 이상이면 ✅ 게이트 통과.

추가:
- /debug 에서 데모 사용자 4종(체험자/사장님)을 자유 전환 + 전체 초기화.
- 매트릭스 4종 모두 데모 가능 — "초대 대상"에서 사장님 선택 시 OO/OR/RO 보상 시나리오 진입.

## OKR과의 연결

본 프로토타입은 `/docs/viral-test/PRD-viral-referral.md` §10의 OKR 검증 시나리오를
실제 클릭 가능한 흐름으로 만든 도구입니다.

- 출시 3개월 OKR: 체험자 20k / 사장님 10k (Acquisition)
- 그 이후: 바이럴로 각 2배 (40k / 20k)
- 본 트랙이 검증해야 하는 **first gate**: K-factor ≥ 0.5 (출시 1개월 차)

대시보드 화면이 K-factor 추정값을 실시간 표시하므로, 데모 시나리오를 반복 실행해서 게이트가 의도대로 동작하는지 확인 가능.

## 메인 코드와의 통합 방식 (향후)

본 트랙은 **인터페이스 어댑터**만 노출합니다 (`src/store/mockStore.ts` 의 `store` 객체가 곧 `ReferralAdapter` 구현):

```ts
interface ReferralAdapter {
  recordInviteSent(args): Promise<token>
  recordInviteAccepted(args): Promise<{ referrerReward, refereeReward }>
  onPassUsed(args): Promise<void>            // T1: 패스 사용 직후
  onCampaignCreated(args): Promise<void>     // T4: 사장님 캠페인 생성 직후
  onGradeUp(args): Promise<void>             // T3: 체험자 등급 상승
  getCounter(): Promise<CounterSnapshot>
}
```

메인 catchpass(src/) 측은 위 함수를 호출만 하면 됩니다. 기존 컴포넌트·DB 스키마 미수정.

## 격리 확인 (검증)

```bash
git diff main -- src/ PRD.md Flow.md            # → 빈 출력 (변경 없음)
git diff main -- docs/viral-test/ test-viral/   # → 본 트랙의 신규 파일들만 출력
```

## 보안 / 어뷰징 가드 (PRD §11)

본 데모는 mock이라 가드를 강제하지 않으나, 실서비스 적용 시 필수:
- 동일 사용자 셀프 추천 차단
- IP/디바이스 단위 24h 3회 초과 가입 자동 hold
- 사용자당 박스 누적 보너스 캐시 월 ₩50,000 캡
- 토큰 만료 14일

## 변경 이력
- v0.1 (2026-06-16): 초안. 6화면 + 4 매트릭스 + 라이브 카운터 + 슬롯 박스 + K-factor 대시보드.
