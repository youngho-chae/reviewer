# CATCHPASS · PRD (배포 버전 기준)

> 본 문서는 `reviewer-hgx1.vercel.app`에 실제 배포된 코드를 기준으로 한 제품 명세입니다.
> 초기 HTML 프로토타입 기획에서 변경된 부분(라우트·정책·UX)을 모두 반영하며, 변경 이력은 §14에 기록합니다.
> 화면 코드(R-xx/O-xx)는 프로토타입과의 추적성을 위해 유지하되, 실제 Next.js 라우트와 매핑합니다.

---

## 0. 한 줄 소개

> **"선정 기다리는 체험단 말고, 등급으로 받는 체험권."**
> 리뷰어는 자기 등급에 맞는 체험권을 즉시 발급받고, 사장님은 멤버십으로 무제한 모집한다.

CATCHPASS는 모바일 우선 웹앱(Next.js 15 App Router)으로 구현된 체험 마케팅 모듈입니다.
체험자와 사장님은 같은 데이터(매장·캠페인·체험권)를 양쪽에서 보지만, 진입 경로(`/r/...` vs `/o/...`)와 권한은 분리되어 있습니다.

| 역할 | 진입 경로 | 인증 |
|---|---|---|
| 체험자 (리뷰어) | `/r/login` · `/r/signup` | 이메일+비밀번호 + SNS 채널 정보(URL+영향력 수치 입력) |
| 사장님 | `/o/login` · `/o/signup` | 이메일+비밀번호 |

> ※ 본 배포는 데모/MVP 단계로, OAuth·외부 SNS API 연동·결제 게이트웨이는 미구현. SNS 영향력은 사용자가 직접 입력한 수치로 등급을 산정한다.

---

## 1. 제품 개요

### 1.1 문제와 해결 방식

기존 체험단의 문제 — 신청·심사 대기, 사장님의 직접 검수 부담, 광고표시·노쇼 마찰.

CATCHPASS의 해결:
- **등급으로 자동 매칭**: SNS 영향력 기반 S/A/B/C/N 5단계. 등급 충족 시 즉시 발급.
- **멤버십 기반 무제한 모집**: 월 구독으로 캠페인 무제한. 매장 할인은 손님에게 직접 제공.
- **운영팀 단일 검수 + 채널톡 문의**: 사장님은 후기 **조회만** 가능. 재작성/수정 등 이의는 채널톡으로 운영팀에 문의.
- **두 가지 캠페인**: 방문형(visit) + 자료팩 기반 비방문 기자단(press).

### 1.2 캠페인 타입 비교

| 구분 | 방문형 (visit) | 기자단 (press) |
|---|---|---|
| 흐름 | 매장 방문 → QR 또는 8자 단축 코드 제시 → 결제 할인 → 리뷰 작성 | 자료팩 수령 → 본문 1,000~1,500자 작성 → URL 제출 |
| 사장님 비용 | 멤버십 정액 (월 구독) | 종량제 선결제 (운영팀 처리) |
| 정산 | 즉시 (할인은 매장에서 제공) | 검수 통과 후 송금 (3.3% 원천징수) |
| 리뷰어 대상 | 등급 충족 시 누구나 | 등급 충족 + 자료팩 활용 작성 |

### 1.3 핵심 등급 시스템

5단계 **S → A → B → C → N**. 상위 등급일수록 고지원금/고정산 캠페인 우선 노출.

```
S  상위 5% 리뷰어
A  검증된 리뷰어
B  일반 리뷰어
C  성장 단계
N  검증 전 (SNS 미연동)
```

산정: SNS 영향력 합(naver_blog 가중치 1.2, 인스타/유튜브/틱톡 1.0) 기반 (`src/lib/grade.ts`).
- ≥ 50,000 → A
- ≥ 10,000 → B
- ≥ 1,000 → C
- 그 외 → N (가입 시 SNS 미연동 포함)
- S 등급은 운영팀 부여 영역(자동 산정 대상 아님)

---

## 2. 사용자 페르소나 (요약)

- **체험자 (김리뷰)**: 30대, 자기 글의 영향력으로 자동 매칭받기를 원함. 떨어질 걱정 없이 등급으로 받는 안정감을 추구.
- **사장님 (정사장)**: 매장 운영 중 모바일로만 확인. 매번 모집·심사·검수에 시간 뺏기는 것을 싫어함. 멤버십 한 번 결제 = 알아서 돌아가는 상태를 원함.

---

## 3. 화면 인벤토리 (배포 기준)

> 좌측 화면 코드는 추적성을 위한 라벨, 우측은 실제 Next.js 라우트.

### 3.1 체험자 (Reviewer) — `/r/...`

