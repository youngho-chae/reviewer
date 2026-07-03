# CATCHPASS · PRD — VER.1 MVP (v3.0)

> 본 문서는 **구현 코드와 100% 일치**하는 제품 명세입니다. 개발자·디자이너가 이 문서만 보고
> 동일한 플랫폼을 재구축할 수 있도록 라우트·API·정책 수치·카피·시드 데이터를 코드 기준으로 기록합니다.
> 변경 이력은 §16에 기록하며, 화면 코드(R-xx/O-xx)는 프로토타입과의 추적성을 위해 유지합니다.
> **VER.1 출시 범위**: 결제(PG)는 별도 직접 연동 예정으로 본 문서 범위에서 제외 — 연동 지점만 §13(BM)에 명시.

---

## 0. 한 줄 소개

> **"선정 기다리는 체험단 말고, 등급으로 받는 체험권."**
> 리뷰어는 자기 등급에 맞는 체험권을 즉시 발급받고, 사장님은 멤버십으로 무제한 모집한다.

CATCHPASS는 모바일 우선 웹앱(Next.js 15 App Router)으로 구현된 체험 마케팅 모듈입니다.
체험자와 사장님은 같은 데이터(매장·캠페인·체험권)를 양쪽에서 보지만, 진입 경로(`/r/...` vs `/o/...`)와 권한은 분리되어 있습니다.

| 역할 | 진입 경로 | 인증 |
|---|---|---|
| 체험자 (리뷰어) | `/r/login` · `/r/signup` | 이메일+비밀번호 + SNS 채널 정보(URL+영향력 수치 입력) + **약관·개인정보 필수 동의** |
| 사장님 | `/o/login` · `/o/signup` | 이메일+비밀번호 + **약관·개인정보 필수 동의** |
| 운영팀 | `/admin/login` | 이메일+비밀번호 (검수 백오피스 전용) |

> ※ OAuth·외부 SNS API 연동·결제 게이트웨이(PG)는 VER.1 범위 외. SNS 영향력은 사용자가 직접 입력한 수치로 등급을 산정한다. PG는 직접 연동 예정(§13).

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
| 흐름 | 매장 방문 → QR 또는 캠페인 4자리 코드 제시 → 결제 할인 → 리뷰 작성 | 자료팩 수령 → 본인 채널에 작성 → URL 제출 |
| 사장님 비용 | 멤버십 정액 (월 구독) + **지원금(매장 즉시 할인) 직접 부담** | 종량제 선결제 (운영팀 처리) |
| 정산 | 없음 — 지원금은 매장이 결제 시 직접 할인 제공 (회사 별도 정산·환급 없음) | 검수 통과 후 체험자에게 송금 (3.3% 원천징수, D+7) |
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

산정: SNS 영향력(naver_blog 가중치 1.2, 인스타그램/틱톡 1.0) 기반, **채널별 독립 산정** (`src/lib/grade.ts`).
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
| R-01 | **홈 (큐레이팅 영역)** — v2.5부터 분리 | `/r/home` |
| R-02 | **탐색 (리스트 + 지도 통합)** — v2.5 신설 | `/r/explore` |
| R-03 | 매장 상세 | `/r/store/[id]` |
| R-04 | 내 체험권 | `/r/passes` (방문형/기자단 탭) |
| R-04a | 체험권 상세(QR 또는 상태 안내) | `/r/passes/[id]` |
| R-05 | 리뷰 인증 폼 | `/r/passes/[id]` (used 상태일 때 같은 페이지에 폼 노출) |
| R-06 | **등급 — 큰 배지 + 다음 등급 진행도 + 3-stat + 30일 성과 + 등급별 혜택 + 체험권 entry** — v2.9 등급 탭 신설 | `/r/grade` |
| R-06b | **혜택 — 박스 카드 + 라이브 카운터 + 내 보상 + 보낸 초대** (v2.9 viral 전용 정리) | `/r/rewards` |
| R-07 | MY | `/r/me` |
| R-07a | 알림함 | `/r/notifications` |
| R-08a | 기자단 브리프 | `/r/press/[id]` |
| R-09 | 기자단 작성 | `/r/press/[id]/write?pass=<id>` |
| R-08 | 기자단 보관소 (별도 화면 아님) | `/r/passes`의 기자단 탭 |
| R-10 | **친구에게 쏘기 (매트릭스 + 공유 시트)** — v2.8 신설 | `/r/invite/new` |
| R-11 | **피추천자 랜딩 (비회원 진입)** — v2.8 신설 | `/r/i/[token]` |
| W-01 | **환영 박스 (가입 직후 슬롯 박스 오픈)** — v2.8 신설, reviewer/owner 공용 | `/welcome/box?token=<token>` |
| L-01 | **이용약관** — v3.0 신설, 비로그인 접근 가능 | `/legal/terms` |
| L-02 | **개인정보처리방침** — v3.0 신설, 비로그인 접근 가능 | `/legal/privacy` |

> **가입 동의 (v3.0)**: `/r/signup` Step 1(계정)과 `/o/signup` 폼에 [필수] 이용약관 동의 + [필수] 개인정보 수집·이용 동의
> 체크박스 2종(각각 `/legal/*` 새 탭 링크). 클라이언트 가드 + 서버(`/api/auth/signup`)가 `agreeTerms` 미포함 시 400.
> 동의 시각은 `termsAgreedAt`으로 저장. MY 페이지 하단에도 약관 2종 링크 + **회원 탈퇴** 진입.

**BottomNav (5탭, v2.13 재구성)**: **홈 / 탐색 / 체험권 / 혜택 / MY**. (변경 이력: v1 5탭 → v2.5 4탭(홈/체험권/등급/MY) → v2.6 4탭(홈/탐색/혜택/MY) → v2.9 5탭(홈/탐색/등급/혜택/MY) → **v2.13 등급 탭을 MY 하위로 이동, 그 자리에 체험권(`/r/passes`) 탭**)
- 체험권 탭(`/r/passes`) = 내가 쓸 수 있는(active) + 신청/진행 중 체험단 리스트 (방문형/기자단). 아이콘 ticket.
- 혜택 탭(`/r/rewards`) 아이콘은 trophy로 변경(체험권과 아이콘 충돌 회피).
- 등급(`/r/grade`)은 BottomNav에서 제거되어 **MY(`/r/me`) 하위**에서 진입 (프로필 등급 칩 + "내 등급 / 등급별 혜택" 메뉴).
- `내 체험권(/r/passes)`: 홈·탐색·등급 탭의 헤더/엔트리 카드에서 진입 (라우트 유지, BottomNav에 직접 노출 안 함).
- 알림은 모든 페이지 상단 종 아이콘 진입.
- v2.9 분리 정책: **등급 탭**은 "내가 지금 받을 수 있는 정적 혜택(매장/지원금/등급별 권한)"을, **혜택 탭**은 "친구와 함께 키우는 동적 보상(박스/카운터/내 보상/보낸 초대)"을 책임진다.

### 3.2 사장님 (Owner) — `/o/...`

| 코드 | 화면명 | Next.js 라우트 |
|---|---|---|
| O-00 | 홈 | `/o/home` |
| O-00b | 로그인·가입 | `/o/login`, `/o/signup` |
| O-01 | 후기 모니터링 (조회 전용) | `/o/reviews` |
| O-02 | 사용 처리 (QR 스캔 + 4자리 코드 입력) | `/o/scan` |
| O-03 | 성과 리포트 | `/o/report` |
| O-04 | 더보기 (메뉴 허브) | `/o/me` |
| O-04a | 알림함 | `/o/notifications` |
| O-10 | 새 캠페인 | `/o/campaign/new` |
| O-11 | 체험권 사용 로그 | `/o/logs` |
| O-12 | 매장 정보 | `/o/stores` |
| O-14 | 멤버십 / 구독 관리 | `/o/membership` |

**BottomNav (4탭)**: 홈 / QR 스캔 / 후기 / MY. 리포트·멤버십·로그·매장정보 등은 더보기(MY) 메뉴 허브 진입.

> 변경점: 프로토타입의 5탭 + 중앙 elevated [⎈ 스캔] 디자인은 사용하지 않음. 4탭 평면 BottomNav로 통일.

### 3.3 운영팀 (Admin) — `/admin/...` (v2.15 신설)

| 코드 | 화면명 | Next.js 라우트 |
|---|---|---|
| AD-00b | 운영팀 로그인 | `/admin/login` |
| AD-01 | 후기 검수 콘솔 | `/admin/reviews` |

> `admin` 역할 전용. `/admin/(app)/layout.tsx`에서 세션 게이트(admin 아니면 `/admin/login` redirect). BottomNav 없음 — 데스크톱 백오피스 톤. 데모 계정 `admin@catchrank.co.kr / demo1234`.

---

## 4. 핵심 시나리오 (배포 기준)

### 시나리오 A — 체험자, 가입부터 첫 방문형 리뷰까지

