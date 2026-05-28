# CATCHPASS · 화면 흐름 (배포 버전 기준)

> PRD.md를 보완하는 화면 전환 다이어그램.
> 좌측 라벨 R-xx / O-xx는 추적성을 위한 화면 코드, 우측 괄호는 실제 Next.js 라우트입니다.

---

## 1. 체험자 (Reviewer) 전체 흐름

```
                  ┌─────────────────────────┐
                  │ /r/signup (R-00)       │
                  │ Step 0 시작 화면        │
                  │   →                     │
                  │ Step 1 이메일+닉네임    │
                  │   →                     │
                  │ Step 2 SNS URL+영향력  │
                  │   · 1개+ → N~A 산정    │
                  │   · 스킵   → N등급     │
                  └───────────┬─────────────┘
                              │ POST /api/auth/signup
                              │ 세션 쿠키
                              ▼
                ┌────────────────────────────┐
        ┌──────►│ /r/home (R-01)            │◄───────┐
        │       │ 리스트 ↔ 지도 FAB 토글    │        │
        │       │ ─ 방문형 / 기자단 탭      │        │
        │       │ ─ 카테고리 chip           │        │
        │       │ ─ 리스트/그리드 토글      │        │
        │       │ ─ 지역 검색 input         │        │
        │       └──┬───────────┬─────────────┘        │
        │          │           │                       │
        │  매장 카드 │      기자단 카드                 │
        │          ▼           ▼                       │
        │ ┌────────────────┐ ┌─────────────────┐      │
        │ │ /r/store/[id]  │ │ /r/press/[id]   │      │
        │ │ (R-03)         │ │ (R-08a 브리프)  │      │
        │ │ 길찾기 FAB     │ │ 자료팩 미리보기│      │
        │ │ Sticky 참여하기│ │ Sticky CTA      │      │
        │ └──────┬─────────┘ └─────────┬───────┘      │
        │        │                     │              │
        │        │ POST /api/passes    │ POST /api/passes
        │        │ (visit)             │ (press)      │
        │        ▼                     ▼              │
        │ ┌──────────────────────────────────┐        │
        │ │ /r/passes (R-04)                │        │
        │ │ [방문형 패스] / [기자단] 탭     │        │
        │ │ 상태별 카드 (active/used/...)   │        │
        │ └──┬───────────────────────┬──────┘        │
        │    │ 방문형 카드 탭        │ 기자단 active │
        │    ▼                       ▼              │
        │ ┌──────────────────────┐  ┌────────────────────┐
        │ │ /r/passes/[id]      │  │ /r/press/[id]/write │
        │ │ (R-04a / R-05)      │  │ ?pass=<id> (R-09)   │
        │ │ status 분기:        │  │ 자료팩 풀공개       │
        │ │  active = QR티켓    │  │ 채널 + 광고문구체크 │
        │ │  used = 리뷰폼      │  │ + URL 제출          │
        │ │  review_submitted   │  │ + 자가점검 3종      │
        │ │  completed/rejected │  │  (광고/키워드/자료팩)│
        │ │  expired            │  │ ※ 본문 입력 없음    │
        │ └──┬──────────────────┘  └──────┬──────────────┘
        │    │ POST /api/passes/review    │
        │    └────────────┬───────────────┘
        │                 ▼
        │           운영팀 검수 → completed / rejected
        │
        │  BottomNav (4탭)
        ├──── 홈 (home)         → /r/home
        ├──── 내 체험권 (ticket) → /r/passes
        ├──── 등급 (trophy)     → /r/grade
        └──── MY (user)         → /r/me
                                  ├ 알림함 (header 종)
                                  │   → /r/notifications
                                  └ 로그아웃
```

### 1.1 방문형 Pass 라이프사이클