| 코드 | 화면명 | Next.js 라우트 |
|---|---|---|
| R-00 | 가입·온보딩 | `/r/signup` (3-step: 컨셉 → 계정 → SNS 연동) |
| R-00b | 로그인 | `/r/login` |
| R-01 | 홈 (리스트 + 지도 통합) | `/r/home` |
| R-03 | 매장 상세 | `/r/store/[id]` |
| R-04 | 내 체험권 | `/r/passes` (방문형/기자단 탭) |
| R-04a | 체험권 상세(QR 또는 상태 안내) | `/r/passes/[id]` |
| R-05 | 리뷰 인증 폼 | `/r/passes/[id]` (used 상태일 때 같은 페이지에 폼 노출) |
| R-06 | 내 등급 | `/r/grade` |
| R-07 | MY | `/r/me` |
| R-07a | 알림함 | `/r/notifications` |
| R-08a | 기자단 브리프 | `/r/press/[id]` |
| R-09 | 기자단 작성 | `/r/press/[id]/write?pass=<id>` |
| R-08 | 기자단 보관소 (별도 화면 아님) | `/r/passes`의 기자단 탭 |

**BottomNav (4탭)**: 홈 / 내 체험권 / 등급 / MY. 알림은 모든 페이지 상단 종 아이콘 진입.

### 3.2 사장님 (Owner) — `/o/...`

| 코드 | 화면명 | Next.js 라우트 |
|---|---|---|
| O-00 | 홈 | `/o/home` |
| O-00b | 로그인·가입 | `/o/login`, `/o/signup` |
| O-01 | 후기 모니터링 (조회 전용) | `/o/reviews` |
| O-02 | QR 스캔 + 코드 직접 입력 | `/o/scan` |
| O-03 | 성과 리포트 | `/o/report` |
| O-04 | 더보기 (메뉴 허브) | `/o/me` |
| O-04a | 알림함 | `/o/notifications` |
| O-10 | 새 캠페인 | `/o/campaign/new` |
| O-11 | 체험권 사용 로그 | `/o/logs` |
| O-12 | 매장 정보 | `/o/stores` |
| O-14 | 멤버십 / 구독 관리 | `/o/membership` |

**BottomNav (4탭)**: 홈 / QR 스캔 / 후기 / MY. 리포트·멤버십·로그·매장정보 등은 더보기(MY) 메뉴 허브 진입.

> 변경점: 프로토타입의 5탭 + 중앙 elevated [⎈ 스캔] 디자인은 사용하지 않음. 4탭 평면 BottomNav로 통일.

---

## 4. 핵심 시나리오 (배포 기준)

### 시나리오 A — 체험자, 가입부터 첫 방문형 리뷰까지

```
[/r/signup] Step 0 — Apple 톤 헤드라인 "선정 기다리는 체험단 말고…"
    → [시작하기]
[/r/signup] Step 1 — 이메일/비밀번호/닉네임
    → [다음]
[/r/signup] Step 2 — SNS 채널 (4종) URL + 영향력 수치 직접 입력
    · 1개 이상 연동 시: 영향력 기반 N~A 자동 산정
    · [연동 없이 시작 (N등급)] 보조 액션 제공
    → 가입 완료, 세션 쿠키 설정 → /r/home 진입

[/r/home] 리스트 (기본 모드)
    · 상단 frosted 헤더 + 종 아이콘(미읽음 점)
    · 인사말 + GPS 기반 현재 위치 라벨 (역지오코딩)
    · "내 정보 보기" 아코디언 (등급 카드: 큰 배지 + 등급 설명 + 누적 리뷰/품질 점수/활성 패스)
    · 지역 검색 input (매장명·동네·카테고리 부분 일치)
    · 방문형 / 기자단 탭 토글
    · 방문형: 카테고리 chip (전체/한식/양식/일식/카페/주점/분식/디저트/미용실/네일아트/피부과/치과/한의원/애견미용/동물병원/PT/필라테스/마사지/…)
    · 리스트/그리드 토글 (1열 row vs 2열 grid)
    · 매장 카드: 실제 사진(음식점) 또는 카테고리별 SVG 커버(비음식 업종) +
      카테고리 라벨 + 매장명 + 지역 · ★ 평점 + 멤버십 할인 ₩ + "참여하기 →"
    · 등급 부족 매장: 카드 어둡게 + 자물쇠 + "등급 부족" 오버레이
    · 화면 중앙 하단 FAB: [📍 지도] / [☰ 리스트] 토글

[/r/home] 지도 모드 (FAB 탭)
    · 풀스크린 Naver Map + 핀 마커(grade 배지색 테두리 흰 pill: "{등급} · {매장명} · ₩{할인}")
    · 상단 floating 검색 input + 카테고리 chip overlay + 일치 카운트 chip
    · 핀 탭 → 하단 토스트 카드 (썸네일 + 매장명 + 지역/카테고리 + 잔여/할인 + [상세 →])
    · 매장 선택 시 FAB가 토스트 상단으로 양보

[/r/store/[id]] 매장 상세
    · 4:3 풀-블리드 사진 hero
    · 매장명/카테고리/평점/주소
    · 다크 tile1 영역: 멤버십 할인 지원금 큰 숫자 + 잔여매·사용기한·영업시간
    · 이용 방법 3단계 (참여→QR→리뷰)
    · 필수 채널 pill / 필수 메뉴 (캠페인에 설정 시)
    · 캠페인 설명 + 펼침: 작성 조건 (사진 5+/본문 500+/메뉴 등 1+/30일 유지)
    · 우측 하단 FAB: 길찾기 (Naver Map 앱 deep link `nmap://route/walk?...` + 800ms 후 웹 fallback)
    · Sticky CTA: [참여하기] (등급 OK + 잔여 있을 때만)