```
[/r/signup] Step 0 — Apple 톤 헤드라인 "선정 기다리는 체험단 말고…"
    → [시작하기]
[/r/signup] Step 1 — 이메일/비밀번호/닉네임 + 필수 동의 2종 (이용약관 / 개인정보 수집·이용, /legal/* 링크)
    · 미동의 시 [다음] 진행 불가 (클라이언트) + /api/auth/signup 400 (서버)
    → [다음]
[/r/signup] Step 2 — SNS 채널 (3종: 블로그/인스타/틱톡) URL + 영향력 수치 직접 입력 → 채널별 등급 산정
    · 1개 이상 연동 시: 영향력 기반 N~A 자동 산정
    · [연동 없이 시작 (N등급)] 보조 액션 제공
    → 가입 완료, 세션 쿠키 설정 → /r/home 진입

[/r/home] 큐레이팅 홈 (R-01, v2.5 — 매장 발견 진입점)
    · 상단 frosted 헤더: CATCHPASS 로고 + 종(알림) 아이콘
    · Hero: "{현재 지역} 어디 가볼까?" (지역명 brand color 강조, font-display 32pt)
      - GPS 권한 있을 때 reverse-geocode 동 단위 (HomeLocationChip) — 실패 시 첫 매장 지역으로 fallback
      - 서브: "근처에 가볼 수 있는 곳 N곳이 있어요"
      - 우측 상단: 내 등급 배지 + [혜택 보기] 칩 → /r/rewards
    · 검색바: parchment rounded-pill (탭 → /r/explore) + 우측 [📍 지도] 칩 → /r/explore?mode=map
    · 동네 발견 배너: brand 그라디언트 카드 + 도시 이모지 일러스트 + [신상 장소 보기 ›] → /r/explore?sort=new
    · 3-카드 큐레이션 그리드 (purple/pink/green 파스텔 타일):
      - 신상 카페 ☕ — 방금 등록됐어요 / N개 → /r/explore?cat=카페&sort=new
      - 인기 맛집 🔥 — 평점 4.5 이상 / N개 → /r/explore?sort=topSupport
      - 체험 지원 중 💲 — 최대 ₩X,XXX / N개 → /r/explore?sort=topSupport
    · "걸어서 갈 수 있는 곳 👀" 가까운 곳 그리드 + [전부 보기 ›] → /r/explore
      - 정렬: accessible 우선 → walkMin 가까운 순
      - 2단 그리드 매장 카드 (최대 4개): 4:3 사진 + 좌상단 도보 N분 칩 + 매장명·카테고리·지역·"최대 ₩X 체험 지원"·평점
    · "한 번에 다 모았어요 👀" 전체 리스트 그리드 (v2.10) + [탐색에서 더 ›] → /r/explore?sort=topSupport
      - 정렬: accessible 우선 → supportAmount 큰 순 (가까운 곳과 정렬축 차별)
      - 2단 그리드 매장 카드 (전체): 4:3 사진 + 좌상단 카테고리 칩 + 매장명·지역·도보·"₩X" 굵게(bold tabular-nums)·평점
      - 등급 부족 카드: ink/55 오버레이 + "{등급}등급들만 / 몰래 가는 중 🤫"
    · 하단 등급 혜택 배너: "{내 등급}등급도 갈 수 있는 곳, 더 많아요" → /r/rewards
    · [홈은 발견 전용이며, 리스트/지도 토글과 카테고리 필터링은 모두 /r/explore에서 처리]

[/r/explore] 탐색 (R-02, v2.5 신설 — 리스트·지도 통합)
    · 상단 frosted 헤더 ("탐색" 타이틀 + 종 아이콘)
    · 헤더 카드: "오늘 참여 가능한 체험 N개" + 우측 [내 체험권 / 사용 가능 N개] → /r/passes
    · 검색바 (매장·메뉴·지역) + (선택) 필터 카드
    · 3-stat 카드 행: 곧 마감 체험 ⏰ N개 / 신규 체험 🆕 N개 / 평균 지원금 ₩X,XXX
    · 방문형 / 기자단 탭 토글 (parchment rounded-pill)
    · **카테고리 가로 스크롤 탭** (이미지 2 기준 6그룹):
      전체 / 카페 / 맛집(양식·한식·일식·분식·주점) / 뷰티(미용실·네일아트·피부과) / 문화(치과·한의원) / 액티비티(PT·필라테스·마사지·애견미용·동물병원)
    · 정렬 셀렉트(추천순/거리순/신규순/지원금 높은순/마감임박순) + 레이아웃 토글 [리스트/그리드]
    · **1단 축약 카드 (row, v2.5 신설)**: 좌 104px 정사각 썸네일 + 라벨 칩(NEW=success / 곧 마감=error / 이번 주만=orange) +
      매장명 / 카테고리·지역 / 도보 N분·등급 / 체험 지원 ₩X,XXX(success) — 우측: 잔여 N자리 / 마감일(빨강 시급)
    · 2단 그리드 카드 (기존 유지): 4:3 사진 + 라벨 칩 + 잔여 ≤3 pill + 매장명·카테고리·지역·체험지원·★평점
    · 등급 부족 매장: 카드 어둡게 + 자물쇠 + "등급 부족" 오버레이
    · 화면 중앙 하단 FAB: [📍 지도] / [☰ 리스트] 토글
    · 하단 등급 혜택 배너 → /r/rewards

[/r/explore?mode=map] 지도 모드 (FAB 또는 홈에서 직접 진입)
    · 풀스크린 Naver Map + 핀 마커(grade 배지색 테두리 흰 pill)
    · 상단 floating 검색 input + 카테고리 chip overlay + 일치 카운트 chip
    · 핀 탭 → 하단 토스트 카드 (썸네일 + 매장명 + 지역/카테고리 + 잔여/할인 + [상세 →])
    · 매장 선택 시 FAB가 토스트 상단으로 양보

[/r/rewards] 혜택 (R-06b, v2.5 신설 — 등급 + 등급별 혜택 + 체험권 entry)
    · 상단 frosted 헤더
    · 내 등급 ink 카드: 배지 + 등급 + 설명 + 3-stat(참여 가능 매장 / 최대 지원금 / 사용 가능 체험권) + [상세 →] /r/grade
    · 내 체험권 entry 카드 → /r/passes
    · 등급별 혜택 표 (S/A/B/C/N) — 각 등급의 모집 가능 범위 + 진입 조건
    · "등급 올리고 더 많은 체험 혜택 받으세요!" → /r/grade

[/r/store/[id]] 매장 상세
    · 4:3 풀-블리드 사진 hero
    · 매장명/카테고리/평점/주소
    · 다크 tile1 영역: 내가 받을 수 있는 지원금(연동 시) 또는 최대 지원금(S등급) 큰 숫자 + 잔여매·사용기한·영업시간
    · 이용 방법 3단계 (참여→QR→리뷰)
    · 필수 메뉴 (캠페인에 설정 시)
    · 매장 소개 + 강조 키워드 칩 (캠페인에 설정 시)
    · **참여 채널 선택 (StoreParticipate)** — 칩 버튼으로 채널 선택(블로그 우선→인스타→틱톡). 선택 채널의 내 등급으로 지원금 자동 계산 + 채널별 리뷰 작성 조건 노출
    · 우측 하단 FAB: 길찾기 (Naver Map 앱 deep link `nmap://route/walk?...` + 800ms 후 웹 fallback)
    · Sticky CTA: 최종 선택 채널 + 받을 금액 표시 + [참여하기] (채널 연동 + 등급 OK + 잔여 있을 때만)

→ [참여하기] POST /api/passes { campaignId, channel }
    · 선택 채널의 내 등급으로 자격 검증 + quota 차감, pass.reviewChannel·reviewerGrade(채널 등급) 확정
    · 결정론적 Pass 생성 (status="active", 24h TTL)
    · 사장님 알림 등록
    · 멀티 인스턴스 안전망: cp_recent_passes_v1 쿠키에 패스 정보 적재
    → 라우터 push: /r/passes/{passId}?just_issued

[/r/passes/[id]] active 상태 = 티켓 + QR
    · 다크 tile1 배경, frosted 상단 바
    · 흰 canvas 티켓 카드 + perforation 절단선
    · 상단 절반: 등급/매장명/지역·카테고리/할인 큰 숫자 + 카운트다운 (남은 시간 시·분)
      - 할인 큰 숫자 = 등급 배율 지원금 (+미사용 초대 부스트 보유 시 가산 금액 미리 표시: "🎁 초대 보상 +N% 부스트 포함")
      - 서브 카피: "매장에서 결제 시 즉시 할인해 드려요" (지원금 부담 주체 = 매장)
    · 점선 구분선
    · 하단 절반: 큰 QR 코드 + "결제 시 사장님께 보여주세요"
    · "사장님 사용 처리" 입력 폼 (v2.12) — 코드를 화면에 노출하지 않고, 사장님이
      캠페인 4자리 코드를 직접 입력하는 인풋 필드 + (선택) 결제 금액 + [사용 처리] 버튼.
      입력값이 캠페인 useCode와 일치하면 이 체험권을 즉시 used 처리 (QR은 pass 고유 코드 인코딩, 별도 경로)
    · 하단 "방문이 어려워요 — 참여 취소" 텍스트 버튼 (v3.0, CancelPassButton)
      - 확인 단계("참여를 취소할까요?") → POST /api/passes/cancel → status "cancelled" + 모집 슬롯 즉시 복구
      - 취소는 노쇼로 집계하지 않음 (만료 방치보다 취소를 유도하는 정책)

→ 경로 A) 체험자 화면에서 사장님 직접 입력 → POST /api/passes/use-by-code (체험자 세션)
    · { passId, code(4자리), paidAmount? } — code === campaign.useCode 검증
    · 일치 시 pass.status = "used", paidAmount/supportApplied 기록 (미입력 시 지원금 한도 적용)
→ 경로 B) 사장님 /o/scan에서 QR 스캔 또는 4자리 조회 → POST /api/passes/use (사장님 세션)
    · pass.status = "used"
    · paidAmount + supportApplied 기록
    · 체험자 알림 등록

[/r/passes/[id]] used 상태 = 리뷰 인증 폼 (R-05)
    · 사용 완료 안내 카드 (결제액·지원적용액·리뷰 마감 카운트다운 72h)
    · ReviewForm (4단계):
      1. 작성 채널 — 참여 시 확정된 채널 고정 표기 (재선택 불가)
      2. 광고 표시 문구 박스 (브랜드 컬러) + 채널별 표준 문구 + [📋 문구 복사] + 포함 확인 체크
      3. 리뷰 URL 입력
      4. 채널별 자가 점검 (CHANNEL_REVIEW_CONDITIONS — §6.4 표)
    · 모든 자가 점검 + URL + 광고 체크 시 [제출하고 인증 받기] 활성화

→ POST /api/passes/review { passId, reviewUrl, selfCheck, adNotice: true }
    · 서버 검증: usedAt+72h 기한 / adNotice 필수(누락 400) / 채널별 자가점검 전 항목
    → pass.status = "review_submitted", adNoticeConfirmed = true

[/r/passes/[id]] review_submitted 상태
    · "운영팀이 광고 표시·작성 조건을 검수합니다 (최대 72시간)"

→ 운영팀 처리 후 completed (등급 점수 반영) 또는 rejected

[/r/passes/[id]] rejected 상태 (v3.0 — 사유 노출 + 1회 재제출)
    · 반려 카드: "리뷰가 반려되었습니다" + 사유(pass.rejectReason 그대로 노출)
    · 재제출 가능 조건: resubmitCount < 1 이고 반려 시점(rejectedAt)+72h 이내
      - 충족 시: 안내 문구 + ReviewForm 재노출 → 제출 시 resubmitCount=1, 다시 review_submitted
      - 미충족 시: "재제출 기한이 지났거나 이미 재제출했습니다" + 고객센터 안내

[/r/passes/[id]] cancelled 상태 (v3.0)
    · "직접 취소한 체험권입니다. 같은 캠페인이 모집 중이면 다시 참여할 수 있어요."
```

### 시나리오 B — 체험자, 기자단 비방문 콘텐츠 작성

```
[/r/explore] 기자단 탭 (방문형/기자단 탭 토글에서 선택)
    · 1단 축약 카드: 좌 96px 썸네일 + 매장명/카테고리/지역 + 자료팩 N장 + 잔여/총 모집 + 정산 예정금 ₩
    · "3.3% 원천징수 후 입금" 안내
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
    · 필수 키워드 안내 (자가 점검 항목에서 포함 여부 체크)
    · 광고 표시 문구 박스 (브랜드 컬러) + [📋 문구 복사]
    · 작성 폼 (PressWriteForm) 4단계:
      1. 작성한 채널 선택
      2. 광고 표시 문구 포함 체크 (필수)
      3. 게시한 콘텐츠 URL 입력 — 본인 채널(블로그/인스타 등)에 작성 후 URL 그대로 붙여넣기
      4. 자가 점검: 필수 키워드 모두 포함 / 자료팩 활용 (체크박스)
    · 본문 입력 UI 없음 (본문은 본인 채널에 게시되므로 시스템 검증하지 않음, 운영팀 표본 검수)

→ POST /api/passes/review { reviewChannel, reviewUrl, pressSelfCheck } → review_submitted → 운영팀 검수 → completed (정산)
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
    · 진행 중 캠페인 — [체험단 N] / [기자단 N] 탭 분리 (CampaignTabs).
      각 탭에서 해당 kind 캠페인만 렌더링.
    · 카드 (공통 레이아웃):
      - 매장명/캠페인 제목/D-N
      - S/A/B/C 등급별 슬롯 — 실제 모집된 인원수만 단일 숫자로 표기
        (모든 플랜이 S~C 모집 가능 — v2.5부터 등급 자물쇠 제거)
      - 카드 하단 한 줄: "{Plan} 플랜: {priorityGrade}등급 우선 모집" 또는
        "{Plan} 플랜: 등급 랜덤 노출" (Basic·Free)
      - 모집 현황 뱃지 (rounded-pill, parchment 배경) — 3구간 카운터:
        · visit: "방문 예정 N명 / 방문 완료 N명 / 총 모집 인원 N명"
        · press: "작성 중 N명 / 작성 완료 N명 / 총 모집 인원 N명"
        · N명 부분만 볼드(text-ink), 라벨·슬래시는 muted
        · 분류: 방문 예정/작성 중 = pass.status === "active",
                방문 완료/작성 완료 = used + review_submitted + completed,
                총 모집 인원 = campaign 생성 시 totalQuota (S+A+B+C 합)
        · expired·rejected는 두 분류 모두에서 제외
    · [+ 새 캠페인]

[/o/campaign/new] 새 캠페인
    · 매장 선택 (드롭다운)
      "캠페인 제목은 매장명 「{매장명}」으로 자동 표기됩니다."
    · 진행 일수 / 지원금 (원)
    · 총 모집 인원 — 단일 입력
      안내 카드:
        - "{Plan} 플랜 · 등급 배분 자동" (priorityGrade 또는 랜덤 노출 안내)
        - 이번 달 모집 현황 라인 — "{used}팀 사용 / 월 한도 {limit|무제한}"
        - 잔여 모집 가능 인원 표시 + 입력값이 잔여를 초과하면 빨간 카피 + 제출 비활성
        - 무제한이 아닌 플랜은 "월 모집 한도를 늘리려면 멤버십 업그레이드" 링크
    · 필수 채널 pill 토글 (네이버 블로그/인스타/틱톡 3종)
    · 필수 주문 메뉴 — '+ 메뉴 추가' 버튼으로 동적 인풋 추가/삭제
      각 행: 메뉴명 인풋 + 가격(원) 인풋 (가격은 선택값)
    · 강조 키워드 — 쉼표 구분 입력 (최대 5개, 체험자 매장 상세에 노출)
    · 매장 소개 textarea (최대 500자, 글자 수 카운터)
    · [캠페인 생성]

