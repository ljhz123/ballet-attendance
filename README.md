# 발레학원 출석체크 PWA

발레학원 회원권/출석 관리를 위한 PWA. 단일 학원·50명 이하 규모용.

## 기술 스택

- React 19 + TypeScript + Vite + Tailwind CSS v3
- Supabase (Postgres + Auth + RLS + pg_cron)
- 배포: Vercel + GitHub
- PWA: vite-plugin-pwa (manifest + 서비스 워커)

## 개발

```bash
npm install
cp .env.example .env.local   # 실제 값 채우기
npm run dev                  # http://localhost:5173
```

## 테스트

```bash
npm test           # 단위 테스트 (vitest)
npm run typecheck  # TypeScript 타입 체크
npm run build      # 프로덕션 빌드
```

## 배포

`main` 브랜치 푸시 → Vercel 자동 배포.

환경 변수 (Vercel 대시보드에서 설정):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## DB 마이그레이션

`supabase/migrations/` 폴더의 SQL을 순서대로 Supabase SQL Editor에서 실행:
1. `0001_init.sql` — 테이블
2. `0002_rls.sql` — Row Level Security 정책
3. `0003_functions.sql` — 출석체크/되돌리기/만료 함수
4. `0004_cron.sql` — 매일 자정 만료 처리 스케줄

## 운영 매뉴얼

### 첫 관리자 만들기
1. Supabase Authentication → Users → Add user (Auto Confirm ✓)
   - Email: `<전화번호>@ballet.local` 형식 (예: `01012345678@ballet.local`)
2. SQL Editor에서 `members` 테이블에 admin row 삽입 (auth_user_id에 위 사용자 UID 사용)

### 새 회원 받기
1. 회원이 PWA에서 "가입 신청"
2. 관리자 `/admin/pending`에서 승인
3. 자동으로 회원권 등록 모달이 뜸 → 10/20/30회 선택 + 구매일 입력

### 회원 비밀번호 분실 시
1. Supabase Dashboard → Authentication → Users → 해당 회원 검색
2. "Send password recovery email" 또는 Auth dashboard에서 직접 비밀번호 변경
3. 새 비밀번호를 회원에게 구두/카톡으로 전달
4. 회원이 로그인 후 `/settings`에서 본인이 다시 변경

### 회원권 만료 자동 처리
매일 KST 자정(UTC 15:00)에 pg_cron이 만료된 회원권을 자동으로 'expired' 상태로 전환.

## 회원에게 안내할 카톡 공지 (배포 후 사용)

```
[발레학원 출석 앱 안내]

이제부터 회원권/출석 확인을 앱으로 하실 수 있어요.

1. 아래 주소를 폰 브라우저로 열어주세요:
   https://<vercel-주소>.vercel.app

2. "가입 신청"을 누르고 이름·전화번호·비밀번호를 입력해주세요.
   (원장님이 승인 후 사용 가능합니다)

3. 폰 홈 화면에 추가하면 앱처럼 쓸 수 있어요:
   - 안드로이드: 화면 위 "설치" 배너 누르기
   - 아이폰: 사파리 공유 버튼 → "홈 화면에 추가"
```