→ [참여하기] POST /api/passes { campaignId }
    · 등급 검증 + quota 차감
    · 결정론적 Pass 생성 (status="active", 24h TTL)
    · 사장님 알림 등록
    · 멀티 인스턴스 안전망: cp_recent_passes_v1 쿠키에 패스 정보 적재
    → 라우터 push: /r/passes/{passId}?just_issued

[/r/passes/[id]] active 상태 = 티켓 + QR
    · 다크 tile1 배경, frosted 상단 바
    · 흰 canvas 티켓 카드 + perforation 절단선
    · 상단 절반: 등급/매장명/지역·카테고리/할인 큰 숫자 + 카운트다운 (남은 시간 시·분)
    · 점선 구분선
    · 하단 절반: 큰 QR 코드 + "결제 시 사장님께 보여주세요"
    · 8자 영문/숫자 단축 코드 (XK7H 3M9P, 4-4 split, 헷갈리는 문자 제외)
    · 대소문자 구분 없음 안내

→ 사장님 /o/scan에서 QR 또는 코드 입력 → POST /api/passes/use
    · pass.status = "used"
    · paidAmount + supportApplied 기록
    · 체험자 알림 등록

[/r/passes/[id]] used 상태 = 리뷰 인증 폼 (R-05)
    · 사용 완료 안내 카드 (결제액·지원적용액·리뷰 마감 카운트다운 72h)
    · ReviewForm (4단계):
      1. 작성 채널 선택 (매장이 지정한 requiredChannels 중 1개)
      2. 광고 표시 문구 박스 (브랜드 컬러) + 채널별 표준 문구 + [📋 문구 복사]
      3. 리뷰 URL 입력
      4. 자가 점검 4종 체크 (사진 5+/본문 500+/메뉴·매장·분위기 1+/30일 유지)
    · 모든 자가 점검 + 채널 + URL + 광고 체크 시 [제출하고 인증 받기] 활성화

→ POST /api/passes/review → pass.status = "review_submitted"

[/r/passes/[id]] review_submitted 상태
    · "운영팀이 광고 표시·작성 조건을 검수합니다 (최대 72시간)"

→ 운영팀 처리 후 completed (등급 점수 반영) 또는 rejected (채널톡 문의 안내)
```

### 시나리오 B — 체험자, 기자단 비방문 콘텐츠 작성

```
[/r/home] 기자단 탭
    · 카드: 카테고리/매장명/지역 + 자료팩 N장 + 잔여/총 모집 + 정산 예정금 ₩ + "3.3% 원천징수 후 입금"
    · 등급 부족 시 카드 어둡게 + 자물쇠

[/r/press/[id]] 기자단 브리프 (R-08a)
    · 다크 히어로: 등급/매장명/지역 + 정산 예정금 + 마감 D-N + 잔여 N자리/총 N명 (≤2 → "곧 마감")
    · 자료팩 미리보기 (신청 전엔 blur, 신청 후 풀공개)
    · 매장 정보 / 최소 본문자 수 / 필수 키워드 / 게시 채널 / 캠페인 설명
    · Sticky CTA: [참여 신청하기] → POST /api/passes (kind=press 분기)

→ 신청 완료 → /r/passes 기자단 탭에 카드 등록 + 활성 캠페인 카운터 +1

[/r/passes] 기자단 탭
    · 상단 통계 스트립: 작성 중 N건 / 검수 중 N건 / 정산 예정 ₩
    · 카드: 등급 배지 + 매장명 + 지역/카테고리 + 정산 예정금 + 상태별 CTA
      - active: [작성 시작 →]
      - review_submitted: "운영팀 검수 중 · 최대 72시간"
      - completed: 정산 완료 안내

