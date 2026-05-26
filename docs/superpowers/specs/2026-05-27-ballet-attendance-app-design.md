# 발레학원 출석체크 PWA — 설계서

- **작성일**: 2026-05-27
- **대상 학원**: 단일 발레학원, 활동 회원 50명 이하
- **배포 형태**: PWA (Progressive Web App, 앱스토어 미경유)
- **언어**: 한국어

---

## 1. 목적 및 배경

발레학원 회원이 월 단위로 횟수권(10·20·30회)을 구매하여 수업 시 차감하는 운영 방식에 맞춘 출석/회원권 관리 도구를 만든다. 현재는 수기로 관리하고 있어 회원이 자기 잔여 횟수와 만료일을 실시간 확인하기 어렵고, 원장(관리자)이 만료 임박 회원에게 별도로 안내해야 하는 비효율이 있다.

---

## 2. 사용자 및 역할

| 역할 | 설명 |
|---|---|
| **회원** | 학원에 등록된 수강생. 본인의 회원권 잔여 횟수·만료일·출석 이력 조회. |
| **관리자(원장)** | 학원 운영자. 회원 가입 승인, 회원권 등록, 출석체크, 회원 관리. 같은 앱에서 관리자 계정으로 로그인 시 관리 메뉴 노출. |

---

## 3. 기능 요구사항

### 3.1 회원
- 회원가입 신청 (이름, 전체 전화번호, 비밀번호)
- 가입 후 "관리자 승인 대기" 화면 노출
- 승인 완료 후 로그인 가능 (전체 전화번호 + 비밀번호)
- 본인 정보 조회: 현재 회원권(잔여 횟수, 만료일, 다음 결제 예정일), 출석 이력(최근 10건)
- 인앱 알림 카드 (다음 조건 만족 시 자동 표시)
  - 만료 ≤ 3일
  - 만료 당일
  - 잔여 ≤ 2회
  - 활성 회원권 0개 (재구매 안내)
  - 오늘 출석 완료됨
- 비밀번호 변경

### 3.2 관리자
- 회원 가입 신청 승인/거절
- 승인 직후 회원권 등록 모달 자동 표시 (10/20/30회 선택, 구매일 입력)
- 출석체크 화면: 활성 회원 목록에서 탭 1번으로 차감
  - 차감 직후 토스트에 "되돌리기" 5초간 노출
  - 같은 날 중복 출석 시 경고 다이얼로그
- 회원 관리: 전체 회원 목록, 상태/만료임박 필터, 회원 상세 진입
- 회원 상세: 기본 정보, 회원권 추가, 활성 회원권, 만료/소진 이력, 출석 이력 + 잘못 찍은 출석 되돌리기
- 임시 비밀번호 발급 (회원이 비밀번호 분실 시)

### 3.3 회원권 비즈니스 룰
- 회원권 종류: 10회·20회·30회 (확장 가능하게 설계)
- **만료일 자동 계산**: 구매일 + (총횟수 / 10)개월 — 10회→+1개월, 20회→+2개월, 30회→+3개월
- 관리자가 만료일 수동 조정 가능
- 회원권 종료 조건: `remaining_count == 0` 또는 `expiry_date < 오늘` 중 먼저 도달
- 한 회원이 동시에 여러 활성 회원권 보유 가능 (만료 전 재구매 시)
- 출석체크 시 **가장 빨리 만료될 활성 회원권에서 자동 차감**

### 3.4 결제
- 결제는 앱 외부에서 처리 (계좌이체·카드단말기 등)
- 앱은 관리자가 결제 사실을 기록하는 용도 (회원권 등록 시점에 자동 기록)

---

## 4. 아키텍처

```
[회원/관리자 휴대폰 브라우저]
     │  HTTPS
     ▼
[Vercel] ← React PWA (한 코드, 역할별 화면 분기)
     │  REST/Realtime
     ▼
[Supabase]
   ├─ PostgreSQL (모든 도메인 데이터)
   ├─ Auth (전화번호 + 비밀번호)
   └─ Row Level Security (역할별 접근 제어)
```