→ POST /api/campaigns { storeId, days, supportAmount, totalQuota, requiredMenus[{name,price?}], requiredChannels[], highlightKeywords[], description }
    · title은 store.name으로 자동 설정 · requiredChannels는 허용 채널(블/인/틱)만 통과(1개 이상 필수) · description 500자 제한
    · distributeQuota(owner.plan, totalQuota)로 등급별 quota 자동 분배
    · 월간 모집 팀 수 초과 시 400 — PLAN_POLICY[plan].monthlyTeamLimit 검증
    · 즉시 활성 → 체험자 /r/home 리스트에 노출
```

### 시나리오 D — 사장님, 손님 체험권 사용 처리 (QR 또는 4자리)

```
[/o/scan]
    · [📷 카메라로 스캔하기] (Html5QrScanner) — QR은 pass 고유 코드 인코딩 → 특정 패스 직접 조회
    · 또는 체험권 화면의 4자리 숫자 직접 입력 → 캠페인 useCode로 조회
    → POST /api/passes/lookup { code }
        · code가 4자리 숫자면: 사장님 캠페인 중 useCode 일치 + 활성 체험권 (최근 발급분) 반환
        · code가 8자 영숫자면: 해당 pass 고유 코드로 직접 조회

[/o/scan] 결과 카드
    · 캠페인명 / 리뷰어 닉네임(등급) / 상태 / 지원금 한도
    · 실 결제 금액 입력 → 적용 지원금 자동 계산 (지원금 한도 vs 결제액의 min)
    · [사용 처리]
    → POST /api/passes/use { code: pass.code } → pass.status = "used", supportApplied 기록
    → /o/home 복귀 (router refresh)
```

### 시나리오 D-1 — 사장님, 캠페인 생성 시 4자리 코드 지정 (필수)

```
[/o/campaign/new]
    · 사용처리 코드(숫자 4자리) 필수 입력 — 동일 사장님의 진행 중 캠페인 간 중복 불가
    → POST /api/campaigns { useCode, ... }
        · /^\d{4}$/ 검증, 미입력/형식오류/중복 시 400
    · 생성된 코드는 체험권 화면(체험자)에 노출되어 사용 처리에 사용됨
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

### 시나리오 E-1 — 운영팀, 후기 검수 (v2.15 신설)

```
[/admin/login] admin 역할 로그인 (admin@catchrank.co.kr)
    → POST /api/auth/login { role: "admin" }
    → [/admin/reviews]

[/admin/reviews] 운영팀 검수 콘솔
    · 인증 게이트: admin 세션 아니면 /admin/login 으로 redirect
    · 상단 ink 통계 카드: 검수 대기 N건 + 최근 7일 처리 N건
    · review_submitted 후기 리스트 (오래된 것 우선):
      - 등급 배지 + 익명 #last4 + 방문형/기자단 + 매장명 + 캠페인 + 채널 + 제출시각
      - [게시물 열기 ↗] + 자가 점검 칩 4종
      - [검수 통과] → POST /api/admin/reviews/decide { decision: "approve" }
        · completed 처리 + reviewer.completedReviews++ + 체험자·사장님 알림
      - [반려] → 반려 사유 입력(placeholder: "체험자 화면에 그대로 표시되어 재작성 근거가 됩니다", 최대 500자)
        → [반려 확정] → decide { decision: "reject", reason }
        · rejected 처리 + rejectReason/rejectedAt 보존 + 체험자·사장님 알림
        · 체험자는 반려 후 72h 내 1회 재제출 가능 → 재제출되면 "후기 재제출"로 다시 검수 대기열에 등장 (v3.0)
    · 처리되면 목록에서 사라짐 (router.refresh)
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

### 시나리오 G — 바이럴(레퍼럴), 친구 초대부터 양면 보상까지 (v2.8 신설)

```
[/r/passes/[id]] used 상태 (T1 트리거)
    · "₩X 절약 완료! 친구도 받게 해줄래요?" 카드 노출
    · 사용한 매장의 storeId/campaignId가 query로 매핑
    → 탭 → /r/invite/new?store=<id>&campaign=<id>

[/r/rewards] 혜택 탭 진입 어디서든
    · 친구 초대 박스 카드 (박스 등급 basic/silver/gold + 진행도 바)
    · [🎁 친구에게 쏘기] CTA → /r/invite/new

[/r/invite/new] 친구에게 쏘기 (R-10)
    · 받는 사람 선물 미리보기 (매트릭스 RR/RO/OR/OO 자동 결정)
    · 초대 대상 토글: 친구 체험자 / 사장님 친구
    · 자동 생성 메시지 (닉네임 + 선물 카피 + url)
    · 4채널 그리드 [카톡 / 문자 / 인스타 DM / 링크 복사]
    · 채널 탭 → POST /api/referral/invite { targetKind, channel, storeId?, campaignId? }
      → Web Share API 또는 클립보드 복사
    · 토큰 발급 결과 카드: URL + [복사] 버튼

[딥링크 발사: /r/i/<token>] 피추천자 랜딩 (R-11)
    · (app) 그룹 바깥 — 비회원 진입 허용, BottomNav 없음
    · 만료/사용/유효 분기:
      - 유효: brand 그라디언트 hero (🎁) + "{발신자}님이 선물을 보냈어요" + 매트릭스별 미리보기
      - 만료: "14일 지나 만료" + [그래도 가입할래요]
      - 사용됨: "이미 받아간 박스예요"
    · 이미 로그인된 사용자 → /welcome/box로 자동 redirect
    · 비회원 → [박스 받고 가입하기 →] /r/signup?invite=<token>
    · [이미 계정이 있어요] → /r/login?invite=<token>

→ /r/signup or /o/signup (invite 파라미터 보존)
    · 가입 폼은 기존 그대로, 가입 성공 후 라우터 push:
      - invite 있으면 → /welcome/box?token=<token>
      - 없으면 → 기본 홈

[/welcome/box?token=<token>] 환영 박스 (W-01, reviewer/owner 공용)
    · 라우트 그룹 바깥 — BottomNav 없음 (전체 화면 박스 연출)
    · 미로그인이면 /r/i/<token>로 redirect
    · 진입 즉시 클라이언트가 POST /api/referral/accept { token, mode:"accept" }
    · 응답: { referrerReward, refereeReward } (v3.0 — 보너스 캐시 폐기, 단일 환영 보상)
    · 시퀀스(애니메이션):
      0.0~0.6s 박스 shake (🎁)
      0.6~1.8s 슬롯 머신 회전 (3 reel)
      1.8s~   결과 카드 flip-in + 컨페티 + CTA 2개
        · 결과 카드: "+50%" 또는 "50% 할인" + "체험권 사용 시/결제 시 자동 적용" 서브 카피
        · 하단 고지: "지원금 부스트는 기준 지원금(100%)을 넘지 않는 선에서 가산됩니다"
        [지금 사용하러 가기 →] (reviewer: /r/explore, owner: /o/home)
        [나도 친구에게 쏘기] (reviewer: /r/invite/new, owner: /o/me)

→ DB 부수 효과 (POST /api/referral/accept, v3.0 보상 규칙 = §6.10 표):
    · 발신자 inviteStats: accepted += 1, boxGrade 갱신 (computeBoxGrade)
    · 발신자에 행운 박스 보상 발행:
      - reviewer(RR/RO): support_bonus_pct — 박스 등급별 +10%/+20%/+30%
      - owner OO: membership_discount ₩10,000 (다음 결제)
      - owner OR: quota_bonus +3팀
    · 피추천자에 환영 보상 1건 발행: support_bonus_pct +50% (체험자) 또는 membership_discount 50% (사장님)
    · viralCounter.liveStream에 실제 이벤트 한 줄 unshift (닉네임 + rewardText)

[/r/passes/[id]] completed 상태 (T2 트리거)
    · "검수 통과! 행운 박스 더 키우러 갈까요?" 카드
    · "친구 3명 더 모으면 실버 박스 · 5명이면 골드 박스"
    → 탭 → /r/invite/new?store=...&campaign=...
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

### 5.5 B급 감성 카피 가이드 (v2.7 — 체험자 측)

> 컨셉 미팅 산출물(`docs/concept/2026-06-16-tone-of-voice.txt`) 반영. 레퍼런스: 오늘의집 초기 / 당근 초창기 / 여기어때.

#### 톤 정의
- **컨셉**: 발견 / 산책 / 새로운 장소 / 로컬
- **사용자 감정**: "오늘 어디 가볼까?"
- **UI는 깔끔, 톤은 유쾌·친근·발견의 재미·살짝 장난기** — UI 그래픽이 B급이라는 뜻이 아님
- **체험단 냄새 제거**: "신청", "선정", "리뷰 의무" 류 문구 회피
- **사용자 행동 흐름**: 새로운 곳 발견 → 체험 → 리뷰 → 혜택 (진지한 앱 X)

#### 카피 변환 표
| Before (딱딱한 UI) | After (B급 감성) |
|---|---|
| 안녕하세요 OOO님 | 오늘 뭐 먹어요? + "{지역} 어디 가볼까?" |
| 근처 방문 가능 매장 20곳 | 근처에 경험할 곳 20곳이 있어요 |
| 새로운 공간이 많이 생겼어요! | 이 집 아직 모르는 사람 많음 🤫 / 새로 생긴 곳, 우리가 먼저 가져왔어요 |
| 신상 카페 | 갓 오픈 카페 |
| 인기 맛집 (평점 4.5 이상) | 이미 다 안다 (평점 4.5+) |
| 체험 지원 중 (최대 ₩X) | 공짜로 줘요 (최대 ₩X) |
| 가까운 곳에 좋은 곳이 많아요 | 걸어서 갈 수 있는 곳 👀 / 동네 한 바퀴 돌 김에 한 번 들러볼래요? |
| 등급 혜택이 넓어졌어요 | {N}등급도 갈 수 있는 곳, 더 많아요 / 한 등급만 올려도 갈 수 있는 곳이 확 늘어남 |
| 오늘 참여 가능한 체험 N개 | 오늘 가볼 만한 곳 N곳 발견 |
| 곧 마감 체험 N개 | 지금 안 가면 ⏰ N곳 곧 마감 |
| 신규 체험 N개 | 방금 등록 신상 N곳 (7일 이내 오픈) |
| 평균 지원금 ₩X | 평균 받아요 ₩X 체험 지원 |
| 내 체험권 · 사용 가능 N개 | 내 체험권 · 쓸 수 있는 거 N장 |
| 정렬: 추천순/거리순/신규순/지원금 높은순/마감임박순 | 우리 추천 / 가까운 순 / 방금 등록 / 많이 받는 순 / 곧 마감 |
| 추천 체험단 자세히 보기 | A등급은 진짜 어디 가는지 궁금하지 않아요? |
| 검색 결과 0건 | "검색어" 검색 결과 0곳 — 다른 동네 찾아볼까요? |
| 현재 모집 중인 캠페인이 없어요 | 지금은 동네가 잠깐 쉬는 중 |

#### 상태별 카피 (탐색 카드)
| 상태 | 라벨 칩 | 보조 카피 |
|---|---|---|
| `now - createdAt < 7d` | **신상** (success) | 방금 등록 |
| `endAt - now < 1d` | **곧 마감** (error) | "지금 안 가면 남들 인스타에서 보게 됨" (카드 본문 한 줄, italic, error 색) |
| `endAt - now < 7d` | **이번 주만** (orange) | — |
| `!accessible` (등급 부족) | — | 오버레이: "{캠페인 등급}등급들만 / 몰래 가는 중 🤫" (RowCard는 한 줄로 축약, GridCard는 2줄) |

#### 시각 가이드
- **타이포 크기 대비 과하게**: 헤드라인 34~40pt, 서브 11~12pt — 중간 사이즈(20pt) 회피
- **라벨 칩 = 스티커 느낌**: `transform: rotate(-4deg)` + drop shadow, 색상은 success/error/orange 채도 높게
- **카드 자체 회전은 적용 안 함** (정돈된 UI 유지) — 회전은 라벨 칩에만
- **포인트 색 과감하게**: brand `#0066cc` 텍스트 + 곧 마감 카피의 error red + 신상 success green을 묻히지 않게 단독 사용