[/r/press/[id]/write?pass=...] 기자단 작성 (R-09)
    · 자료팩 풀공개 (다운로드 표시)
    · 필수 키워드 pill (입력란에 모두 포함되어야 통과)
    · 광고 표시 문구 노란 박스
    · 작성 폼 (PressWriteForm): 채널 / URL / 본문(min 1,000~1,500자) / 광고 체크
    · 키워드 누락 또는 본문 부족 시 CTA disabled

→ POST /api/passes/review (reviewBody 포함) → review_submitted → 운영팀 검수 → completed (정산)
```

### 시나리오 C — 사장님, 첫 진입부터 캠페인 오픈

```
[/o/login] 이메일/비밀번호
    → 세션 쿠키 → /o/home

[/o/home] 홈
    · 인사 + 매장군 이름
    · "최근 등록된 후기 N건이 운영팀 검수 중" 다크 카드 → /o/reviews
    · 현재 플랜 스트립 ({Plan} · 무제한 모집) → /o/me
    · 이번 달 모집 현황 (누적 모집 / 사용 진행 / 검수 대기)
    · 진행 중 캠페인 카드 리스트 (S/A/B/C 슬롯 used/quota + D-N + 매장명)
    · [+ 새 캠페인]

[/o/campaign/new] 새 캠페인
    · 매장 선택 (드롭다운)
      "캠페인 제목은 매장명 「{매장명}」으로 자동 표기됩니다."
    · 진행 일수 / 지원금 (원)
    · 총 모집 인원 — 단일 입력
      안내 카드: "{Plan} 플랜 · 등급 배분 자동 — Premium은 S우선, Standard는 A우선, Basic은 A·B·C 균등(랜덤)"
    · 필수 채널 pill 토글 (네이버 블로그/인스타/유튜브/틱톡)
    · 필수 주문 메뉴 — '+ 메뉴 추가' 버튼으로 동적 인풋 추가/삭제
    · 캠페인 설명 textarea
    · [캠페인 생성]

→ POST /api/campaigns { storeId, days, supportAmount, totalQuota, requiredMenus[], requiredChannels[], description }
    · title은 store.name으로 자동 설정
    · distributeQuota(owner.plan, totalQuota)로 등급별 quota 자동 분배
    · 즉시 활성 → 체험자 /r/home 리스트에 노출
```

### 시나리오 D — 사장님, 손님 QR 받기

```
[/o/scan]
    · [📷 카메라로 스캔하기] (Html5QrScanner)
    · 또는 8자 코드 직접 입력 (대소문자 무관, A-HJ-NP-Z 2-9)
    → POST /api/passes/lookup { code }

[/o/scan] 결과 카드
    · 캠페인명 / 리뷰어 닉네임(등급) / 상태 / 지원금 한도
    · 실 결제 금액 입력 → 적용 지원금 자동 계산 (지원금 한도 vs 결제액의 min)
    · [사용 처리]
    → POST /api/passes/use → pass.status = "used", supportApplied 기록
    → /o/home 복귀 (router refresh)
```

### 시나리오 E — 사장님, 후기 모니터링 (직접 검수 없음)

```
[/o/home] 다크 카드 또는 [후기] 탭
    → [/o/reviews]

[/o/reviews] 후기 모니터링
    · 헤더 카피: "체험자가 게시한 후기를 조회할 수 있습니다. 사장님은 직접 검수하지 않으며,
                광고 표시 누락·재작성 요청 등은 채널톡으로 운영팀에 접수해주세요."
    · 통계 카드 2개: 운영팀 검수 중 N / 통과 누적 N
    · 후기 카드 리스트:
      - 등급 배지 + 익명 #N + 채널 + 제출일
      - 상태 뱃지: '운영팀 검수 중' / '검수 통과' / '운영팀 반려'
      - 게시 URL + 본문 line-clamp-3
      - review_submitted 카드에 안내 박스 노출
      - [💬 채널톡으로 문의하기] — 모든 카드에 노출
        · ChannelIO 위젯이 있으면 호출, 없으면 모달 폴백 (매장/패스 ID/URL 포함된 mailto 링크)

[/api/passes/approve] 410 Gone — 사장님 직접 검수 폐기
```

### 시나리오 F — 사장님, 성과 확인

```
[/o/me] 더보기 → [성과 리포트]
또는 [/o/report] 직접 진입

[/o/report] 최근 30일 누계
    · 총 노출 추정 (다크 카드 + 30일 스파크라인)
    · KPI: 작성 완료율 / 광고표시 준수율 (데모 100% 가정) / 평균 본문 길이
    · CPM (1,000 노출당 비용)
    · 채널별 분포
    · 등급별 ROI
    · 노출 추정 산정 안내 (영향력 × 30% 도달율)
