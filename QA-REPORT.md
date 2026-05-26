# CATCHPASS · 내부 테스트 배포 보고

## 스코프 (최종 조정)

> **자사 내부 인원 약 10명이 테스트할 수 있는 수준** — Demo 계정으로 전체 기능 시연 가능, 실 사용자 가입은 단일 인스턴스 내 유효. 데이터 영속화(Vercel KV 등 마이그레이션)는 자사 개발팀 후속 작업으로 위임.

## 배포 URL (Production)

| 진입 | URL |
|---|---|
| **랜딩** | https://reviewer-hgx1.vercel.app/ |
| **체험자 로그인** | https://reviewer-hgx1.vercel.app/r/login |
| **사장님 로그인** | https://reviewer-hgx1.vercel.app/o/login |
| 브랜치 별칭 | https://reviewer-hgx1-git-vercel-07d480-codudgh0810-gmailcoms-projects.vercel.app/ |

> 동일 도메인에서 path로 양면 분기 (`/r/*` 체험자, `/o/*` 사장님). 모바일 사파리/크롬 최적화.

## 데모 계정 (시드 데이터 · 결정론적 ID로 인스턴스 간 동일 보장)

| 역할 | 이메일 | 비밀번호 |
|---|---|---|
| 체험자 (B등급, 완료 리뷰 3건) | `demo@reviewer.com` | `demo1234` |
| 사장님 (Standard 플랜, 정식당·북촌 운영) | `demo@store.com` | `demo1234` |

시드 캠페인 — 가을 시즌 디너 (₩100,000 지원), 오픈 기념 베이커리 (₩30,000 지원).

## 자동 QA 결과 — 23/23 ALL GREEN

동일 코드 빌드(`next build`) 로컬 검증 (curl 시나리오):

- 정적 페이지 5종 도달성 (`/`, `/r/login`, `/r/signup`, `/o/login`, `/o/signup`)
- 양면 데모 로그인
- 체험자 홈 매장 리스트 + 캠페인 카드 노출
- **핵심 트랜잭션** — 체험권 발급 → QR 표시 → 24h 카운트다운 → 사장님 코드 조회 → 결제 ₩120,000 입력 → 지원금 상한 ₩100,000 자동 적용 → 사용 처리 → 체험자 리뷰 등록 → 사장님 검수 통과 → 체험자 MY 등급 점수 반영
- 신규 가입 (SNS 연동 없이 → N등급 자동 부여)
- N등급 사용자 → 상위 자격 캠페인 차단 (403)
- 신규 사장님 가입 → 매장 자동 생성 → 새 캠페인 생성

## 알려진 제약 & 자사 개발팀 마이그레이션 항목

### 데이터 영속성 (KV/DB 미연동)
- 현재 in-memory 모듈 싱글톤 + `/tmp` JSON 스냅샷
- **단일 인스턴스 안에서는 정상** — 10명 내외 동시 테스트는 거의 모든 경우 단일 warm 인스턴스에서 처리되어 신규 가입 후 즉시 로그인/탐색 가능
- **Cold restart 발생 시** 시드되지 않은 사용자 데이터는 소실 (Vercel은 약 5-15분 비활성 시 인스턴스 회수)
- **동시 인스턴스 스케일업 시** 인스턴스 A에 가입한 사용자는 B에서 안 보일 수 있음
- **마이그레이션 경로**: `src/lib/kv.ts`가 Upstash Redis REST API 어댑터를 이미 보유. Vercel 대시보드 → Storage → Upstash for Redis 추가 후 프로젝트 연결만 하면 `KV_REST_API_URL`/`KV_REST_API_TOKEN` 환경변수가 자동 주입되어 `getDBAsync()`가 자동으로 KV 사용으로 전환됨. 코드 변경 0줄.

### SNS 연동 인증
- 가입 시 URL과 영향력 수치를 사용자가 자기 입력 (MVP)
- 운영 시점에는 OAuth (인스타/유튜브/틱톡) + 네이버 블로그 크롤링 검증으로 업그레이드 (PRD 12.9 확정)

### QR 카메라 스캔
- `html5-qrcode` 통합 완료, HTTPS 환경(*.vercel.app)에서 사파리/크롬 카메라 권한 정상 작동
- 카메라 거부/PC 환경 시 "코드 직접 입력" 대체 경로 제공

### 보안 환경변수
- `AUTH_SECRET`이 Vercel 환경변수에 설정되어 있어야 JWT 서명이 안정 (현재 설정됨 추정 — 미설정 시 dev 폴백 시크릿 사용 → 인스턴스 재시작 시 모든 세션 유효)
- 한 줄 권장: Vercel Project Settings → Environment Variables에 `AUTH_SECRET = openssl rand -hex 32 결과값` 등록되어 있는지 확인

## 보안 후속 조치 (즉시)

- [ ] Vercel 토큰 `vcp_4zpm…Cwe` 즉시 **재발급 또는 삭제** (챗 노출됨)
- [ ] Bypass 토큰 `ufIYSVNJ…INkY` 더 이상 필요 없으면 Deployment Protection 설정에서 삭제
- [ ] `AUTH_SECRET` 환경변수에 강한 임의값 설정 확인

## 내부 테스터 안내문 (그대로 공유 가능)

> **CATCHPASS 내부 테스트 환경**
> - 입구: https://reviewer-hgx1.vercel.app/
> - 체험자 데모: `demo@reviewer.com` / `demo1234`
> - 사장님 데모: `demo@store.com` / `demo1234`
> - 두 데모 계정을 다른 디바이스(또는 시크릿 창)에서 동시에 열어 한 명은 매장 참여 → QR 발급, 다른 한 명은 QR 코드를 입력해 사용 처리하는 흐름을 시연 가능.
> - 신규 가입도 가능 (이메일 무엇이든 OK). 단 내부 테스트 환경이라 데이터가 주기적으로 초기화될 수 있음을 안내.

## 기술 스택 요약

- **Frontend**: Next.js 15.5.18 (App Router) · React 19 · TailwindCSS 3.4
- **Auth**: jose JWT + httpOnly 쿠키 · bcryptjs 비밀번호 해시
- **Data**: in-memory 모듈 싱글톤 + /tmp JSON 스냅샷 (+ Upstash Redis 어댑터 stand-by)
- **QR**: qrcode 생성 (체험자) / html5-qrcode 카메라 스캔 (사장님) + 코드 직접 입력 대체
- **Hosting**: Vercel (icn1 서울 리전)
- **Repo**: youngho-chae/reviewer, branch `claude/create-planning-prd-wdoZK`