#### 사용 금지 카피
- "신청해주세요" / "선정 결과 안내" / "체험단원 모집 중" — 체험단 냄새 강함
- "환영합니다" / "감사합니다" — 거리감 있는 격식체
- "광고", "프로모션" — 어수선함 (광고 표시 문구는 §6.9 별도 규정)

---

## 6. 핵심 규칙·정책 (배포 기준)

### 6.1 등급 산정 (**v2.16 채널별 등급 개편**)
- 연동 가능한 채널은 **네이버 블로그 / 인스타그램 / 틱톡 3종**으로 한정 (유튜브 제거).
- **채널별 등급** — 연동된 각 채널을 독립적으로 평가 (`channelGradesFromSns`). 예: 블로그 A · 인스타 C.
  - 채널별 임계값(가중치 적용): A ≥ 50,000 / B ≥ 10,000 / C ≥ 1,000 / N < 1,000. naver_blog 가중치 1.2, 그 외 1.0.
  - `Reviewer.channelGrades: Partial<Record<SnsKind, Grade>>` 에 저장. 종합 등급 `Reviewer.grade` = 연동 채널 중 최상위(단일 등급 UI/뱃지용).
- **등급별 지원금 배율** (`SUPPORT_MULTIPLIER`, 등급 탭 혜택 사다리와 일치): S 100% · A 80% · B 60% · C 40% · N 10%. 100원 단위 반올림(`supportForGrade`).
  - 캠페인 `supportAmount`는 **기준치(=S등급 최대)**. 실제 지원금 = 기준치 × 참여 채널의 내 등급 배율.
  - 매장 리스트 노출 금액 = 신청 가능한 채널 중 **내가 받을 수 있는 가장 큰 혜택**(`channelOffers`/`bestEligibleSupport`).
- S 등급은 시스템 자동 산정 대상 아님 (운영팀 부여 영역; 데모 시드에서는 S 표기만 존재)
- 4지표(완료율·품질·광고표시·노쇼) 30일 갱신 정책은 **로드맵 — 미구현**. 현재 `completedReviews`·`qualityScore`·`noShowCount`는 reviewer 객체에 필드로만 보유

#### 6.1.1 N등급 진입
- 가입 시 SNS 1개 이상 입력 → 영향력 기반 N~A 자동 산정
- 가입 시 [연동 없이 시작] 선택 → N등급 부여 (`/r/grade` 페이지에 안내)
- 추후 MY → 채널 추가는 **로드맵** (현재는 가입 시점에만 입력)

### 6.2 멤버십 플랜 + 등급 모집 자동 분배 (**v2.5 정책 갱신**)

| 플랜 | 가격(월) | 모집 가능 등급 | 우선 등급 | 월간 모집 한도 |
|---|---|---|---|---|
| Free | ₩0 | S·A·B·C | — (랜덤) | 월 5팀 |
| Basic | ₩13,900 | S·A·B·C | — (랜덤) | 월 15팀 |
| Standard | ₩25,900 | S·A·B·C | A 우선 (½) | 월 50팀 |
| Premium | ₩38,900 | S·A·B·C | S 우선 (½) | 무제한 |

- **모든 플랜이 S~C 등급을 모집**할 수 있음 (기존 "Premium 전용 S 등급" 제한 제거 — v2.5)
- 플랜 차이는 ① 우선 등급(priorityGrade)과 ② **월간 모집 가능 팀 수**(monthlyTeamLimit)
- 사장님은 **총 모집 인원**만 입력 (등급별 인원 수동 설정 폐기)
- `distributeQuota(plan, total)` (`src/lib/plan-policy.ts`)이 정책에 따라 자동 분배
  - 예: Premium·총 12명 → S=6, A=2, B=2, C=2 (S 우선 절반)
  - 예: Standard·총 12명 → S=2, A=6, B=2, C=2 (A 우선 절반)
  - 예: Basic·총 12명 → S=3, A=3, B=3, C=3 (균등)
  - 예: Free·총 5명 → S=2, A=1, B=1, C=1 (균등, 잔여는 첫 등급부터)
- 월간 한도 검증: `POST /api/campaigns`에서 현재 캘린더 월(`currentMonthStart`) 이후
  생성된 캠페인의 quota 합 + 신규 totalQuota ≤ monthlyTeamLimit
- 멤버십 페이지: 4개 플랜 카드(Free/Basic/Standard/Premium) + 정책 요약(우선 등급 · 월 한도)
- 신규 사장님 가입 기본값: **Free 플랜** (기존 Standard 기본값 폐기)
- 플랜 변경: `POST /api/owner/plan`. 진행 중 캠페인의 quota 재분배는 적용하지 않음(생성 시점 정책 고정)

### 6.3 체험권 유효기간 & 사용 & 라이프사이클 (v3.0 전면 강화)
- **방문형 active**: 발급 시점부터 **24시간** (`expiresAt = issuedAt + 86_400_000`)
- **라이프사이클 스윕 (`src/lib/pass-lifecycle.ts`)** — DB 로드(`getDB`/`getDBAsync`) 시마다 실행되는 지연 배치.
  별도 크론 없이 아래 3개 정책을 멱등하게 강제하고, 변경 발생 시 즉시 영속화:
  1. **만료 확정 + 모집 슬롯 복구**: active + 기한 경과 → `expired` 전이, 발급 시 차감한 `consumedSlot`을
     `campaign.used[slot] -= 1`로 복구, 체험자 `noShowCount += 1`, **양측 알림** ("체험권 만료" / "체험권 만료 (미방문)")
  2. **리뷰 기한(72h) 초과**: used 상태로 `usedAt+72h` 경과 → `noShowCount += 1` + 양측 알림 (1회, `overdueHandled` 플래그)
  3. **만료 임박 리마인드**: 방문형 active 잔여 6시간 이내 → 체험자 알림 1회 ("방문이 어려우면 취소해 주세요", `expiringSoonNotified`)
- **참여 취소 (v3.0)**: 체험자가 active 상태에서 직접 취소 가능 — `POST /api/passes/cancel` → `cancelled` + 슬롯 복구 +
  사장님 알림. 취소는 노쇼로 집계하지 않는다. 취소/만료 후 같은 캠페인 재참여 가능(중복 가드는 active/used/review_submitted만 차단).
- 사용 처리(POST `/api/passes/use`): 사장님 입력 결제액 + 적용 지원금 기록, `usedAt` 설정
- **지원금 한도** = `supportForGrade(캠페인 기준 지원금, 참여 채널 등급)` (+미사용 초대 부스트 자동 가산 — §6.10).
  실제 차감액 = min(결제액, 한도). 지원금은 **매장이 직접 제공하는 할인**이며 회사가 별도 정산하지 않는다(§13).
- 사용 후 리뷰 마감: `usedAt + 72시간`. 카운트다운 표시(`Countdown` 컴포넌트, dhm 모드).
  기한 경과 시 서버가 제출 자체를 400으로 차단.
- **사용 처리 코드 2종**:
  - QR: pass 고유 코드(8자 영숫자, `A-H J-N P-Z 2-9`) 인코딩 — QR 스캔 시 특정 패스 무충돌 조회
  - **캠페인 4자리 사용처리 코드(`Campaign.useCode`)**: 사장님이 캠페인 생성 시 필수 지정.
    동일 사장님의 진행 중 캠페인 간 4자리 중복은 생성 단계에서 차단.
- **사용 처리 2경로** (v2.12 — 4자리 코드는 화면에 노출하지 않음):
  - 경로 A) 체험자 화면(`/r/passes/[id]`)의 입력 필드에 **사장님이 4자리를 직접 입력** →
    `POST /api/passes/use-by-code`(체험자 세션) → 해당 pass의 campaign.useCode와 일치 시 used.
    코드를 노출하지 않으므로 체험자 임의 사용 불가(사장님만 코드를 앎).
  - 경로 B) 사장님 디바이스 `/o/scan`에서 QR 스캔 또는 4자리 조회 → `POST /api/passes/use`(사장님 세션).

### 6.4 리뷰 작성 규칙 (방문형) — 채널별 자가 점검 모델 (v2.16 채널별 가변)
- 폼 입력: URL / 광고 표기 확인 / 채널별 자가 점검. 채널은 참여 시 확정(재선택 불가).
- **채널별 자가 점검 항목** (`CHANNEL_REVIEW_CONDITIONS`, `src/lib/channels.ts` — 모두 체크해야 제출 가능):

| 채널 | 항목 (key) |
|---|---|
| 네이버 블로그 | 사진 5장 이상(photos) / 본문 500자 이상(body500) / 메뉴·매장·분위기 사진 각 1장+(menus) / 30일 게시 유지(days30) |
| 인스타그램 | 피드 사진 3장 이상(photos3) / 캡션 100자 이상(caption100) / 해시태그+위치 태그(tags) / 30일 게시 유지(days30) |
| 틱톡 | 15초 이상 영상(video15) / 매장·메뉴 화면 등장(appear) / 캡션+태그 2개 이상(caption2) / 30일 게시 유지(days30) |

- **광고 표시 문구 (서버 강제, v3.0)**: 채널별 표준 문구 박스 + 복사 버튼 + "본 문구를 게시물에 포함했습니다" 체크.
  체크값(`adNotice`)은 **서버가 필수 검증**하고 `pass.adNoticeConfirmed`로 보존 (분쟁 근거).
- **자동 검수(시스템)는 미구현** — 사용자가 직접 자가 점검. 운영팀이 전수/표본 검수(§6.7).

### 6.5 리뷰 작성 규칙 (기자단) — 방문형과 동일한 URL+자가점검 모델
- 폼 입력: 채널 / URL / 자가 점검 (광고 표시 + 필수 키워드 포함 + 자료팩 활용)
- 체험자는 자료팩을 받아 **본인 채널(블로그/인스타/틱톡)에 직접 작성**하고, 게시 URL만 제출
- 본문 입력 UI 폐기 — 본문은 본인 채널에 게시되므로 시스템이 길이/키워드를 검증하지 않음
- 필수 키워드(`campaign.pressKeywords`)는 자가 점검 체크박스에서 포함 여부를 본인이 직접 확인
- 광고 표시 문구는 기자단 표준 문구 박스 제공 + 복사 버튼 (`PressWriteForm` 2단계).
  `pressSelfCheck.ad` 체크는 서버 필수 검증 → `adNoticeConfirmed` 보존 (v3.0)
- 제출/재제출 기한 = **캠페인 종료 시각(endAt)** — 경과 시 서버 400
- `campaign.pressMinChars` 필드는 데이터 모델·시드에만 존재(레거시), 제출 검증에는 사용하지 않음
- 정산은 운영팀이 표본 검수 후 처리 (D+7 송금, 3.3% 원천징수)

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
- **운영팀 검수 백오피스 (v2.15 신설)**: 별도 `admin` 역할 계정으로 `/admin/reviews` 콘솔에 로그인하여 `review_submitted` 후기를 일괄 검수. 통과 시 `completed`(reviewer.completedReviews 증가), 반려 시 `rejected`. 처리 결과는 `POST /api/admin/reviews/decide`로 수행되며 **체험자와 사장님 양측에 알림** 발행. 사장님 `/o/reviews` 화면의 상태 뱃지('운영팀 검수 중'/'검수 통과'/'운영팀 반려')는 이 처리 결과를 그대로 반영. admin 세션은 reviewer/owner 화면·보상 대상에서 제외됨.
- **반려 사유 보존 + 1회 재제출 (v3.0)**:
  - 반려 시 사유가 `pass.rejectReason`(최대 500자, 미입력 시 "작성 조건 미충족")·`rejectedAt`으로 구조화 저장되고,
    체험자 상세 화면과 알림에 **그대로 노출**된다 (콘솔 입력 placeholder에도 명시).
  - 체험자는 **반려 시점부터 72시간 이내 1회** 수정 후 재제출 가능 (기자단은 캠페인 종료 전 1회).
    재제출 시 `resubmitCount = 1` → 다시 `review_submitted`로 전이, 사장님에게 "후기 재제출" 알림.
  - 2회째 반려는 종착 — 이의는 고객센터(help@catchrank.co.kr) 경로만 제공.

### 6.8 매장 시그널
- 잔여 ≤ 3매 → "잔여 N매" 라벨 (카드 좌상단, 다크 pill)
- 등급 부족 → "🔒 등급 부족" 오버레이 (전체 어둡게)
- 인기 뱃지 미사용 (기획 §6.8 결정 유지)