```
참여하기 (POST /api/passes)
       │
       ▼
  ┌─────────┐  24h 미사용     ┌───────────┐
  │ active  │ ───────────────►│ expired   │
  │ (QR+코드)│                  └───────────┘
  └────┬────┘
       │ 사장님 스캔 + 결제액 입력
       │ POST /api/passes/use
       ▼
  ┌─────────┐
  │ used    │  72h 카운트다운 (리뷰 마감)
  │(리뷰폼) │
  └────┬────┘
       │ 자가 점검 4종 + 채널 + URL + 광고체크
       │ POST /api/passes/review
       ▼
  ┌──────────────────┐
  │ review_submitted │  운영팀 검수 (≤72h)
  └──┬───────────┬───┘
     │           │
     ▼           ▼
 ┌──────────┐ ┌──────────┐
 │ completed│ │ rejected │
 │ 등급 반영│ │ 채널톡  │
 └──────────┘ │ 안내    │
              └──────────┘
```

### 1.2 기자단 Pass 라이프사이클

```
참여 신청 (POST /api/passes)
       │
       ▼
  ┌──────────────┐
  │ active       │ — 자료 수령 (캠페인 기간 내 작성 가능)
  │ (작성 중)    │
  └──────┬───────┘
         │ /r/press/[id]/write
         │  본인 채널에 작성 후 URL만 제출
         │  POST /api/passes/review
         │  { reviewChannel, reviewUrl, pressSelfCheck:{ad,keywords,kit} }
         ▼
  ┌──────────────────┐
  │ review_submitted │ 운영팀 검수 (≤72h)
  └──┬────────────┬──┘
     │            │
     ▼            ▼
 ┌──────────┐ ┌──────────┐
 │ completed│ │ rejected │
 │ 정산 D+7│ │ 채널톡   │
 │ -3.3%원천│ └──────────┘
 └──────────┘
```

---

## 2. 사장님 (Owner) 전체 흐름

```
                  ┌─────────────────────────┐
                  │ /o/signup · /o/login   │
                  │ (O-00b)                 │
                  │ 이메일 + 비밀번호       │
                  └───────────┬─────────────┘
                              │ POST /api/auth/login
                              │ 세션 쿠키
                              ▼
                ┌──────────────────────────────┐
        ┌──────►│ /o/home (O-00)              │◄──────────┐
        │       │ · 최근 등록된 후기 카드     │           │
        │       │   "N건이 운영팀 검수 중"    │           │
        │       │ · 현재 플랜 스트립          │           │
        │       │ · 이번달 모집 현황          │           │
        │       │ · 진행중 캠페인 카드        │           │
        │       │ · [+ 새 캠페인]             │           │
        │       └──┬──────┬──────┬──────┬─────┘           │
        │          │      │      │      │                  │
        │          │      │      │      └─ [+ 새 캠페인]    │
        │          │      │      │                          │
        │          ▼      ▼      ▼                          │
        │     ┌──────┐ ┌──────┐ ┌──────────────────────┐  │
        │     │ 후기 │ │ 스캔 │ │ /o/campaign/new      │  │
        │     │/o/   │ │/o/   │ │ (O-10)               │  │
        │     │reviews│ │scan  │ │ 매장 선택→자동 제목 │  │
        │     │(O-01)│ │(O-02)│ │ 진행일수/지원금     │  │
        │     └──┬───┘ └──┬───┘ │ 총 모집 인원         │  │
        │        │        │     │ + 플랜 안내 카드     │  │
        │   채널톡│        │ 결과│ 채널 toggle          │  │
        │   문의 │        │ 카드│ 메뉴 +추가 동적 입력 │  │
        │        │        ▼     │ 설명                 │  │
        │        │   ┌────────┐ │ [캠페인 생성]        │  │
        │        │   │ O-02a  │ └────────┬─────────────┘  │
        │        │   │ 실 결제│          │ POST            │
        │        │   │ 금액   │          │ /api/campaigns  │
        │        │   │ 입력   │          │ (title=store.name,
        │        │   │ [사용  │          │  totalQuota →    │
        │        │   │  처리] │          │  distributeQuota)│
        │        │   └───┬────┘          ▼                 │
        │        │       │          ┌──────────┐           │
        │        │       │ /api/    │ 즉시 활성│           │
        │        │       │ passes/  │ 체험자   │           │
        │        │       │ use      │ /r/home에│           │
        │        │       └────────► │ 노출     │           │
        │        │                  └──────────┘           │
        │        │                                          │
        │        ▼                                          │
        │  /o/reviews (O-01) 후기 모니터링                  │
        │  · 운영팀 검수 중 / 통과 / 반려 뱃지              │
        │  · 본문 line-clamp-3 + URL                        │
        │  · 모든 카드에 [💬 채널톡으로 문의하기]           │
        │  · 광고 누락·재작성 요청은 채널톡 단일 경로       │
        │  · /api/passes/approve = 410 Gone                 │
        │
        │  BottomNav (4탭)
        ├──── 홈 (home)        → /o/home
        ├──── QR 스캔 (camera) → /o/scan
        ├──── 후기 (clipboard) → /o/reviews
        └──── MY (user)        → /o/me ─── 더보기 메뉴 허브
                                    ├─ 새 캠페인 → /o/campaign/new
                                    ├─ 멤버십    → /o/membership (O-14)
                                    ├─ 사용 로그 → /o/logs (O-11)
                                    ├─ 성과 리포트 → /o/report (O-03)
                                    ├─ 매장 정보 → /o/stores (O-12)
                                    └─ 알림함    → /o/notifications (O-04a)
```