```

---

## 5. 디자인 시스템 (배포 기준)

### 5.1 Apple 디자인 적용
초기 프로토타입의 검정/베이지(`ink`/`paper`) 톤은 Apple 디자인 가이드(DESIGN.md)로 전환:

| 토큰 | 값 | 용도 |
|---|---|---|
| brand | `#0066cc` (Action Blue) | 주 CTA, 링크, 활성 아이콘 |
| brandSoft | `rgba(0,102,204,0.08)` | 강조 배경 |
| ink | `#1d1d1f` | 메인 텍스트, 다크 tile |
| ink2 | `#2b2b2e` | 보조 텍스트 |
| muted | `#6e6e73` | 캡션 |
| canvas | `#ffffff` | 라이트 배경 |
| parchment | `#f5f5f7` | 카드 보조 배경 |
| tile1 | `#272729` | 다크 product tile |
| hairline | `#d2d2d7` | 구분선, 테두리 |
| hairlineSoft | `#e8e8ed` | 보조 구분선 |
| gradeS/A/B/C/N | `#1d1d1f` / `#333` / `#7a7a7a` / `#ccc` / `#fff` | 등급 배지 |

- 타이포: SF Pro Display/Text 스택 + Pretendard 폴백, 큰 숫자에 `font-variant-numeric: tabular-nums`
- Radius scale: `xs5(5)` `sm8` `md11` `lg18` `pill(9999)`
- Product shadow: `box-shadow: 0 8px 24px rgba(0,0,0,0.04), 0 16px 48px rgba(0,0,0,0.05)`
- 액션 active: `transform: scale(0.95)` (`.cp-action` 유틸)
- frosted-parchment: 상단 sub-nav 배경 (`backdrop-filter: blur(20px)` + 반투명 parchment)

### 5.2 아이콘 시스템 (`src/components/Icon.tsx`)
- 21종: home/ticket/trophy/user/bell/search/pin/chevron-{down,up,left,right}/list/grid/x/plus/check/lock/arrow-right/camera/clipboard/store/navigation
- variant `"border"` (stroke 1.6) / `"bold"` (fill 또는 stroke 2.4)
- Default = border, Active/Selected = bold

### 5.3 매장 썸네일 (`src/lib/store-photo.ts`)
- 음식 카테고리(한식/양식/일식/카페/분식/주점/디저트/베이커리): 실제 음식 사진 5장 풀에서 결정론적 hash 매핑
- 비음식 카테고리(미용실/네일아트/피부과/치과/한의원/애견미용/동물병원/PT/필라테스/마사지/요가/스파/피트니스 등): 카테고리별 SVG 커버 6종 (cat-beauty/nail/clinic/pet/wellness/fitness.svg)

### 5.4 네이버 지도 (`src/components/NaverMapView.tsx`)
- Naver Maps SDK v3 + `next/script` (캐시된 SDK 재진입 안전 보장: `useState` lazy initializer + onReady + 폴링)
- 핀 마커: 단일 섹션 흰 pill에 `등급 · 매장명 · ₩금액`, 테두리는 등급색
- 핀 선택 시 하단 토스트 카드 + FAB 위로 양보 (selection → 132px)
- 길찾기 deep link: `nmap://route/walk?dlat&dlng&dname&appname=com.catchrank.catchpass` → 800ms 후 visibilityState 체크 → 웹 fallback (`https://map.naver.com/p/search/{매장명}`)

---

## 6. 핵심 규칙·정책 (배포 기준)

### 6.1 등급 산정
- SNS 영향력 가중 합 기반 자동 산정 (`gradeFromSns` in `src/lib/grade.ts`)
- 가중치: naver_blog = 1.2 / instagram·youtube·tiktok = 1.0
- 임계값: A ≥ 50,000 / B ≥ 10,000 / C ≥ 1,000 / N < 1,000 또는 미연동
- S 등급은 시스템 자동 산정 대상 아님 (운영팀 부여 영역; 데모 시드에서는 S 표기만 존재)
- 4지표(완료율·품질·광고표시·노쇼) 30일 갱신 정책은 **로드맵 — 미구현**. 현재 `completedReviews`·`qualityScore`·`noShowCount`는 reviewer 객체에 필드로만 보유

#### 6.1.1 N등급 진입
- 가입 시 SNS 1개 이상 입력 → 영향력 기반 N~A 자동 산정
- 가입 시 [연동 없이 시작] 선택 → N등급 부여 (`/r/grade` 페이지에 안내)
- 추후 MY → 채널 추가는 **로드맵** (현재는 가입 시점에만 입력)

### 6.2 멤버십 플랜 + 등급 모집 자동 분배 (**핵심 변경**)

| 플랜 | 가격(월) | 모집 가능 등급 | 분배 방식 |
|---|---|---|---|
| Basic | ₩13,900 | A·B·C | 균등 분배 (랜덤 노출) |
| Standard ⭐ 가장 인기 | ₩25,900 | A·B·C | A 우선 (½) + 나머지 균등 |
| Premium | ₩38,900 | S·A·B·C | S 우선 (½) + 나머지 균등 |