### 6.9 광고 표시 문구 (채널별 표준)
| 채널 | 표준 문구 |
|---|---|
| 네이버 블로그 | 본 게시물은 캐치랭크를 통해 방문 혜택을 제공받아 작성한 후기입니다. |
| 인스타그램 | #광고 캐치랭크를 통해 방문 혜택을 제공받았습니다. |
| 틱톡 | #광고 #협찬 — 캐치랭크 방문 혜택 제공 |

### 6.10 바이럴(레퍼럴) 정책 (v2.8 신설)

> 트랙 설계서: `docs/viral-test/PRD-viral-referral.md`. 메인 통합 시 어댑터 인터페이스(`src/lib/referral.ts`) + DB(`DBShape.invites/rewards/viralCounter`) + API 3종(`/api/referral/invite,accept,counter`)으로 흡수.

> **v3.0 보상 경제 전면 개편 — "발행한 보상은 반드시 실사용 가능해야 한다"**
> 사용 경로가 없던 `cash`(보너스 캐시)와 `spotlight_pass`를 폐기하고, 모든 보상을 실제 소비 코드가
> 구현된 3종(`support_bonus_pct` / `membership_discount` / `quota_bonus`)으로 재설계.
> 라이브 카운터의 조작(noise) 수치도 제거 — 허위 표시(사회적 증거 조작) 리스크 해소.

#### 4종 매트릭스 (양면 보상)
| 매트릭스 | 발신 → 수신 | 추천자 행운 박스 | 피추천자 환영 박스 |
|---|---|---|---|
| RR | 체험자 → 체험자 | 지원금 부스트 (박스 등급별: basic +10% / silver +20% / gold +30%) | 첫 체험 지원금 +50% 부스트 |
| RO | 체험자 → 사장님 | 지원금 부스트 (동일 단계) | 첫 달 멤버십 50% 할인 |
| OR | 사장님 → 체험자 | quota_bonus +3팀 (이번 달 모집 한도) | 첫 체험 지원금 +50% 부스트 |
| OO | 사장님 → 사장님 | membership_discount ₩10,000 (다음 결제) | 첫 달 멤버십 50% 할인 |

#### 박스 등급 (발신자 누적 accepted 기반)
- `0~2명` → 일반 박스 (basic, +10%)
- `3~4명` → 실버 박스 (silver, +20%)
- `5명+` → 골드 박스 (gold, +30%)

#### 보상 실사용 경로 (v3.0 — 전부 구현됨)
| 보상 | 소비 시점 | 구현 |
|---|---|---|
| `support_bonus_pct` (+N% 부스트) | 체험권 **사용 처리** 시 자동 적용 | `/api/passes/use`·`use-by-code`가 `findSupportBoost`로 미사용·미만료 부스트 중 최대값 1개를 찾아 한도 가산. **한도 상한 = 캠페인 기준 지원금(S등급 100%)** — 매장이 설정한 예산을 초과하지 않음(`boostedLimit`, 100원 단위). 부스트가 실제 이득을 준 경우에만 `usedAt` 소진 + `pass.supportBoostPct`/`boostRewardId` 기록. active 티켓 화면에 가산 금액 미리 표시. |
| `quota_bonus` (+N팀) | 캠페인 **생성** 시 자동 적용 | `/api/campaigns`가 유효 보너스 합을 월간 한도에 가산(`availableQuotaBonus`), 플랜 한도 초과분만큼 만료 임박순으로 소진(`consumeQuotaBonus`). 에러 카피에 "보너스 +N팀" 표기. |
| `membership_discount` | 멤버십 **결제** 시 적용 | PG 연동 지점(§13) — 결제 단계에서 미사용 할인 소진. VER.1에서는 운영팀 수기 청구 시 반영. |

- 모든 보상은 `Reward` 레코드 + `expiresAt` (referrer_box 30일, referee_welcome 14일)
- 보상 라벨/이모지는 어댑터 `rewardLabel()/rewardEmoji()` 공용 헬퍼
- **재원 원칙(§13 BM 정합)**: 지원금 부스트는 매장 기준 지원금 한도 내 가산 → 매장 예산 초과 부담 없음.
  멤버십 할인·quota 보너스는 회사 마케팅 비용.

#### 토큰 정책
- 형식: 8자 base62 영숫자 (헷갈리는 `0/O/1/I/L` 제외)
- TTL: **14일**
- 1회용: `consumedBy` 기록 시 동일 토큰 재사용 차단
- 셀프 추천 차단: `referrerId === refereeId` 시 400
- 매트릭스 일관성: `inv.targetKind !== refereeKind` 시 400

#### 트리거 매핑
| 트리거 | 위치 | 카피 |
|---|---|---|
| T1 (visit 사용 직후) | `/r/passes/[id]` used 카드 하단 sticky | "₩X 절약 완료! 친구도 받게 해줄래요?" |
| T2 (검수 통과) | `/r/passes/[id]` completed 카드 하단 | "검수 통과! 행운 박스 더 키우러 갈까요?" |
| T4 (캠페인 생성 직후) | 사장님 사이드 — 로드맵 (현 버전 미구현) | — |

#### 라이브 카운터 (v3.0 — 실데이터 전환)
- `GET /api/referral/counter` = `snapshotCounter(db)` — **오늘 실제 발행된 Reward 수**(`issuedAt` 당일 집계)와
  실제 수락 이벤트 스트림(`liveStream`, 최대 6건: 닉네임 + rewardText + 매트릭스)만 반환. noise/조작 없음.
- /r/rewards 상단 `LiveCounter`는 **10초 주기 폴링**, liveStream이 비어 있으면 렌더하지 않음.
- 혜택 탭 헤드라인 분기: 오늘 박스 > 0 → "오늘 박스 N개가 열렸어요" / 0 → "오늘 첫 박스의 주인공, 아직 없음" (정직한 zero-state).

#### 어뷰징 가드 (현 버전)
- 셀프 추천 차단 / 토큰 1회 소비 / TTL 만료 차단 (위)
- 부정 취득 보상 회수·이용 제한은 약관 제12조에 근거 조항 확보
- 향후: IP/디바이스 단위 24h 3회 가입 제한

기자단은 캠페인별 자체 문구를 매장 상세/작성 페이지에 안내.

---

## 7. 데이터 모델 (`src/lib/types.ts`)

### 7.1 Reviewer
- id, email, passwordHash, nickname
- sns: { kind, url, influence }[]
- grade: "S" | "A" | "B" | "C" | "N" (종합 = 연동 채널 중 최상위)
- channelGrades?: Partial<Record<SnsKind, Grade>> — 채널별 독립 등급 (v2.16)
- completedReviews, qualityScore (0~100), noShowCount (만료·72h 미제출 시 스윕이 자동 +1 — v3.0)
- createdAt, termsAgreedAt? (약관·개인정보 동의 시각 — v3.0)
- inviteStats?: { sent, clicked, accepted, boxGrade } (v3.0에서 cumulativeCash 제거)

### 7.2 Owner
- id, email, passwordHash, storeName, category, area
- plan: "Free" | "Basic" | "Standard" | "Premium" (가입 기본값 "Free")
- createdAt, termsAgreedAt? (v3.0)
- inviteStats? (7.1과 동일 구조)

### 7.3 Store
- id, ownerId, name, category, area, coverEmoji
- rating, reviewCount, hours
- lat, lng, address, naverPlaceId (지도 deep link 용)

### 7.4 Campaign
- id, storeId, kind: "visit" | "press"
- title (visit은 매장명 자동, press는 사용자 입력 또는 시드)
- startAt, endAt, supportAmount
- quota: { S, A, B, C }, used: { S, A, B, C }
- requiredChannels: SnsKind[]
- requiredMenus: Array<{name: string, price?: number}> — v2.5부터 가격 선택 입력
- description, createdAt
- **useCode: string (숫자 4자리)** — v2.11. 사장님이 생성 시 필수 지정하는 사용처리 코드
- press 전용: pressKeywords[], pressMaterials[], pressMinChars (레거시 — 제출 검증에 미사용)

### 7.5 Pass (status 7단계 라이프사이클 — v3.0 cancelled 추가)
- id, code (8자 영숫자), reviewerId, campaignId, storeId, ownerId
- reviewerGrade, **consumedSlot?** ("S"|"A"|"B"|"C" — 발급 시 차감한 슬롯, 만료/취소 시 복구 대상. v3.0)
- issuedAt, expiresAt (24h), usedAt?, **cancelledAt?** (v3.0)
- paidAmount?, supportApplied?, **supportBoostPct?/boostRewardId?** (초대 부스트 적용 기록 — v3.0)
- reviewSubmittedAt?, reviewUrl?, reviewBody?, reviewChannel?, reviewStatus? ("pending"|"approved"|"rejected")
- reviewSelfCheck?: Record<string, boolean> — 채널별 가변 키 (§6.4 표의 key. v2.16)
- **adNoticeConfirmed?** — 광고 표기 확인 서버 보존 (v3.0)
- **rejectReason?/rejectedAt?/resubmitCount?** — 반려 사유·시각·재제출 횟수 (v3.0)
- **overdueHandled?/expiringSoonNotified?** — 라이프사이클 스윕 멱등 플래그 (v3.0)
- status: "active" | "used" | "review_submitted" | "completed" | "expired" | **"cancelled"** | "rejected"

### 7.6 NotificationItem
- id, userId, role ("reviewer"|"owner"), title, body, createdAt, read, link

### 7.7 DBShape (영속성)
- `reviewers/owners/admins/stores/campaigns/passes/notifications/invites/rewards/viralCounter/seeded/seedVersion/naverDataFetched`
- 3단 영속성: ① 모듈 전역 메모리 ② `/tmp/catchpass-db.json` ③ Vercel KV (KV_REST_API_URL/TOKEN 환경변수 시)
- 시드 버전 bump 시 자동 재시드 (`SEED_VERSION` in `src/lib/db.ts` — **현재 10**)
- DB 로드 시마다 라이프사이클 스윕(§6.3) 실행 — 변경 발생 시 KV/디스크 즉시 영속화

### 7.8 데모 시드 (`src/lib/seed-runner.ts`, SEED_VERSION 10)
- 매장 20곳 (음식 10 + 미용·의료·펫·운동·웰니스 10)
- 방문형 캠페인 20건 + 기자단 캠페인 2건
- 데모 사장님: `demo@store.com` / `demo1234` (Standard 플랜) · 운영팀: `admin@catchrank.co.kr` / `demo1234`
- 데모 리뷰어 3명 (채널별 등급 데모):
  - `demo@reviewer.com` / `demo1234` ("북촌리뷰어" — 블로그 A · 인스타 C → 종합 A)
  - `demo-a@reviewer.com` / `demo1234` ("성수러버" — 인스타 A)
  - `demo-c@reviewer.com` / `demo1234` ("신규유저" — 인스타 C)
- 데모 패스: 7개 PassStatus 커버 + 기자단 3건 (다른 reviewer 분포 포함) → QA용
  - 슬롯 소진 상태(active/used/review_submitted/completed/rejected)는 `consumedSlot` 기록 + `camp.used[slot]` 증가
  - rejected 패스에 `rejectReason`("광고 표시 문구 누락…") + `rejectedAt`(6일 전 — 재제출 기한 경과 케이스) 시드
  - 제출된 패스는 `adNoticeConfirmed: true`
- 데모 보상 3건 (전부 실사용 가능 종류): 북촌리뷰어 부스트 +10% 사용 완료 1건 + 미사용 1건, 성수러버 환영 부스트 +50% 미사용
- viralCounter: 실제 시드 이벤트(DEMO2024 수락) 1건만 liveStream에 기록 — 조작 수치 없음

---

## 8. API 엔드포인트