### 2.1 캠페인 자동 분배 흐름

```
사장님 입력
   · 매장 선택       (캠페인 제목 = 매장명 자동)
   · 진행 일수
   · 지원금
   · 총 모집 인원 (T)
   · 채널 / 메뉴 / 설명
              │
              ▼
   distributeQuota(plan, T)  →  { S, A, B, C } quota
              │
              │  Premium  : S = ⌈T/2⌉, A·B·C = 균등 분배 나머지
              │  Standard : A = ⌈T/2⌉, B·C = 균등 분배 나머지, S=0
              │  Basic    : A·B·C = 균등 분배, S=0
              ▼
   Campaign 생성 (kind=visit, title=store.name)
              │
              ▼
   체험자 /r/home 리스트·지도 노출
   (gradeMeets(reviewer.grade, minNeededGrade) 통과한 사용자만 활성)
```

---

## 3. 의사결정 분기

### 3.1 체험자 매장 카드 탭

```
사용자 등급 ≥ 캠페인 최소 등급?
   │
   ├── Yes ──► /r/store/[id] 진입 + [참여하기] 활성
   │
   └── No  ──► 카드 어둡게 + 🔒 등급 부족 오버레이, 링크는 /r/grade로
```

### 3.2 사장님 캠페인 생성 시 등급 분배

```
사장님 plan 조회 → distributeQuota(plan, totalQuota)

Basic (₩13,900)    → A·B·C 균등 (랜덤 노출)
Standard (₩25,900) → A 우선 50% + B·C 나머지 균등
Premium (₩38,900)  → S 우선 50% + A·B·C 나머지 균등
```

### 3.3 후기 처리 분기 (사장님은 판정하지 않음)

```
체험자 리뷰 제출
   │
   ▼
status = review_submitted (운영팀 큐)
   │
   ├── 사장님 /o/reviews에서 조회만 가능
   │    · 뱃지: "운영팀 검수 중"
   │    · 카드 하단: [💬 채널톡으로 문의하기]
   │       · ChannelIO 위젯 호출 (있으면)
   │       · 폴백: 매장/패스 ID/URL이 포함된 mailto 모달
   │
   └── 운영팀 (백오피스) 처리
        ├── completed → 체험자 등급 점수 반영, 사장님 화면 "검수 통과"
        └── rejected  → 체험자 "사유는 채널톡 문의" 안내, 사장님 "운영팀 반려"

※ /api/passes/approve = 410 Gone (사장님 직접 검수 불가)
```