- 사장님은 **총 모집 인원**만 입력 (등급별 인원 수동 설정 폐기)
- `distributeQuota(plan, total)` (`src/lib/plan-policy.ts`)이 정책에 따라 자동 분배
  - 예: Standard·총 12명 → S=0, A=6, B=3, C=3
  - 예: Premium·총 12명 → S=6, A=2, B=2, C=2
  - 예: Basic·총 12명 → S=0, A=4, B=4, C=4
- 멤버십 페이지에 정책 설명 노출 ("A·B·C 랜덤" / "A등급 우선" / "S등급 우선")
- 플랜 변경: `POST /api/owner/plan`. 진행 중 캠페인의 quota 재분배는 적용하지 않음(생성 시점 정책 고정)

### 6.3 체험권 유효기간 & 사용
- **방문형 active**: 발급 시점부터 **24시간** (`expiresAt = issuedAt + 86_400_000`)
- 미사용 24h 경과 시 자동 `expired` 처리 (페이지 진입 시 lazy 갱신: `if (active && now > expiresAt) status = "expired"`)
- 사용 처리(POST `/api/passes/use`): 사장님 입력 결제액 + 적용 지원금 기록, `usedAt` 설정
- 사용 후 리뷰 마감: `usedAt + 72시간`. 카운트다운 표시(`Countdown` 컴포넌트, dhm 모드)
- 노쇼 시 점수 차감 정책은 데이터 모델만 존재 (자동 차감 미구현, 운영팀 수동)
- 8자 영문/숫자 단축 코드: `A-H J-N P-Z 2-9` (헷갈리는 0/O/1/I/L 제외, 4-4 split 표시), 사장님 직접 입력 지원

### 6.4 리뷰 작성 규칙 (방문형) — 자가 점검 모델
- 폼 입력: 채널 / URL / (자가 점검 4종)
- 자가 점검 (`ReviewForm` 4 체크박스, 모두 체크해야 제출 가능):
  - 사진 5장 이상
  - 본문 500자 이상
  - 메뉴·매장·분위기 사진 각 1장 이상
  - 30일 이상 게시 유지 동의
- **광고 표시 문구**: 채널별 표준 문구 박스 + 복사 버튼 + "본 문구를 게시물에 포함했습니다" 체크 필수
- **자동 검수(시스템)는 데모 미구현** — 사용자가 직접 자가 점검. 운영팀이 표본 검수

### 6.5 리뷰 작성 규칙 (기자단)
- 폼 입력: 채널 / URL / 본문 / 광고 체크
- 본문 최소자수: `campaign.pressMinChars` (시드 데이터 기준 1,200~1,500자)
- 필수 키워드(`campaign.pressKeywords`) 모두 본문에 포함되어야 제출 가능 (`PressWriteForm`에서 누락 키워드 표기)
- 정산은 검수 통과 후 운영팀이 처리 (D+7 송금, 3.3% 원천징수)

### 6.6 익명성 정책
- 사장님 화면에서는 `reviewer.id.slice(-4)`만 노출 ("익명 #1242" 패턴)
- 닉네임·이메일·SNS URL은 사장님 화면에 노출되지 않음
- 매장 측 노출 정보: 등급 배지, 채널, 제출일자, 게시 URL, 본문 line-clamp-3

### 6.7 검수 책임 분리 (**핵심 변경**)
- **사장님은 후기 조회만 가능**. 직접 검수·반려·통과 권한 없음
- `/api/passes/approve` 엔드포인트는 **410 Gone**으로 비활성화
- 광고 표시 누락 / 재작성 필요 / 부적절한 콘텐츠 발견 시 → **[💬 채널톡으로 문의하기]** 버튼만 노출
- 운영팀이 채널톡 접수 + 표본 검수 후 `completed` 또는 `rejected` 처리
- ChannelIO 위젯 미로드 시 모달 폴백 + mailto 링크(`help@catchrank.co.kr`)

### 6.8 매장 시그널
- 잔여 ≤ 3매 → "잔여 N매" 라벨 (카드 좌상단, 다크 pill)
- 등급 부족 → "🔒 등급 부족" 오버레이 (전체 어둡게)
- 인기 뱃지 미사용 (기획 §6.8 결정 유지)

### 6.9 광고 표시 문구 (채널별 표준)
| 채널 | 표준 문구 |
|---|---|
| 네이버 블로그 | 본 게시물은 캐치랭크를 통해 방문 혜택을 제공받아 작성한 후기입니다. |
| 인스타그램 | #광고 캐치랭크를 통해 방문 혜택을 제공받았습니다. |
| 유튜브 쇼츠 | 캐치랭크 방문 혜택 제공 |
| 틱톡 | #광고 #협찬 — 캐치랭크 방문 혜택 제공 |

