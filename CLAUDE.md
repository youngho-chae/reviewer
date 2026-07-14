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
- **추가 작업 리스트 반영 (2026-07-10, `dev`)**: ① 파생 표시 상태는 `src/lib/pass-display.ts` 단일 정의 — **PassStatus를 확장하지 않는다**(overdue="제출 기한 초과"/resubmit_expired="재제출 기한 초과"는 렌더 시점 계산, 탭 분류는 실상태·칩/뱃지만 파생 상태) ② **추천순** = `src/lib/recommend.ts`(issued_out 최후 → 사장님 `PLAN_RANK` Premium>Standard>Basic>Free → 최신순) — 사장님 멤버십 기준 노출 우대이지 리뷰어 등급이 아니므로 P1 무관 ③ 시드 useCode 전 캠페인 **"1234"** 통일(QA 기준) · 4자리 코드 오입력 **연속 5회 → 10분 잠금**(Pass.useCodeFailCount/LockUntil, 실패 상태 불변) ④ 게시 유지 **전 채널 90일**·별도 필수 동의(`keepAgreed`, 자가점검은 `selfCheckConditions()`=keep 제외 — ReviewForm·review route·시드가 반드시 공유) ⑤ 탐색 `?area=`(행정 기준점 3km)·`?ch=` URL 유지, 필터 시트는 draft+[적용하기](`explore/FilterSheet.tsx`) — 지역은 **3상태**(미선택 기본(전국)/현위치 토글 해제 가능(`?loc=me`)/지역, 상호 배타), 전국 축소(zoom<10) 시 시도 클러스터(`nearestSido`/`SIDO_CENTERS`) — 홈 '전체 리스트' 더 둘러보기 = `?scope=all`(전국 줌 7 시작·area 무시), '걸어서' = `?mode=list&sort=distance&area=`; **반경 3km 필터는 지도 전용**(리스트는 필터 시트 기준) ⑥ **전 지역 시드**: REGIONS 시군구 229곳 전부 매장·캠페인 1건씩(demo4 사장님) — 좌표 정본은 복합 키 **"{시도} {시군구}"** 기준 `geo.ts GUGUN_CENTERS`. **표기 라벨은 `regions.ts regionLabel`**(2026-07-12): 시군구명이 시도 간 중복이면 "{시도} {시군구}", 전국 유일하면 시군구 단독 — 단독 라벨도 regionCenter가 findSido→복합 키로 해석. SEED_VERSION 1018.
- **SNS 채널 연동·검증 (2026-07-10)**: 채널 관리 `/r/me/channels`(연동/해제/본인 인증) — OAuth 코어 `src/lib/sns-oauth.ts`(네이버/Meta/틱톡 로그인, state CSRF·**토큰 미저장**), 키 미설정 시 데모 검증(`/r/channels/verify`, verifiedVia="demo"·실키 시 403). verified는 신뢰 표식 — **참여 게이트는 연동 여부뿐(P1)**. 해제 = 등급 재계산·진행 패스 유지. 서버리스 인스턴스 불일치는 `src/lib/sns-cookie.ts` 쿠키 스톱갭(체험자 화면 6곳+발급 API가 `effectiveChannelState()` 병합)으로 본인 시점 즉시 반영 — cross-actor는 KV 필수.
- **레뷰 벤치마크 — 배송형·포인트 (2026-07-12, `dev`)**: 근거·적용/보류 판정은 `docs/벤치마크-레뷰.md`(구매평·페이백은 P4 리스크로 보류 — §13 #18). ① **배송형** `CampaignKind "delivery"`(`flags.ts DELIVERY_ENABLED=true` — "MVP 방문형만"의 범위 개정): 신청 시 배송지 필수(`Pass.shipping` — **발송 목적 한정으로 사장님 발송 큐에만 노출**, 익명 원칙의 명시적 예외·등급은 계속 비노출), active 기한=캠페인 종료일, 사장님 발송 처리(`/api/owner/ship`)가 usedAt 세팅 → **발송 후 7일** 리뷰(기존 스윕 재사용), 발송 후 취소 불가. 탐색 배송형 세그먼트는 **리스트 전용**(`?tab=delivery` — 지도·거리·지역 필터 미적용). ② **포인트** `src/lib/points.ts`(정본: 운영정책서 §14): 적립 = 배송형 리뷰 **검수 승인만**(P4) — `pointReward × SUPPORT_MULTIPLIER`(P1·100P 반올림), 원장 `PointTxn` append-only(잔액=합산), 출금(P5) 최소 1만P·1천P 단위·수수료 500원·**사업소득 3.3% 원천징수+소액부징수(세액 1,000원 미만 0)** — 세액은 신청 시점 확정 보존, 미리보기와 서버가 `quoteWithdrawal` 공유. 처리 큐 `/admin/points`. ③ 방문형 `reservationRequired` 옵션(예약형 라이트 — 선정 절차 없음) ④ **배송형 카테고리는 플레이스 분류가 아니라 상품군 분류**(`src/lib/delivery-categories.ts` 단일 정본 — 식품/뷰티/리빙/패션잡화/디지털/키즈·펫/건강, `Campaign.productCategory` 배송형 필수·생성 API 검증) — 탐색 배송 칩·배송 필터 시트(지역/참여 방식 미노출)·생성 폼 공유, `?dcat=` URL 유지 ⑤ **참여 방식 필터**: 방문형 필터 시트에 전체/바로 방문/예약 필수(`?v=`, 단일 선택, 지도·리스트 공통) + 카드 "📅 예약 필수" 배지 — 배송은 세그먼트 자체가 방식(3방식 각각 필터 가능) ⑥ **내 체험권도 세그먼트 분리**: 배송 패스는 방문형에 섞지 않고 배송형 세그먼트(서브 탭 "신청 내역"·발송 대기 칩)에서만 노출(`PassesView`). SEED_VERSION 1020.
- 시크릿: env 전용 (AUTH_SECRET은 production fail-closed, Naver 키 폴백 금지).
- 빌드 검증: `npx next build` (unused import/var는 빌드 실패).