| 메서드 | 경로 | 역할 |
|---|---|---|
| POST | `/api/auth/signup` | 가입 (role: reviewer\|owner) — **`agreeTerms: true` 필수(400)**, `termsAgreedAt` 기록 (v3.0) |
| POST | `/api/auth/login` | 로그인 → 세션 쿠키 (reviewer\|owner\|admin) |
| POST | `/api/auth/logout` | 로그아웃 |
| DELETE | `/api/auth/account` | **회원 탈퇴 (v3.0)** — 계정·알림·미사용 보상 즉시 삭제, 거래 기록(패스)은 비식별 보존, 사장님은 진행 캠페인 모집 종료, 세션 파기 |
| GET | `/api/owner/me` | 사장님 정보 + 매장 목록 |
| POST | `/api/owner/plan` | 플랜 변경 (즉시 적용 — 요금은 PG 연동 전 운영팀 청구, §13) |
| POST | `/api/campaigns` | 새 캠페인 (visit) 생성 — title 자동·totalQuota 자동 분배·requiredChannels 3종 검증(중복 제거)·highlightKeywords(최대 5개·각 20자)·매장 소개 500자·**quota_bonus 보상 자동 가산/소진 (v3.0)** |
| POST | `/api/passes` | 체험권 발급 — `{campaignId, channel}`. 방문형은 선택 채널의 등급으로 자격·quota·reviewerGrade 확정 + **consumedSlot 기록 (v3.0)**, 기자단은 종합 등급 (채널은 작성 시 선택) |
| POST | `/api/passes/cancel` | **참여 취소 (v3.0)** — `{passId}`, 본인 active 한정 → cancelled + 슬롯 복구 + 사장님 알림 |
| POST | `/api/passes/lookup` | 코드/QR 기반 패스 조회 (사장님 스캔용) |
| POST | `/api/passes/use` | 사용 처리 — 사장님 세션 (active→used, paidAmount 기록, **지원금 부스트 자동 적용** v3.0) |
| POST | `/api/passes/use-by-code` | 사용 처리 — 체험자 화면에서 사장님이 4자리 직접 입력 (체험자 세션, code === campaign.useCode 검증, 부스트 동일 적용) |
| POST | `/api/passes/review` | 리뷰 제출/재제출 — `{passId, reviewUrl, selfCheck, adNotice}` (기자단은 `reviewChannel`+`pressSelfCheck`). **72h 기한·adNotice 서버 검증, rejected → 1회 재제출 허용 (v3.0)** |
| POST | `/api/passes/approve` | **410 Gone** — 사장님 직접 검수 폐기 |
| POST | `/api/admin/reviews/decide` | 운영팀 검수 처리 — admin 세션, `{passId, decision: approve\|reject, reason?}`. reject 시 **rejectReason(500자)·rejectedAt 보존** + 양측 알림 (v2.15/v3.0) |
| POST | `/api/referral/invite` | 초대 토큰 발급 (매트릭스·컨텍스트 포함) |
| POST | `/api/referral/accept` | mode "click"(비회원 열람 집계) / "accept"(가입자 토큰 소비 → 양면 보상 발행, 응답 `{referrerReward, refereeReward}`) |
| GET | `/api/referral/counter` | 라이브 카운터 — **실데이터만** (오늘 발행 보상 수 + liveStream, v3.0) |
| GET | `/api/map/reverse-geocode?lat&lng` | GPS → 동네명 (Naver Reverse Geocode API 프록시) |
| GET | `/api/map/static?...` | 정적 지도 이미지 프록시 |
| GET | `/api/admin/refresh-stores?token=` | Naver Place 데이터 갱신 — **production에서 ADMIN_REFRESH_TOKEN 미설정 시 503 차단 (v3.0)** |

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
| 결제 게이트웨이 (PG) | 🔜 직접 연동 예정 | 연동 지점 §13 — VER.1 범위 외 |
| Push 알림 | ❌ 미구현 | 인앱 알림함 단일 채널 (라이프사이클 알림 포함) |

---

## 10. 미해결 / 로드맵

| 항목 | 상태 | 비고 |
|---|---|---|
| 4지표 30일 자동 갱신 | 미구현 | noShowCount는 스윕 자동 반영(v3.0), 등급 재산정 반영은 로드맵 |
| 가입 후 SNS 채널 추가/재인증 | 미구현 | 가입 시점에만 입력 (MY에 고객센터 안내) |
| OAuth + URL 하이브리드 인증 | 미구현 | 영향력 수치 사용자 직접 입력 |
| Vercel KV 연결 | 어댑터 준비 | 환경변수 추가 시 즉시 동작 — **운영 배포 필수(§15 체크리스트)** |
| OS 푸시 알림 + 인앱 배지 통합 | 인앱 알림함만 | 헤더 종 아이콘 미읽음 점 |
| 채널톡 위젯 실 통합 | UI 준비 | 위젯 스크립트 + 라이선스 설정 필요 (mailto 폴백 동작) |
| 결제 게이트웨이 (PG) | 직접 연동 예정 | 멤버십 정기 결제·기자단 선결제·membership_discount 소진 (§13) |
| 매장 셀프 추가/편집·캠페인 수정 | 미구현 | 매장 추가는 운영팀 경유, 캠페인은 생성만 |
| T4 트리거 (사장님 캠페인 생성 직후 초대) | 미구현 | §6.10 |

---

## 11. 개발 로드맵

- **Phase 1 — VER.1 MVP (본 문서, 완료)**: 전 플로우 + 운영팀 검수 백오피스 + 법적 고지(약관·개인정보·탈퇴) +
  라이프사이클 자동화(만료 복구·취소·재제출·기한 강제) + 실사용 가능한 바이럴 보상. **결제(PG)만 연동하면 출시 가능.**
- **Phase 2 — 결제/정산**: PG 직접 연동(멤버십 구독·기자단 선결제·membership_discount 소진), 정산 자동화
- **Phase 3 — 확장**: SNS OAuth, 4지표 등급 자동 재산정, OS 푸시, 채널톡 실 연결, 매장 셀프 온보딩

---

## 12. 비즈니스 모델 (BM)

### 12.1 수익 구조
| 수익원 | 고객 | 가격 | 결제 방식 (VER.1) |
|---|---|---|---|
| **멤버십 구독** (주 수익) | 사장님 | Free ₩0 / Basic ₩13,900 / Standard ₩25,900 / Premium ₩38,900 (월) | PG 연동 전 운영팀 수기 청구 — 미납 시 Free 조정 가능(카피 명시) |
| **기자단 종량제** | 사장님 | 캠페인별 선결제 (정산 예정금 + 수수료) | 운영팀 처리 |

### 12.2 비용 부담 3자 구조 (분쟁 방지의 핵심)
```
사장님  ──(멤버십 구독료)──▶  회사
사장님  ──(지원금 = 매장 즉시 할인)──▶  체험자      ← 회사를 거치지 않음. 정산·환급 없음.
회사    ──(기자단 정산금, 3.3% 원천징수)──▶  체험자   ← 재원은 사장님 종량제 선결제
회사    ──(바이럴 보상: 멤버십 할인·quota 보너스)──▶  회원  ← 마케팅 비용
```
- 방문형 지원금은 **매장이 결제 시 직접 할인**하는 구조 — 사장님 폼·체험자 화면·약관(제11조)에 3중 명시.
- 지원금 부스트(+N%)는 캠페인 기준 지원금(=사장님이 설정한 최대 예산)을 상한으로 하므로 매장에 초과 부담이 없다.

### 12.3 PG 연동 지점 (직접 연동 예정 — 코드 상 훅 위치)
1. `POST /api/owner/plan` — 플랜 상향 시 결제 완료 후 plan 반영으로 전환 (현재는 즉시 반영 + 수기 청구)
2. 멤버십 결제 시 미사용 `membership_discount` Reward 소진
3. 기자단 캠페인 생성 시 선결제 게이트
4. `/o/membership` 결제 내역 카드 → 실 결제 이력 연동

---

## 13. 브랜드 아이덴티티 (BI)

- **회사(운영 주체): 캐치랭크(CatchRank)** — 고객센터 `help@catchrank.co.kr`, 운영팀 `admin@catchrank.co.kr`.
  광고 표시 문구(§6.9)와 법적 고지 주체는 항상 "캐치랭크".
- **제품(서비스명): 캐치패스(CATCHPASS)** — 캐치랭크가 운영하는 리뷰 체험 플랫폼. 앱 로고/헤더/온보딩에 사용.
- 관계: `캐치랭크(회사) ─운영─▶ 캐치패스(제품)`. 재구축 시 두 명칭을 혼용하지 말 것 —
  UI 브랜딩은 CATCHPASS, 대외 책임 주체(약관·광고 문구·이메일 도메인)는 캐치랭크.
- 브랜드 보이스: 제품 UI는 Apple 톤(§5.1) + 체험자 측 B급 감성 카피(§5.5). 법적 문서(/legal)는 표준 존댓말.
- 슬로건: "선정 기다리는 체험단 말고, 등급으로 받는 체험권."

---

## 14. 법적 고지·컴플라이언스 (v3.0 신설)

| 항목 | 구현 | 근거 법령 |
|---|---|---|
| 이용약관 | `/legal/terms` (15개 조문: 정의·등급·체험권 발급/취소/만료·리뷰 의무·금지 행위·멤버십·지원금 부담 주체·초대 보상·회사 지위·분쟁 해결) | 전자상거래법 |
| 개인정보처리방침 | `/legal/privacy` (수집 항목·목적·보유 기간·제3자 제공·위탁·파기·권리·보호책임자) | 개인정보보호법 |
| 가입 필수 동의 | 체험자/사장님 가입 폼 체크박스 2종 + 서버 검증 + `termsAgreedAt` 기록 | 개인정보보호법 §22 |
| 회원 탈퇴 | MY → 회원 탈퇴 (2단 확인) → `DELETE /api/auth/account`. 계정·알림·미사용 보상 즉시 파기, 거래 기록은 비식별 5년 보존 | 개인정보보호법 / 전자상거래법 |
| 경제적 대가 표시 | 채널별 표준 문구(§6.9) + 제출 시 서버 필수 검증·보존(`adNoticeConfirmed`) | 표시광고법 (공정위 추천·보증 심사지침) |
| 기자단 원천징수 | 3.3% 원천징수 후 D+7 송금 안내 | 소득세법 |
| 사회적 증거 진실성 | 라이브 카운터·보상 수치 전부 실데이터 (조작 noise 제거) | 표시광고법 (허위·과장 방지) |
| 평점 출처 표기 | 매장 상세 "★ N (네이버 리뷰 N건)" — 출처 귀속 명시 | — |

---

## 15. VER.1 출시 체크리스트 (운영/보안)

코드 외 운영 작업 — 배포 전 반드시 완료 (`.env.example` 참조):

1. **AUTH_SECRET** 설정 (32자+ 무작위) — 미설정 시 production 부팅 로그에 `[SECURITY]` 경고 출력됨
2. **Naver Map 키 재발급** — 저장소 이력에 기존 키가 노출되어 있으므로 폐기·재발급 후 `NAVER_MAP_CLIENT_ID/SECRET` env 설정, 소스 폴백 제거
3. **Vercel KV 연결** (`KV_REST_API_URL/TOKEN`) — 미연결 시 서버리스 환경에서 데이터 유실·인스턴스 간 불일치
4. **ADMIN_REFRESH_TOKEN** 설정 — 미설정 시 production에서 해당 엔드포인트 503 (안전측)
5. SEED_VERSION 정책 확인 — 운영 데이터 축적 시작 후에는 bump가 전체 초기화임을 인지 (운영 DB 전환 전까지 금지)
6. 채널톡 위젯 스크립트/라이선스 연결 (미연결 시 mailto 폴백으로 동작)
7. 운영팀 계정(`admin@catchrank.co.kr`) 비밀번호 변경
8. 법무 검토 — `/legal/terms`·`/legal/privacy` 최종 검수 (시행일 갱신)

---

## 16. 변경 이력