### 3.4 QR / 8자 코드 스캔 흐름

```
사장님 BottomNav [QR 스캔] → /o/scan
   │
   ├── [📷 카메라로 스캔하기]
   │      → Html5QrScanner 활성
   │      → QR 인식 → lookup(text)
   │
   └── 코드 직접 입력 (8자, A-HJ-NP-Z 2-9, 대소문자 무관)
          → [조회] → POST /api/passes/lookup
                              │
                              ▼
                  ┌──────────────────────┐
                  │ 결과 카드 (campaign  │
                  │ + reviewer + 상태)   │
                  └──────────┬───────────┘
                             │ status == "active"
                             ▼
                  실 결제 금액 입력
                             │
                             ▼
                  POST /api/passes/use
                  (paidAmount, supportApplied = min(paid, supportAmount))
                             │
                             ▼
                  /o/home 복귀 + 체험자 알림
```

### 3.5 체험자 패스 발급 후 화면 안전망

```
POST /api/passes → 응답 { passId }
       │
       │ (1) 라우터 push: /r/passes/{passId}
       │ (2) 멀티 인스턴스 안전망: cp_recent_passes_v1 쿠키에 패스 적재
       ▼
/r/passes/[id] 또는 /r/passes
       │
       ├── DB에서 찾음 ──► 정상 렌더
       │
       ├── DB에 없음 + 쿠키에 있음 ──► 쿠키 데이터로 렌더 (stopgap)
       │
       └── 둘 다 없음 ──► /r/passes?pending=<id>
                                │
                                ▼
                      PassPendingBanner 폴링 (8회, backoff 400~2400ms)
                              router.refresh() → 발견 시 상세로 이동
```

---

## 4. 데이터 동기화 포인트

| 이벤트 | 트리거 | 반대편 영향 |
|---|---|---|
| 캠페인 생성 | 사장님 `POST /api/campaigns` | 체험자 `/r/home`에 즉시 노출 (등급 매칭 필터) |
| 체험권 발급 | 체험자 `POST /api/passes` | 사장님 `/o/home` 잔여 -1, 알림함에 등록, 쿠키에도 적재 |
| 체험권 사용 | 사장님 `POST /api/passes/use` | 체험자 패스 상세가 active → used로 전이, 리뷰 폼 노출 |
| 리뷰 제출 | 체험자 `POST /api/passes/review` | 사장님 `/o/reviews`에 등장 (운영팀 검수 중 뱃지) + 사장님 알림 등록 |
| 운영팀 통과/반려 | 백오피스 (현재 시드/수동) | 체험자 패스 상태 completed/rejected + 등급 점수/품질 점수 갱신 |
| 24h 미사용 만료 | 페이지 진입 시 lazy 갱신 | 체험자 패스 카드 "만료" 라벨로 전환 (DB 영속화는 다음 mutate 시) |
| 플랜 변경 | 사장님 `POST /api/owner/plan` | 향후 새 캠페인 생성 시 distributeQuota 정책에 즉시 반영 (기존 캠페인 영향 없음) |
| GPS 위치 조회 | 체험자 `/r/home` 진입 (브라우저 권한) | `GET /api/map/reverse-geocode?lat&lng` → 동네 라벨 |

---

## 5. QA 골든패스 (배포 검증용)

### 체험자 (`demo@reviewer.com` / `demo1234`, B등급)

1. **로그인 → 홈**: `/r/login` → `/r/home` 진입, GPS 라벨/등급 카드/카테고리 chip 정상
2. **방문형 첫 사용**:
   `/r/home` → 매장 카드 → `/r/store/[id]` → [참여하기] → `/r/passes/[id]` (active, QR + 8자 코드 표시)