### 4.1 기술 스택
- **프론트엔드**: React 18 + TypeScript + Vite + Tailwind CSS
- **PWA**: `vite-plugin-pwa` (manifest, 서비스 워커, 오프라인 캐시)
- **백엔드**: Supabase (Postgres + Auth + RLS)
- **호스팅**: Vercel (정적)
- **버전 관리**: GitHub

### 4.2 인증
- Supabase Auth의 Phone provider 대신, 이메일 형식의 가짜 이메일(예: `01012345678@local`)로 매핑하여 전화번호 기반 로그인 구현 (Supabase는 phone+SMS 인증을 기본 제공하지만 SMS 비용이 발생하므로 사용 안 함)
- 비밀번호는 Supabase Auth가 bcrypt로 해시 저장
- 가입 직후 `status='pending'` 상태로 만들어두고, RLS 정책에서 `active` 상태가 아니면 데이터 접근 차단

### 4.3 권한 모델 (Row Level Security)
- **회원**: 자기 데이터(자기 vouchers, 자기 attendance)만 SELECT 가능
- **관리자**: 모든 테이블에 full access
- 역할 판별은 `members.role` 컬럼 기반, RLS 정책에서 `current_setting('request.jwt.claims')`로 사용자 ID 확인

---

## 5. 데이터 모델

```sql
-- 회원 (관리자 포함)
create table members (
  id              uuid primary key default gen_random_uuid(),
  phone           text unique not null,        -- 010XXXXXXXX (하이픈 제거)
  password_hash   text not null,
  name            text not null,
  role            text not null check (role in ('member','admin')) default 'member',
  status          text not null check (status in ('pending','active','inactive')) default 'pending',
  created_at      timestamptz default now(),
  approved_at     timestamptz
);

-- 회원권
create table vouchers (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid references members(id) on delete cascade,
  total_count     int not null,
  remaining_count int not null,
  purchase_date   date not null,
  expiry_date     date not null,
  status          text not null check (status in ('active','expired','used_up')) default 'active',
  created_at      timestamptz default now()
);

-- 출석 이력
create table attendance (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid references members(id) on delete cascade,
  voucher_id      uuid references vouchers(id),
  checked_at      timestamptz default now(),
  checked_by      uuid references members(id),
  reverted_at     timestamptz                  -- 되돌리기 시 채워짐 (soft delete)
);
```

### 5.1 트랜잭션 처리
- 출석체크는 PostgreSQL 함수 `check_attendance(member_id)`로 구현
- 함수 내에서: 활성 회원권 중 가장 빨리 만료되는 것 선택 → `remaining_count -= 1` UPDATE → attendance INSERT → 회원권 `remaining_count == 0` 되면 status='used_up'으로 변경
- 단일 트랜잭션이므로 중복 차감·차감 누락 없음

### 5.2 만료 자동 처리
- DB 함수 `expire_old_vouchers()`를 매일 자정에 실행 (Supabase pg_cron) — `expiry_date < 오늘`인 active 회원권을 'expired' 상태로 변경

---

## 6. 화면 구성

### 6.1 회원 화면
| 경로 | 내용 |
|---|---|
| `/login` | 전화번호 + 비밀번호 |
| `/signup` | 이름 + 전화번호 + 비밀번호 → "승인 대기" 화면 |
| `/me` | 인사말, 인앱 알림 카드들, 현재 회원권 카드, 출석 이력 최근 10건, (미설치 시) 홈 화면 추가 안내 |
| `/settings` | 비밀번호 변경 |

### 6.2 관리자 화면
| 경로 | 내용 |
|---|---|
| `/admin` | 출석체크 메인 — 검색창, 활성 회원 리스트, 회원별 [+ 출석] 버튼, 오늘 출석한 회원 섹션 |
| `/admin/pending` | 가입 승인 대기 리스트 — 승인 시 회원권 등록 모달 자동 |
| `/admin/members` | 전체 회원 목록 + 필터(전체/만료임박/만료됨) |
| `/admin/members/:id` | 회원 상세 — 회원권 추가, 활성/이력 회원권, 출석 이력 + 되돌리기 |

