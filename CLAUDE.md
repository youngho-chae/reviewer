# CATCHPASS 프로젝트 규칙 (CLAUDE.md)

CATCHPASS: 등급 기반 리뷰 체험권 플랫폼 (Next.js 15 App Router, 모바일 웹 480px).
문서 맵: 요구 `PRD.md` · 기능 `docs/기능정의서.md` · 운영 `docs/운영정책서.md` · 데이터 `docs/데이터정책서.md` · IA `docs/IA.md` · 시나리오 `flow.md` · 화면설계서 `docs/sdd/`.

## 핵심 정책 불변식 (PRD §1.0 — 절대 위반 금지)

- **P1. 모든 등급(S/A/B/C/N)은 모든 캠페인에 참여할 수 있다.** 등급은 참여 **자격이 아니라 혜택의 크기**(지원금 배율 S100/A80/B60/C40/N10%)만 결정한다. "최소 참여 등급"·"등급 부족"·"OO등급 전용"·등급 잠금/오버레이/흐림 처리는 **어떤 형태로도 만들지 않는다**. 참여를 막는 조건은 ①캠페인 종료 ②(방문형) 채널 미연동 ③잔여 슬롯 소진 — 3가지뿐. quota{S,A,B,C} 버킷은 배분 기록이지 자격이 아니다.
- **P2.** 방문형 지원금 = 매장이 결제 시 직접 할인 (회사 무정산).
- **P3.** 사장님은 후기 조회만 — 검수는 운영팀 단일 책임 (`/api/passes/approve`는 410).
- **P4.** 사용자 노출 수치·사회적 증거는 실제 발생 이벤트만 (조작·noise 금지).
- **P5.** 발행하는 보상은 반드시 실사용(소비) 경로가 구현되어 있어야 한다.

## 검증 규칙 (2026-07-07 판단 실패의 교훈)

1. **문서-코드 일치 ≠ 정책 정당성.** 문서와 코드가 서로 일치해도 위 불변식에 어긋나면 **양쪽 다 결함**이다. 감사·검증 시 반드시 불변식 목록과도 대조하라. (실사례: PRD와 코드가 똑같이 "최소 등급 게이트"를 갖고 있어 일치 감사를 통과했지만, 실제 정책 P1 위반이었다.)
2. **내적 모순은 정책 오류의 신호다.** 예: `SUPPORT_MULTIPLIER`에 N=10%가 정의되어 있는데(N등급도 혜택을 받는 전제) 게이트가 N의 참여를 전부 차단하고 있었다 — "쓰이지 않는 정책 값"이나 "도달 불가 분기"를 발견하면 정합성 문제로 보고하라.
3. 불변식과 모순되는 요구·구현을 발견하면 **조용히 유지하지 말고** 사용자에게 확인하거나 정정하라.
4. 정책 수치·규칙 변경 시 코드 + 문서 6종 + `docs/sdd/figma-scripts/data/*` + Figma 보드를 함께 갱신한다 (카피 원문주의).

## 기술 메모