기자단은 캠페인별 자체 문구를 매장 상세/작성 페이지에 안내.

---

## 7. 데이터 모델 (`src/lib/types.ts`)

### 7.1 Reviewer
- id, email, passwordHash, nickname
- sns: { kind, url, influence }[]
- grade: "S" | "A" | "B" | "C" | "N"
- completedReviews, qualityScore (0~100), noShowCount
- createdAt

### 7.2 Owner
- id, email, passwordHash, storeName, category, area
- plan: "Basic" | "Standard" | "Premium"
- createdAt

### 7.3 Store
- id, ownerId, name, category, area, coverEmoji
- rating, reviewCount, hours
- lat, lng, address, naverPlaceId (지도 deep link 용)

### 7.4 Campaign
- id, storeId, kind: "visit" | "press"
- title (visit은 매장명 자동, press는 사용자 입력 또는 시드)
- startAt, endAt, supportAmount
- quota: { S, A, B, C }, used: { S, A, B, C }
- requiredChannels: SnsKind[], requiredMenus: string[]
- description, createdAt
- press 전용: pressKeywords[], pressMaterials[], pressMinChars

### 7.5 Pass (status 6단계 라이프사이클)
- id, code (8자 영숫자), reviewerId, campaignId, storeId, ownerId
- reviewerGrade
- issuedAt, expiresAt (24h), usedAt?
- paidAmount?, supportApplied?
- reviewSubmittedAt?, reviewUrl?, reviewBody?, reviewChannel?, reviewStatus? ("pending"|"approved"|"rejected")
- reviewSelfCheck?: { photos, body500, menus, days30 }
- status: "active" | "used" | "review_submitted" | "completed" | "expired" | "rejected"

### 7.6 NotificationItem
- id, userId, role ("reviewer"|"owner"), title, body, createdAt, read, link

### 7.7 DBShape (영속성)
- `reviewers/owners/stores/campaigns/passes/notifications/seeded/seedVersion/naverDataFetched`
- 3단 영속성: ① 모듈 전역 메모리 ② `/tmp/catchpass-db.json` ③ Vercel KV (KV_REST_API_URL/TOKEN 환경변수 시)
- 시드 버전 bump 시 자동 재시드 (`SEED_VERSION` in `src/lib/db.ts`)

### 7.8 데모 시드 (`src/lib/seed-runner.ts`)
- 매장 20곳 (음식 10 + 미용·의료·펫·운동·웰니스 10)
- 방문형 캠페인 20건 + 기자단 캠페인 2건
- 데모 사장님: `demo@store.com` / `demo1234` (Standard 플랜)
- 데모 리뷰어 3명:
  - `demo@reviewer.com` / `demo1234` (B등급, 닉네임 "북촌리뷰어")
  - `demo-a@reviewer.com` / `demo1234` (A등급, "성수러버")
  - `demo-c@reviewer.com` / `demo1234` (C등급, "신규유저")
- 데모 패스: 6개 PassStatus 모두 + 기자단 3건 (다른 reviewer 분포 포함) → QA용

---

## 8. API 엔드포인트