3. **사용 처리** (사장님 계정으로 스캔 후): `/r/passes/[id]` 가 used 전이 → 리뷰 폼 노출
4. **리뷰 제출**: 자가 점검 4종 + 채널 + URL + 광고 체크 → 제출 → review_submitted 안내
5. **시드 패스 6종 확인**: `/r/passes` 에서 active / used / review_submitted / completed / expired / rejected 카드별 분기 UI
6. **기자단**: `/r/home` 기자단 탭 → 카드 → `/r/press/[id]` 브리프 → [참여 신청] → `/r/passes` 기자단 탭에서 [작성 시작 →] → `/r/press/[id]/write` → 본문 minChars + 키워드 모두 포함 시 제출 활성
7. **지도 모드**: FAB 토글 → 핀 클러스터 → 매장 선택 시 토스트 + FAB 위로 양보
8. **등급 부족**: C등급 슬롯만 있는 캠페인을 다른 등급으로 시도(직접 발생하지 않음, S quota만 있는 캠페인 + C등급 reviewer 시뮬레이션)

### 사장님 (`demo@store.com` / `demo1234`, Standard 플랜)

1. **첫 진입**: `/o/login` → `/o/home`. 다크 "운영팀 검수 중" 카드 / 진행중 캠페인 22건 (시드)
2. **새 캠페인**:
   `/o/campaign/new` → 매장 선택 후 안내 문구 노출 → 총 모집 12 → 채널/메뉴(+추가)/설명 → [캠페인 생성]
   - 응답 `ok:true`
   - `/o/home`에서 새 카드의 S/A/B/C 분배가 0/6/3/3 (Standard 정책) 확인
3. **QR 스캔**:
   `/o/scan` → 8자 코드 직접 입력(시드 패스 코드) → [조회] → 결제액 입력 → [사용 처리] → `/o/home` 복귀
4. **후기 모니터링**:
   `/o/reviews` → 시드 후기들 (운영팀 검수 중 / 통과 / 반려 혼합) → [💬 채널톡으로 문의하기] → 모달/위젯 분기
5. **플랜 변경**:
   `/o/me` → 멤버십 → Premium 선택 → [Premium 플랜으로 변경] → 새 캠페인 생성 시 S 슬롯 활성 확인
6. **로그/리포트/매장**:
   `/o/me` → 사용 로그 / 성과 리포트 / 매장 정보 각각 200 정상 렌더

---

## 6. 화면 코드 ↔ Next.js 라우트 매핑

### 체험자
| 코드 | 화면명 | 라우트 |
|---|---|---|
| R-00 | 가입·온보딩 | `/r/signup` |
| R-00b | 로그인 | `/r/login` |
| R-01 | 홈 (리스트 + 지도 FAB 토글) | `/r/home` |
| R-03 | 매장 상세 (+ 길찾기 FAB) | `/r/store/[id]` |
| R-04 | 내 체험권 (방문형/기자단 탭) | `/r/passes` |
| R-04a / R-05 | 패스 상세 (status별 분기: QR/리뷰폼/안내) | `/r/passes/[id]` |
| R-06 | 내 등급 | `/r/grade` |
| R-07 | MY | `/r/me` |
| R-07a | 알림함 | `/r/notifications` |
| R-08a | 기자단 브리프 | `/r/press/[id]` |
| R-09 | 기자단 작성 | `/r/press/[id]/write?pass=<id>` |

### 사장님
| 코드 | 화면명 | 라우트 |
|---|---|---|
| O-00 | 홈 | `/o/home` |
| O-00b | 로그인·가입 | `/o/login` · `/o/signup` |
| O-01 | 후기 모니터링 (조회 + 채널톡) | `/o/reviews` |
| O-02 + O-02a | QR 스캔 + 결과 (단일 페이지) | `/o/scan` |
| O-03 | 성과 리포트 | `/o/report` |
| O-04 | 더보기 (메뉴 허브) | `/o/me` |
| O-04a | 알림함 | `/o/notifications` |
| O-10 | 새 캠페인 | `/o/campaign/new` |
| O-11 | 사용 로그 | `/o/logs` |
| O-12 | 매장 정보 | `/o/stores` |
| O-14 | 멤버십 / 구독 | `/o/membership` |