- **디자인 시스템 v2 (정본 `DESIGN.md`)**: Primary 퍼플 #9333EA · Pretendard · 파스텔 SNS 배지 · 헤어라인 라운드 카드 · 타이포 11~22px. v1 Apple 톤(Action Blue·다크 타일·SF Pro)은 파기 — 재도입 금지. 규칙: 퍼플=인터랙션, 검정=가치(금액), 파스텔=SNS 아이덴티티, 블루=마케팅 슬롯 전용. 화면설계서(Figma 보드)는 v1 기준으로 남아 있음(v2 반영은 별도 지시 대기).
- 등급·배율: `src/lib/grade.ts` (gradeMeets는 P1 위반으로 삭제됨 — 재도입 금지).
- **등급 월간 재평가 (2026-07-08)**: `src/lib/grade-regrade.ts` — 매월 말(KST) lazy 스윕. GS = 0.70 지수(`indexScoreV1`) + 0.20 성실 이행 + 0.10 상생지수 − 패널티. 컷 S90/A70/B50/C30 · 월 ±1등급 · S 자동 부여 금지(sCandidate 기록만) · 리뷰 품질 요소 없음(반려 종착만 패널티) · 상생지수는 비율·건별 캡 1.0·완료 전제(절대 금액 사용 금지) · 상생 리뷰어 뱃지(W≥60&완료 3건↑, 표시 전용). **재평가 산출물(GS·패널티·뱃지)을 참여/발급 분기에서 참조하면 P1 위반.** 정본: 운영정책서 §10.
- 발급: `src/app/api/passes/route.ts` — 자기 등급 버킷 우선, 소진 시 잔여 버킷(N→C부터). `consumedSlot`으로 만료/취소 시 복구.
- **2026-07-07 회의 확정 수치**: 체험권 유효 **발급 후 72h**(연장·복구 불가) · 리뷰 **이용 후 7일** · active 동시 보유 **5장** · 취소 후 동일 캠페인 **12h 재신청 제한** · '걸어서 갈 수 있어요' 반경 **3km**. MVP는 방문형만(`src/lib/flags.ts PRESS_ENABLED=false`). 캠페인 노출은 발급 소진 ≠ 종료(`src/lib/campaign-visibility.ts`). 관심 목록은 캠페인 단위(`db.interests`, `/r/interests`). 스키마 라벨은 형식 마스크(`000,000원`/`00건` — `SBUI`), 금액은 원 접미(₩ 접두 금지).
- 스토리보드 모드: `src/lib/storyboard.ts`의 `STORYBOARD` 플래그 (true = 스키마 라벨 렌더, 시드 버전 1000+ 계열).
- **최종 확정 정책 (2026-07-08, `dev` 브랜치)**: 사장님 화면에 체험자 **등급·실명 절대 비노출**(익명 #last4만 — 홈 버킷/로그/후기/스캔/알림/리포트, 내부 데이터는 어드민 전용) · 부스팅(우선 등급) 폐기 — `distributeQuota` 균등 · **사업자 인증**(Owner.bizStatus, pending이면 /o/* 대기 화면, 인증은 /admin/owners) · 캠페인명 = 사장님 관리용(체험자는 매장명 노출) · 필수 메뉴 선택 입력·최대 5개 · 지역 3km·지도 '이 지역 재검색'은 `src/lib/geo.ts`(하버사인·regionCenter) 기준 · **N등급 현행 유지**(5단계). 미확정 항목 제안: 운영정책서 §13.
- **추가 작업 리스트 반영 (2026-07-10, `dev`)**: ① 파생 표시 상태는 `src/lib/pass-display.ts` 단일 정의 — **PassStatus를 확장하지 않는다**(overdue="제출 기한 초과"/resubmit_expired="재제출 기한 초과"는 렌더 시점 계산, 탭 분류는 실상태·칩/뱃지만 파생 상태) ② **추천순** = `src/lib/recommend.ts`(issued_out 최후 → 사장님 `PLAN_RANK` Premium>Standard>Basic>Free → 최신순) — 사장님 멤버십 기준 노출 우대이지 리뷰어 등급이 아니므로 P1 무관 ③ 시드 useCode 전 캠페인 **"1234"** 통일(QA 기준) · 4자리 코드 오입력 **연속 5회 → 10분 잠금**(Pass.useCodeFailCount/LockUntil, 실패 상태 불변) ④ 게시 유지 **전 채널 90일**·별도 필수 동의(`keepAgreed`, 자가점검은 `selfCheckConditions()`=keep 제외 — ReviewForm·review route·시드가 반드시 공유) ⑤ 탐색 `?area=`(행정 기준점 3km)·`?ch=` URL 유지, 필터 시트는 draft+[적용하기](`explore/FilterSheet.tsx`), 전국 축소(zoom<10) 시 시도 클러스터(`nearestSido`/`SIDO_CENTERS`) — 홈 '전체 리스트' 더 둘러보기 = `?scope=all`(전국 줌 7 시작·area 무시), '걸어서' = `?mode=list&sort=distance&area=`; **반경 3km 필터는 지도 전용**(리스트는 필터 시트 기준) ⑥ **전 지역 시드**: REGIONS 시군구 229곳 전부 매장·캠페인 1건씩(demo4 사장님) — 지역 라벨은 복합 키 **"{시도} {시군구}"**(구명 중복 해소, `geo.ts GUGUN_CENTERS`가 정본·시드와 좌표 정합). SEED_VERSION 1018.
- 시크릿: env 전용 (AUTH_SECRET은 production fail-closed, Naver 키 폴백 금지).
- 빌드 검증: `npx next build` (unused import/var는 빌드 실패).