### 6.3 UX 핵심
- 출석체크는 **탭 1번에 완료** + 5초 되돌리기
- 같은 날 중복 출석 시 경고
- 모바일 우선 (관리자도 폰으로 출석체크하는 시나리오 가정), 태블릿/PC 화면에서도 정상 작동
- 한국어 전용 (다국어 미지원)

---

## 7. PWA 설정

- `manifest.json`: 앱 이름(예: "○○발레 출석체크"), 아이콘(192·512px), 시작 URL `/me` (회원) 또는 `/admin` (관리자, 동적), 테마 컬러
- 서비스 워커: 정적 자산 캐시(오프라인 시 마지막 화면 보임), API는 항상 네트워크 우선
- 설치 안내: 가입 직후, 그리고 회원 메인 화면 상단에 미설치 시 배너 노출
  - Android Chrome: `beforeinstallprompt` 이벤트로 자동 설치 버튼
  - iOS Safari: "공유 → 홈 화면에 추가" 스크린샷 안내

---

## 8. 보안·개인정보

- 모든 통신 HTTPS (Vercel·Supabase 기본 제공)
- 비밀번호 bcrypt 해시 (Supabase Auth)
- 클라이언트 측 접근 제어 + DB Row Level Security 이중화
- 로그인 시도 제한: 같은 IP에서 10분 내 10회 실패 시 차단 (Supabase Auth 기본 정책)
- **개인정보처리방침** 페이지 작성 — 수집 항목(이름·전화·출석이력), 보유기간, 파기절차, 책임자 연락처 명시
- 회원 탈퇴(=비활성화) 시 본인 접근 차단, 출석이력은 회계 보관용으로 잔존

---

## 9. 비용

| 항목 | 비용 |
|---|---|
| Supabase | 무료 티어 (DB 500MB / 인증 50K MAU / 월 2GB 전송) — 50명 규모에 충분 |
| Vercel | 무료 티어 (취미·소규모 프로젝트) |
| 도메인 (선택) | 약 2만원/년, 무료 시 `*.vercel.app` |
| **합계** | **0원/월** (도메인 미사용 시) |

---

## 10. 개발·배포 일정

3주 예상 (제가 풀타임 작업 가정).

| 주차 | 작업 |
|---|---|
| 1주차 | Supabase 셋업, DB 스키마·RLS, React 프로젝트 셋업, 인증·승인 화면 |
| 2주차 | 회원 메인, 관리자 출석체크, 회원/회원권 관리, 인앱 알림 |
| 3주차 | PWA(manifest·SW·아이콘), 개인정보처리방침, Vercel 배포, 사용 가이드, QA |

### 원장님 사전 준비
1. Supabase 계정 가입 (GitHub 로그인)
2. Vercel 계정 가입 (GitHub 로그인)
3. GitHub 계정
4. (선택) 도메인 구매 — 약 2만원/년
5. 회원에게 안내할 PWA 주소 + 설치 방법 카톡 공지문 (제가 초안 작성)

---

## 11. 추후 확장 후보 (이번 범위 밖)

- 네이티브 앱(React Native + Expo)으로 앱스토어 출시
- 푸시 알림 (Web Push 또는 네이티브 푸시)
- 회원권 종류 추가 (월 무제한, 기간제 등)
- 결제 연동 (토스페이먼츠·카카오페이)
- 다지점 / 다강사
- 통계 대시보드 (월별 출석률, 매출 추이)
- SMS·카카오 알림톡 연동
- 출결 자동 결석 알림 (오랜 미출석 회원에게)

---

## 12. 의도적으로 빼놓은 것 (YAGNI)

- 푸시 알림 — 인앱 알림으로 충분, 푸시 인프라 비용·복잡도 회피
- 회원권 종류 다양화 — 횟수권만으로 시작
- 결제 시스템 — 학원이 외부에서 처리
- 다국어 — 한국어 전용
- 다지점·다강사 — 단일 학원
- SMS 인증 — 가입 시 관리자 승인으로 본인 확인 대체
- 회원 사진/프로필 — 단순 텍스트만