| 메서드 | 경로 | 역할 |
|---|---|---|
| POST | `/api/auth/signup` | 가입 (role: reviewer|owner) |
| POST | `/api/auth/login` | 로그인 → 세션 쿠키 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/owner/me` | 사장님 정보 + 매장 목록 |
| POST | `/api/owner/plan` | 플랜 변경 |
| POST | `/api/campaigns` | 새 캠페인 (visit) 생성 — title 자동·totalQuota 자동 분배 |
| POST | `/api/passes` | 체험권 발급 (등급+quota 검증, 쿠키 stopgap) |
| POST | `/api/passes/lookup` | 코드/QR 기반 패스 조회 (사장님 스캔용) |
| POST | `/api/passes/use` | 사용 처리 (status active→used, paidAmount 기록) |
| POST | `/api/passes/review` | 리뷰 제출 (status used→review_submitted, 방문형 자가 점검 검증 / 기자단 본문/키워드 검증) |
| POST | `/api/passes/approve` | **410 Gone** — 사장님 직접 검수 폐기 |
| GET | `/api/map/reverse-geocode?lat&lng` | GPS → 동네명 (Naver Reverse Geocode API 프록시) |
| GET | `/api/map/static?...` | 정적 지도 이미지 프록시 |
| POST | `/api/admin/refresh-stores` | Naver Place 데이터 갱신 (서버 기동 후 1회) |

---

## 9. 외부 의존성·통합

| 통합 | 상태 | 비고 |
|---|---|---|
| Naver Maps SDK | ✅ 통합 | `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` |
| Naver Reverse Geocode API | ✅ 통합 | 현재 위치 라벨 |
| Naver Place 데이터 자동 갱신 | 부분 | 컨테이너 네트워크 정책에 막힐 수 있음(Vercel icn1 정상) |
| 카카오 채널톡 (ChannelIO) | UI 통합 | 위젯 스크립트 미배포 시 mailto 폴백 |
| Vercel KV (Upstash Redis REST) | 어댑터 준비 | 환경변수 미연결 시 메모리/디스크 폴백 |
| qrcode | ✅ 통합 | 패스 QR 렌더링 |
| html5-qrcode | ✅ 통합 | 사장님 QR 스캔 |
| bcryptjs | ✅ 통합 | 비밀번호 해싱 |
| OAuth (SNS) | ❌ 미구현 | URL+영향력 수치 직접 입력 |
| 결제 게이트웨이 | ❌ 미구현 | 멤버십·기자단 정산은 운영팀 수동 |
| Push 알림 | ❌ 미구현 | 인앱 알림함 단일 채널 |

---

## 10. 미해결 / 로드맵

| 항목 | 상태 | 비고 |
|---|---|---|
| 4지표 30일 자동 갱신 | 미구현 | 데이터 모델만 존재 |
| 노쇼 시 자동 점수 차감 | 미구현 | 운영팀 수동 |
| 가입 후 SNS 채널 추가/재인증 | 미구현 | 가입 시점에만 입력 |
| OAuth + URL 하이브리드 인증 | 미구현 | 영향력 수치 사용자 직접 입력 |
| Vercel KV 연결 | 어댑터 준비 | 환경변수 추가 시 즉시 동작 |
| OS 푸시 알림 + 인앱 배지 통합 | 인앱 알림함만 | 헤더 종 아이콘 미읽음 점 |
| 채널톡 위젯 실 통합 | UI 준비 | 위젯 스크립트 + 라이선스 설정 필요 |
| 결제 게이트웨이 | 미구현 | 멤버십 정기 결제·기자단 선결제 |
| 운영팀 백오피스 | 미구현 | 현재는 시드 데이터로 다양 상태 시연 |

---

## 11. 개발 로드맵

- **Phase 1 — MVP (배포 완료)**: 회원가입·로그인, 방문형 + 기자단 전체 플로우, 사장님 캠페인 생성·후기 모니터링·QR 스캔, 데모 시드, Apple 디자인 시스템 적용
- **Phase 2 — 데이터/정산**: Vercel KV 연결, 4지표 자동 갱신, 운영팀 백오피스, 결제 게이트웨이
- **Phase 3 — 외부 인증/알림**: SNS OAuth, OS 푸시 + 인앱 배지 통합, 채널톡 위젯 실 연결

---

## 12. 변경 이력

| 버전 | 일자 | 내용 |
|---|---|---|
| v1.0 | 2026-05-20 | HTML 프로토타입 역기획. 12 + 12 화면 인벤토리, 멤버십 C·B / C·B·A / C·B·A·S 정책 |
| v1.1 | 2026-05-20 | 미해결 10개 항목 확정 (24h, 60일 게시, N등급, 인기 뱃지 제거 등) |
| v2.0 | 2026-05-28 | **본 문서** — 배포(`reviewer-hgx1.vercel.app`) 기준 전면 재작성. 주요 변경: |
|  |  | ① BottomNav를 4탭 평면으로 (5탭 + 중앙 elevated 폐기) |
|  |  | ② 사장님 후기 조회 전용 + 채널톡 단일 채널 (직접 검수 폐기, /api/passes/approve 410) |
|  |  | ③ 캠페인 제목 자동(매장명) + 총 모집 인원 단일 입력 + 플랜별 자동 분배 |
|  |  | ④ 멤버십 등급 정책: Basic A·B·C 균등 / Standard A우선 / Premium S우선 (기존 CB / CBA / CBAS 폐기) |
|  |  | ⑤ 필수 메뉴 동적 +추가 UI |
|  |  | ⑥ Apple 디자인 시스템(Action Blue/parchment/SF Pro) 적용, 토큰 ink·brand·parchment 등 신규 |
|  |  | ⑦ 매장 다양화 — 20곳 + 17 카테고리 (음식 외 미용·의료·펫·운동·웰니스) + 카테고리별 SVG 커버 |
|  |  | ⑧ 데모 시드에 모든 PassStatus(6단계) + 기자단 3단계 케이스 포함 |
|  |  | ⑨ SNS 인증: URL + 영향력 수치 직접 입력 (OAuth는 로드맵) |
|  |  | ⑩ 자동 검수 폐기 — 자가 점검 4종 체크박스 모델 |
|  |  | ⑪ 8자 영문/숫자 단축 코드 (QR 보완) |
|  |  | ⑫ 길찾기 FAB (Naver Map nmap:// + 웹 fallback) |