---

## 7. 프로토타입 대비 주요 흐름 변경 요약

| 항목 | 프로토타입(v1.1) | 배포(v2.0) |
|---|---|---|
| 체험자 BottomNav | 5탭 (홈/패스/등급/MY/+) | 4탭 (홈/체험권/등급/MY), 알림은 헤더 종 아이콘 |
| 사장님 BottomNav | 5탭 + 중앙 elevated [⎈ 스캔] | 4탭 평면 (홈/QR스캔/후기/MY), 리포트는 MY 허브 |
| 홈 지도 모드 | R-01(리스트)와 R-02(지도) 별도 화면 | 단일 `/r/home` + FAB 토글 |
| 매장 상세 길찾기 | sticky 좌측 작은 아이콘 | 우측 하단 FAB (Naver Map deep link + 800ms 폴백) |
| QR 화면 | 시뮬 스캔 버튼 포함 | 시뮬 없음. QR + 8자 단축 코드(사장님 직접 입력 지원) |
| 리뷰 검수 권한 | 사장님 통과/반려 가능 | 사장님 조회 전용. 채널톡 문의 단일 경로 (/api/passes/approve = 410) |
| 새 캠페인 폼 | Step 0~5 마법사 + 등급별 인원 4행 | 단일 폼, 제목 자동(매장명), 총 모집 1입력, 자동 분배, 메뉴 +추가 |
| 멤버십 등급 범위 | Basic C·B / Standard C·B·A / Premium C·B·A·S | Basic A·B·C 균등 / Standard A우선 / Premium S우선 |
| 광고 표시 / 자동 검수 | 자동 시스템 검수 + 사장님 확인 | 자가 점검 4종 체크박스 + 운영팀 표본 검수 |
| 기자단 제출 폼 | 자료팩 + 키워드 + 본문(N자) + URL + 광고 체크 (자동 검수) | 채널 + URL + 자가 점검 3종(광고/키워드/자료팩). **본문 입력 UI 제거** — 본인 채널 게시 후 URL만 제출 |
| 사장님 홈 캠페인 카드 등급 슬롯 | `S 0/2 · A 4/5 · B 5/10 · C 2/20` (used/quota 비율) + Premium에서만 S 활성 | 실제 모집된 인원수만 단일 숫자로 (`A 4 · B 5 · C 2`). Basic·Standard에서는 S 슬롯을 자물쇠 + `—`로 잠금 표시 + "S등급 모집은 Premium 플랜부터" 안내 |
| 사장님 홈 캠페인 카드 모집 현황 | "총 N/N" 단일 카운터 | 3구간 뱃지: "방문 예정 N명 / 방문 완료 N명 / 총 모집 인원 N명" (press는 작성 중/작성 완료 라벨). 분류: 방문 예정 = active, 방문 완료 = used+review_submitted+completed. N명만 볼드, 단일 parchment pill |
| 사장님 홈 진행 중 캠페인 섹션 | visit·press 카드를 한 리스트에 섞어 표시 | [체험단 N] / [기자단 N] 탭으로 분리 (`CampaignTabs` 클라이언트 컴포넌트). 빈 상태 카피도 탭별 분기 |
| 사장님 알림 카피 | "오늘 할 일 N건의 리뷰 검수 대기" | "최근 등록된 후기 N건이 운영팀 검수 중" |
| SNS 인증 | OAuth + URL 하이브리드 (기획) | URL + 영향력 수치 직접 입력 (OAuth는 로드맵) |
| 디자인 시스템 | 베이지(`paper`) + 검정(`ink`) | Apple 톤(Action Blue `#0066cc` + parchment `#f5f5f7` + SF Pro) |