| 버전 | 일자 | 내용 |
|---|---|---|
| **v3.0** | 2026-07-03 | **VER.1 MVP — 출시 준비 개편** (브랜치 `mvp/ver1`). "결제(PG)만 붙이면 출시 가능한 수준"을 목표로 정책 맹점·법적 공백·바이럴 허구 요소를 전면 해소. ① **법적 고지**: `/legal/terms`(이용약관 15조)·`/legal/privacy`(개인정보처리방침) 신설, 가입 폼 필수 동의 2종 + 서버 검증(`agreeTerms` 400) + `termsAgreedAt` 기록, MY 약관 링크, **회원 탈퇴**(`DELETE /api/auth/account` — 계정·알림·미사용 보상 파기, 거래 기록 비식별 보존, 사장님 캠페인 모집 종료). ② **체험권 라이프사이클 자동화** (`src/lib/pass-lifecycle.ts`, DB 로드 시 스윕): 만료 확정 시 **모집 슬롯 복구**(`Pass.consumedSlot` 신설 — 유령 마감/슬롯 누수 해소) + noShowCount 자동 +1 + 양측 알림, 리뷰 72h 초과 처리(1회), 만료 6h 전 리마인드. ③ **참여 취소**: `POST /api/passes/cancel` + active 티켓 화면 취소 버튼 + `cancelled` 상태 신설(슬롯 복구, 노쇼 미집계, 재참여 허용). ④ **반려 개선**: `rejectReason`(500자)·`rejectedAt` 구조화 보존 + 체험자 화면 사유 노출 + **반려 후 72h 내 1회 재제출**(기자단은 캠페인 종료 전, `resubmitCount`), 검수 콘솔 사유 입력 강화. ⑤ **리뷰 기한·광고표기 서버 강제**: 72h 경과 제출 400, `adNotice` 필수 검증 + `adNoticeConfirmed` 보존. ⑥ **바이럴 보상 경제 재설계**: 실사용 불가하던 `cash`/`spotlight_pass` 폐기 — 보상 3종(`support_bonus_pct`/`membership_discount`/`quota_bonus`)으로 축소하고 **전부 소비 경로 구현** (부스트는 사용 처리 시 자동 가산·기준 지원금 상한·`boostRewardId` 소진 기록, quota 보너스는 캠페인 생성 한도 가산·자동 소진, 멤버십 할인은 PG 연동 지점). 추천자 박스 = 등급별 부스트(+10/20/30%), 피추천자 = +50% 부스트 또는 멤버십 50% 할인 단일화. `InviteStats.cumulativeCash` 제거. ⑦ **허위 표시 제거**: 라이브 카운터 noise(`counterWithNoise` 1,283명·평균 ₩4,250 조작) 폐기 → `snapshotCounter` 실데이터(오늘 발행 보상 수 + 실제 이벤트 스트림), zero-state 정직 카피, 폴링 1.8s→10s, 평점에 "네이버 리뷰" 출처 표기. ⑧ **부담 주체 명문화**: 지원금 = 매장 직접 할인(사장님 폼·체험자 카드·약관 3중 명시), 멤버십 수기 청구·미납 조정 카피, 환불·해지 안내(약관 §10 링크). ⑨ **보안 하드닝**: production AUTH_SECRET 미설정 경고, `admin/refresh-stores` production 토큰 미설정 시 503, `.env.example` 신설. ⑩ **PRD 정합화**: 유튜브 잔존 서술 제거(§1.3·§6.5), 채널별 자가점검 표 문서화(§6.4), Pass 모델 v3.0 필드 반영(§7.5), API 표에 referral 3종·cancel·account 추가(§8), **BM(§12)·BI(§13)·법적 컴플라이언스(§14)·출시 체크리스트(§15) 신설**. 캠페인 생성 폼의 4자리 코드 안내 카피 정정("체험자 화면에 노출되지 않음"). SEED_VERSION 10. |
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
| v2.1 | 2026-05-28 | 기자단 제출 폼 본문 입력 제거. 방문형과 동일하게 URL + 자가 점검(광고/키워드/자료팩 3종) 모델로 통일. `/api/passes/review`는 기자단도 `pressSelfCheck` 객체 + URL만 받음(`reviewBody`/`pressMinChars` 검증 제거). 기자단 브리프 "최소 본문 N자" → "제출 방식: 본인 채널에 작성 후 URL 제출"로 카피 변경. |
| v2.2 | 2026-05-28 | 사장님 홈 진행 중 캠페인 카드 표기 단순화. 등급별 슬롯이 "사용/정원"이 아니라 실제 모집된 인원수만 노출(quota 비율 제거). 현재 플랜에서 모집 불가한 등급(Basic·Standard의 S)은 자물쇠 + `—`로 잠금 표시 + 카드 하단에 Premium 안내 카피. |
| v2.3 | 2026-05-28 | 카드 하단 "모집 N명" 단일 카운터를 3구간 뱃지로 확장: "방문 예정 / 방문 완료 / 총 모집 인원" (visit) 또는 "작성 중 / 작성 완료 / 총 모집 인원" (press). 캠페인 kind에 따라 라벨 자동 분기, N명 부분만 볼드, parchment 배경 rounded-pill 단일 뱃지. expired·rejected는 카운트 제외. |
| v2.4 | 2026-05-28 | 사장님 홈 "진행 중 캠페인" 섹션을 [체험단 N] / [기자단 N] 탭으로 분리 (`CampaignTabs`). visit·press 카드가 한 리스트에 섞이지 않도록 정리. 빈 상태도 탭별 카피 분기 ("+ 첫 체험단 캠페인 만들기" / "진행 중인 기자단 캠페인이 없습니다"). |
| v2.5 | 2026-05-29 | 멤버십·메뉴 가격 개편. ① 필수 주문 메뉴에 메뉴명과 함께 가격(원, 선택값) 입력 UI 추가 — 캠페인 생성 폼/체험자 매장 상세에 함께 노출되어 혜택 크기 비교 지원. `Campaign.requiredMenus` 타입을 `string[]` → `Array<{name, price?}>`로 변경, 시드/리프레시 핸들러 마이그레이션, SEED_VERSION 3으로 bump. ② 플랜 정책 재설계: 멤버십 등급별 모집 인원 차이가 아닌 **월간 모집 팀 수**로 차별화 — Free 5팀 / Basic 15팀 / Standard 50팀 / Premium 무제한. 가입 기본값 Standard → Free. ③ "Premium 전용 S 등급" 제한 폐기 — 모든 플랜이 S~C 모집 가능, priority 등급만 플랜별로 분기 (Premium S우선 / Standard A우선 / Basic·Free 랜덤). 사장님 홈 카드에서 S 등급 자물쇠 표시 제거. 캠페인 생성 폼에 이번 달 사용량/잔여 모집 가능 인원 카드 추가, 한도 초과 시 제출 비활성. |
| v2.6 | 2026-06-16 | 체험자 IA 재구성 — 컨셉 미팅 산출물(첨부 이미지 2종) 반영. ① **`/r/home`을 큐레이팅 영역 전용으로 분리**: 지역 헤드라인("{동} 어디 가볼까?", GPS reverse-geocode), 검색 entry, 동네 발견 배너, 3-카드 큐레이션(신상 카페/인기 맛집/체험 지원 중), "가까운 곳" 2단 그리드(최대 4개), 등급 혜택 배너. ② **`/r/explore` 라우트 신설** — 기존 `/r/home`의 리스트/지도 토글 + 카테고리 chip + 정렬/레이아웃 토글을 모두 이전. 카테고리는 6그룹(전체/카페/맛집/뷰티/문화/액티비티)으로 통합. ③ **1단 축약 카드(RowCard)** 신설 — 좌 104px 정사각 썸네일 + 라벨 칩(NEW/곧 마감/이번 주만) + 매장명·카테고리·지역·도보·등급·체험지원, 우측 상단 잔여 자리 + 마감일(시급 빨강). 2단 그리드(GridCard)는 유지하고 토글로 전환. ④ **`/r/rewards` 라우트 신설** (R-06b) — 내 등급 ink 카드 + 3-stat + 체험권 entry + 등급별 혜택 표(S~N). ⑤ **BottomNav 4탭 재구성** — 홈/내 체험권/등급/MY → **홈/탐색/혜택/MY**. 내 체험권(/r/passes)은 홈·탐색·혜택 헤더 카드에서 entry, 등급(/r/grade)은 혜택 탭에서 entry. ⑥ 탐색 헤더에 3-stat(곧 마감/신규/평균 지원금) 카드, 정렬 셀렉트(추천/거리/신규/지원금/마감) 추가. |
| v2.7 | 2026-06-16 | **B급 감성 카피·톤 적용** — 컨셉 미팅 텍스트 산출물(`docs/concept/2026-06-16-tone-of-voice.txt`) 반영. 레퍼런스: 오늘의집 초기 / 당근 초창기 / 여기어때. 정책: UI는 깔끔 유지, 카피만 유쾌·친근·발견의 재미·살짝 장난기. ① 홈 헤드라인 "오늘 뭐 먹어요? + {지역} 어디 가볼까?" + 서브 "근처에 경험할 곳 N곳이 있어요". ② 동네 발견 배너를 "오늘의 동네 발견 / 이 집 아직 모르는 사람 많음 🤫 / 새로 생긴 곳, 우리가 먼저 가져왔어요". ③ 3-카드 큐레이션: 갓 오픈 카페 / 이미 다 안다 / 공짜로 줘요. ④ 가까운 곳 섹션: "걸어서 갈 수 있는 곳 👀 / 동네 한 바퀴 돌 김에 한 번 들러볼래요?". ⑤ 탐색 헤더 "오늘 가볼 만한 곳 N곳 발견", 3-stat 카피("지금 안 가면 / 방금 등록 / 평균 받아요"). ⑥ **상태별 카피**: 라벨 칩 "신상(success)" / "곧 마감(error)" / "이번 주만(orange)" + 곧 마감 카드 본문에 "지금 안 가면 남들 인스타에서 보게 됨" italic 한 줄. **등급 부족 오버레이**: "{필요 등급}등급들만 / 몰래 가는 중 🤫" (RowCard 축약, GridCard 2줄). ⑦ 라벨 칩 스티커 느낌(`rotate(-4deg)` + drop shadow), 카드 매장명 16pt bold tracking 강조, 도보 N분 chip을 그리드 카드 우상단에 노출. ⑧ 정렬·필터 카피도 "우리 추천 / 가까운 순 / 방금 등록 / 많이 받는 순 / 곧 마감"으로 변환. ⑨ 빈 상태 "지금은 동네가 잠깐 쉬는 중", 검색 무결과 "다른 동네 찾아볼까요?". ⑩ PRD §5.5 B급 감성 카피 가이드 절 신설 (카피 변환 표 + 상태별 카피 + 시각 가이드 + 사용 금지 카피). |
| v2.9 | 2026-06-25 | **등급/혜택 책임 분리** — v2.8 통합 후 혜택 탭이 등급 정보(정적)와 viral(동적)을 모두 떠안아 정보 밀도가 과해진 문제를 정리. ① **`/r/grade`를 등급 탭 메인으로 재구성** — 기존(큰 등급 배지 + 다음 등급 진행도 + 30일 성과 + 등급별 혜택 사다리)에 혜택 탭에서 옮겨온 콘텐츠 추가: ink 3-stat 카드(참여 가능 매장 / 최대 지원금 / 사용 가능 체험권), 내 체험권 entry → /r/passes, 등급별 혜택 사다리에 진입 조건(TIER_REQUIRE) 통합. ② **`/r/rewards`를 viral 전용으로 정리** — 등급 ink 카드/등급별 혜택 표 모두 제거, 새 헤더 "오늘은 N명이 받았어요"(B급 톤), 박스 카드 + 라이브 카운터 + 내 보상(전체 목록) + 보낸 초대 현황(매트릭스/토큰/상태 칩) + 등급 탭 entry 카드("등급 혜택은 따로 모아뒀어요"). ③ **BottomNav 5탭 재구성** — v2.6 4탭(홈/탐색/혜택/MY) → **홈/탐색/등급/혜택/MY**. 등급(trophy)과 혜택(ticket)을 각각 독립 탭으로. ④ 분리 정책 명문화: 등급 탭은 "지금 받을 수 있는 정적 혜택", 혜택 탭은 "친구와 함께 키우는 동적 보상". ⑤ PRD §3.1 R-06 등급 탭 정의 갱신, BottomNav 정책 명시. |
| v2.8 | 2026-06-25 | **바이럴(레퍼럴) 메인 흡수** — `feature/viral-referral-test` 트랙의 viral 모듈을 메인 트리(`claude/create-planning-prd-wdoZK`)에 통합. ① **데이터 모델**: `Reviewer.inviteStats`·`Owner.inviteStats` + DBShape에 `invites`/`rewards`/`viralCounter` 추가. `Invite`·`Reward`·`ViralCounter`·`InviteStats`·`MatrixKey`·`BoxGrade` 타입 신설. SEED_VERSION 5 bump. ② **어댑터 라이브러리** `src/lib/referral.ts` — `matrixOf`·`computeBoxGrade`·`createInvite`·`markInviteClicked`·`acceptInvite`(양면 보상 발행)·`counterWithNoise`·`rewardLabel`/`rewardEmoji`·`refereePreview`. ③ **API 3개**: `POST /api/referral/invite` (토큰 발급), `POST /api/referral/accept` (mode: click/accept), `GET /api/referral/counter` (라이브 N + ticker). ④ **혜택 탭(`/r/rewards`) 통합**: 상단 `LiveCounter` 클라이언트 (1.8s 폴링) + `ReferralBoxCard` (박스 등급 + 진행도 + CTA) + 내 보상 목록(rewardLabel/Emoji) + 기존 등급 카드. ⑤ **신규 라우트 3개**: `/r/invite/new` R-10 (매트릭스 자동 결정 + 4채널 공유 시트 + Web Share API 폴백), `/r/i/[token]` R-11 (비회원 진입 허용 — (app) 그룹 바깥, 만료/사용/유효 분기, 로그인 시 자동 redirect), `/welcome/box` W-01 (reviewer/owner 공용, 가입 직후 슬롯 머신 0.6→1.8→2.2s + 컨페티 + 양면 보상 결과 카드). ⑥ **가입 폼 통합**: `/r/signup`·`/o/signup`에서 `?invite=<token>` 보존 → 가입 완료 시 `/welcome/box?token=...`으로 push (Suspense 경계 추가). ⑦ **T1 트리거**: `/r/passes/[id]` used 카드 하단에 "₩X 절약! 친구도 받게 해줄래요?" sticky 카드 + completed 카드 하단에 T2 "검수 통과! 박스 더 키우러" 카드. ⑧ **시드** (`seed-runner.ts`): demo reviewer에 inviteStats 초기화(sent3/clicked3/accepted2/basic/₩4k), 데모 invite 3건(signed_up/clicked/issued + RR/RR/RO 매트릭스), reward 2개, viralCounter 1,283명·평균 ₩4,250·ticker 4건. ⑨ **PRD/Flow**: §3.1에 R-10/R-11/W-01 라우트 추가, §4 시나리오 G(레퍼럴 흐름) 신설, §6.10 바이럴 정책 절 신설 (매트릭스 4종 표 / 박스 등급 / 토큰 정책 / 보상 정책 / 트리거 매핑 / 라이브 카운터 / 어뷰징 가드). ⑩ end-to-end QA — 토큰 발급 → 신규 가입 → accept → 양면 보상 발행 → 발신자 카드 갱신 정상. |
| v2.10 | 2026-06-25 | **홈 큐레이션 2섹션 구조 (가까운 곳 + 전체 리스트)** — 기존 "걸어서 갈 수 있는 곳"(도보 정렬 4개)에 더해 하단에 "한 번에 다 모았어요 👀" 전체 리스트 큐레이션 추가. ① 정렬축 차별 — 가까운 곳은 `accessible desc → walkMin asc`, 전체 리스트는 `accessible desc → supportAmount desc` (혜택 큰 순). ② 카드 칩 차별 — 가까운 곳 좌상단은 "도보 N분", 전체 리스트 좌상단은 카테고리 라벨. ③ 카드 내부 시각 차별 — 전체 리스트는 ₩금액을 `font-bold tabular-nums 14pt`로 강조해서 혜택 큰 순 정렬을 시각적으로 뒷받침. ④ 등급 부족 카드 — `ink/55` 오버레이 + "{등급}등급들만 / 몰래 가는 중 🤫" (탐색 GridCard와 동일 카피). ⑤ 헤더 카피 — "한 번에 다 모았어요 👀 / 오늘 참여 가능한 전체 N곳 · 혜택 큰 순" + [탐색에서 더 ›] → /r/explore?sort=topSupport. ⑥ NearbyCard 인터페이스에 grade 필드 추가 (등급 부족 오버레이용). ⑦ PRD §4 시나리오 A 홈 블록 갱신 (2섹션 표기). |
| v2.11 | 2026-06-28 | **체험권 사용 처리 코드 4자리 개편** — 사장님 수기 입력 코드를 8자 영숫자 → **캠페인별 4자리 숫자**(`Campaign.useCode`)로 변경. ① 캠페인 생성 시 4자리 숫자 **필수 입력**(`/o/campaign/new` 입력 필드 + 제출 비활성 가드), `/api/campaigns`에서 `/^\d{4}$/` 검증 + 동일 사장님 진행 중 캠페인 간 중복 차단. ② 체험자 체험권 화면(`/r/passes/[id]`)에 캠페인 4자리 코드 대형 노출(QR은 기존 pass 고유 8자 코드 인코딩 유지). ③ 사장님 `/o/scan` 수기 입력을 4자리 숫자 인풋으로 변경. ④ `/api/passes/lookup`이 입력 길이로 분기 — 4자리면 useCode로 사장님 캠페인의 활성 체험권(최근 발급분) 조회, 8자면 pass 고유 코드 조회. 사용 처리(`/api/passes/use`)는 조회된 pass 고유 코드로 수행(무충돌). ⑤ 사용 흐름 = QR 스캔 **또는** 유저 화면 4자리 입력 → 사용 완료. ⑥ 시드 캠페인에 결정론적 4자리 부여(`detUseCode`), SEED_VERSION 6. ⑦ `ids.ts`에 `isUseCode`/`normalizeUseCode` 추가. PRD §6.3 사용 코드 2종 / §7.4 Campaign.useCode / 시나리오 D·D-1 갱신. |
| v2.12 | 2026-06-28 | **체험권 화면 4자리 코드 표시 → 입력 필드로 전환** — 체험자 체험권 화면(`/r/passes/[id]`)에서 캠페인 4자리 코드를 **노출하지 않고**, 사장님이 직접 입력하는 인풋 필드(`OwnerUseForm` 클라이언트 컴포넌트)로 변경. ① 4자리 입력 + (선택)결제금액 + [사용 처리] 버튼. ② 신규 엔드포인트 `POST /api/passes/use-by-code`(체험자 세션) — passId 본인 소유 + active + `code === campaign.useCode` 검증 후 used 처리(결제금액 미입력 시 지원금 한도 적용). ③ 코드를 화면에 노출하지 않으므로 체험자 임의 사용 불가(사장님만 코드 인지). ④ 사장님 디바이스 `/o/scan`(QR/4자리 조회 → `/api/passes/use`) 경로는 그대로 유지 — 사용 처리 2경로 공존. PRD §4 시나리오 A·§6.3·API 목록 / Flow §3.4 갱신. |
| v2.13 | 2026-06-28 | **BottomNav에서 [등급] 탭 제거 → [체험권] 탭으로 교체, 등급은 MY 하위로 이동** — 핵심 5탭이 [등급]에 점유되던 비효율 해소. ① BottomNav: 홈/탐색/**등급**/혜택/MY → 홈/탐색/**체험권**/혜택/MY. [체험권]은 기존 `/r/passes`(내가 쓸 수 있는 active + 신청/진행 체험단 리스트, 방문형·기자단) 연결. ② 혜택 탭 아이콘 ticket→trophy(체험권과 충돌 회피). ③ 등급(`/r/grade`)은 MY(`/r/me`) 하위로 이동 — 프로필 등급 칩을 `/r/grade` 링크화 + "내 활동" 메뉴 그룹에 "내 등급 / 등급별 혜택" 진입 추가(체험권·혜택 진입도 함께 정리). `/r/grade` 라우트 자체는 유지. PRD §3.1 BottomNav 정의 / Flow §1·§6·§7 갱신. |
| v2.16 | 2026-06-30 | **채널별 등급 + 채널 선택 참여 개편** — 연동 채널을 블로그/인스타/틱톡 3종으로 한정하고, 채널마다 독립 등급을 부여해 참여 채널별로 받을 수 있는 지원금을 자동 계산. ① **데이터 모델**: `SnsKind`에서 youtube 제거, `Reviewer.channelGrades`(채널별 등급) 추가·종합 `grade`=최상위, `Campaign.highlightKeywords`(강조 키워드) 추가, `Pass.reviewSelfCheck`를 채널별 가변 `Record<string,boolean>`으로 일반화, SEED_VERSION 9. ② **신규 lib**: `src/lib/channels.ts`(채널 라벨·짧은 라벨 블/인/틱·우선순위·광고문구·채널별 리뷰 작성 조건·`defaultChannel`), `grade.ts`에 `channelGradesFromSns`/`bestGrade`/`SUPPORT_MULTIPLIER`(S100·A80·B60·C40·N10)/`supportForGrade`/`channelOffers`/`bestEligibleSupport`. ③ **매장 리스트**(홈·탐색 RowCard/GridCard): 참여 가능 채널을 `ChannelIcons`(블/인/틱) 아이콘으로 표기, 금액은 내 채널 등급 기준 **가장 큰 혜택**으로 노출. ④ **매장 상세**: `StoreParticipate` 신설 — 상단 칩으로 채널 선택(블로그 우선→인스타→틱톡), 선택 채널의 내 등급으로 지원금 자동 계산, 채널별 리뷰 작성 조건 노출, 하단 sticky에 최종 채널+금액+[참여하기]. 다크 히어로는 '내가 받을 수 있는 지원금'/'최대 지원금'으로 분기. '캠페인 소개'→'매장 소개', 강조 키워드 칩 노출. ⑤ **참여/사용 API**: `/api/passes`가 `channel` 수신 → pass.reviewChannel·reviewerGrade(채널 등급) 확정(기자단은 작성 시 채널 선택·종합 등급), `/api/passes/use`·`use-by-code`의 지원금 한도 = `supportForGrade(기준, 채널 등급)`. ⑥ **리뷰 폼**: 참여 시 확정된 채널 고정 표기 + 채널별 자가점검 항목(`CHANNEL_REVIEW_CONDITIONS`), 운영팀 검수 콘솔도 채널별 항목 렌더. ⑦ **등급 탭**: 채널별 등급 카드(채널·배율·뱃지/미연동) 섹션 추가. ⑧ **캠페인 생성**: 채널 3종·강조 키워드 입력·매장 소개 500자 제한. ⑨ 시드 데모 리뷰어를 채널별 등급(블 A·인 C 등)으로 구성. PRD §6.1·시나리오 A·캠페인 생성·API 목록·§6.9 / Flow 갱신. |
| v2.15 | 2026-06-30 | **운영팀 검수 백오피스 신설** — 후기 검수 책임을 사장님(조회 전용)에서 분리해 별도 `admin` 역할이 일괄 처리하는 콘솔 신설. ① **데이터/인증**: `AdminUser` 타입 + `DBShape.admins` 추가, `Role`에 `"admin"` 추가, 시드에 운영팀 계정 1건(`admin@catchrank.co.kr / demo1234`) 발행, SEED_VERSION 8. `/api/auth/login`에 admin 분기 추가, `getCurrentAdmin()` 헬퍼(미인증 시 `/admin/login` redirect). ② **라우트**: `/admin/login`(client 로그인 폼), `/admin/(app)/layout.tsx`(세션 게이트 + "운영팀 검수 콘솔" 헤더 + 로그아웃), `/admin/(app)/reviews`(검수 대기 리스트 + ink 통계), `/admin`→`/admin/reviews` redirect. ③ **API** `POST /api/admin/reviews/decide` — admin 세션, `{passId, decision: approve\|reject, reason?}`, review_submitted 상태만 처리. approve→completed(reviewStatus approved + reviewer.completedReviews++), reject→rejected, **양측(체험자·사장님) 알림** 발행. ④ **UI** `ReviewDecisionActions` — [검수 통과]/[반려](사유 입력)→처리 후 목록에서 제거. ⑤ admin 세션은 reviewer/owner 화면·보상 대상에서 제외(`/welcome/box`·`/api/referral/accept` 가드). PRD §3.3·시나리오 E-1·§6.7·API 목록 갱신. |
| v2.14 | 2026-06-28 | **홈 3-카드 큐레이션 라벨/필터 정비** — ① 라벨 변경: 갓 오픈 카페→**최근에 등록됨**(sub "새로 들어온 곳", 🆕), 이미 다 안다→**곧 마감돼요**(sub "놓치면 끝", ⏰), 공짜로 줘요→**파격 지원금**(sub "많이 주는 곳", 💸). ② 진입 필터 정정: 최근에 등록됨 → `/r/explore?sort=new`(기존 cat=카페 강제 필터 제거), 곧 마감돼요 → `?sort=closing`, 파격 지원금 → `?sort=topSupport`. ③ 카운트 테마 일치: recentCount(7일 내 생성)/closingCount(7일 내 종료)/bigSupportCount(지원금 10만+). ④ 시드 visit 캠페인 날짜 스프레드(idx 0~1 최근 생성, 2~4 곧 마감)로 타일 카운트·정렬 데모 가능하게, SEED_VERSION 7. |
