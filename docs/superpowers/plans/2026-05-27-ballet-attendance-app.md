# 발레학원 출석체크 PWA — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 단일 발레학원(<50명)의 회원권·출석 관리 PWA를 React + Supabase로 만들어 Vercel에 배포한다.

**Architecture:** React PWA (Vite + TS + Tailwind) ↔ Supabase(Postgres + Auth + RLS + pg_cron). 한 코드베이스 안에서 `members.role`로 회원/관리자 화면 분기. 출석체크는 Postgres 함수로 트랜잭션 처리. 인앱 알림은 로그인 시 계산하여 표시 (푸시 인프라 없음).

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, React Router, vite-plugin-pwa, Supabase JS SDK, vitest, Playwright (E2E happy path)

**Spec:** [docs/superpowers/specs/2026-05-27-ballet-attendance-app-design.md](../specs/2026-05-27-ballet-attendance-app-design.md)

---

## Phases

- **Phase 0 — 사전 준비** (Task 1~2): 사용자가 직접 해야 할 외부 계정 작업
- **Phase 1 — 기반 구축** (Task 3~7): 프로젝트 셋업, DB 스키마, RLS, 인증 헬퍼
- **Phase 2 — 인증 흐름** (Task 8~12): 가입, 승인, 로그인, 보호 라우팅
- **Phase 3 — 회원 화면** (Task 13~17): /me, 회원권 카드, 인앱 알림, 출석이력, 비밀번호 변경
- **Phase 4 — 관리자 화면** (Task 18~24): 출석체크, 가입승인, 회원관리, 회원권 등록, 출석 되돌리기
- **Phase 5 — PWA 마감** (Task 25~28): manifest, 서비스워커, 개인정보처리방침, Vercel 배포

각 Task는 완료 후 커밋. Phase가 끝날 때마다 수동 스모크 테스트 권장.

---

## 파일 구조 (최종)

```
출석체크앱개발/
├─ supabase/
│  ├─ migrations/
│  │  ├─ 0001_init.sql              # 테이블 생성
│  │  ├─ 0002_rls.sql               # Row Level Security
│  │  ├─ 0003_functions.sql         # check_attendance, expire_old_vouchers, 만료일 계산
│  │  └─ 0004_cron.sql              # pg_cron 매일 자정 expire
│  └─ tests/
│     ├─ check_attendance.test.ts
│     ├─ expire_old_vouchers.test.ts
│     └─ rls.test.ts
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ lib/
│  │  ├─ supabase.ts                # Supabase client
│  │  ├─ auth.ts                    # phone↔email 변환, 로그인/가입 helpers
│  │  ├─ vouchers.ts                # 회원권 비즈니스 로직 (만료일 계산 등)
│  │  ├─ alerts.ts                  # 인앱 알림 조건 계산
│  │  └─ types.ts                   # DB 타입
│  ├─ components/
│  │  ├─ VoucherCard.tsx
│  │  ├─ AlertCard.tsx
│  │  ├─ AttendanceRow.tsx
│  │  ├─ MemberSearchBox.tsx
│  │  ├─ InstallPrompt.tsx
│  │  └─ ProtectedRoute.tsx
│  ├─ pages/
│  │  ├─ Login.tsx
│  │  ├─ Signup.tsx
│  │  ├─ PendingApproval.tsx
│  │  ├─ Me.tsx
│  │  ├─ Settings.tsx
│  │  ├─ admin/
│  │  │  ├─ AdminLayout.tsx
│  │  │  ├─ AttendanceCheck.tsx      # /admin
│  │  │  ├─ Pending.tsx              # /admin/pending
│  │  │  ├─ Members.tsx              # /admin/members
│  │  │  └─ MemberDetail.tsx         # /admin/members/:id
│  │  └─ PrivacyPolicy.tsx
│  └─ test/
│     ├─ vouchers.test.ts
│     └─ alerts.test.ts
├─ public/
│  ├─ icons/                          # PWA 아이콘
│  └─ manifest.webmanifest
├─ e2e/
│  └─ happy-path.spec.ts              # Playwright
├─ index.html
├─ package.json
├─ vite.config.ts
├─ tailwind.config.js
├─ tsconfig.json
├─ .env.local                         # 비공개 (gitignore)
├─ .env.example
└─ README.md
```

---

# Phase 0 — 사전 준비

## Task 1: 외부 계정 준비 (사용자 직접 수행)

**원장님이 직접 해야 하는 작업입니다.** 아래 5개 계정을 만들고 인증 정보를 메모해두세요. 모두 무료이며 GitHub 계정 하나로 가입 가능합니다.

- [ ] **Step 1: GitHub 계정 가입** — [github.com](https://github.com/signup), 사용자명·이메일·비밀번호 메모

- [ ] **Step 2: Supabase 가입** — [supabase.com](https://supabase.com/) → "Start your project" → GitHub 로그인

- [ ] **Step 3: Vercel 가입** — [vercel.com](https://vercel.com/signup) → "Continue with GitHub"

- [ ] **Step 4: Node.js LTS 설치** — [nodejs.org](https://nodejs.org/) 에서 LTS 버전 (20.x) 다운로드 후 설치. PowerShell 새 창에서 `node -v` 실행, `v20.x.x` 출력 확인

- [ ] **Step 5: Git 설치** — [git-scm.com](https://git-scm.com/download/win) → 설치 → `git --version` 확인

**완료 조건:** PowerShell에서 `node -v`, `git --version`, `npm -v` 셋 다 정상 출력.

---

## Task 2: Supabase 프로젝트 생성 (사용자 직접 수행)

**Files:** (외부 서비스)

- [ ] **Step 1: Supabase 새 프로젝트 생성**

[app.supabase.com](https://app.supabase.com) → "New Project"
- Name: `ballet-attendance`
- Database Password: **강한 비밀번호 생성 후 1Password/메모장에 저장** (분실 시 DB 접근 불가)
- Region: `Northeast Asia (Seoul)`
- Plan: Free

- [ ] **Step 2: 프로젝트 키 메모**

생성 후 좌측 Settings → API 메뉴에서 다음 값을 메모:
- `Project URL` (예: `https://xxxx.supabase.co`)
- `anon public` key (긴 JWT 토큰)
- `service_role` key (관리용 — **절대 깃 커밋 금지**)

- [ ] **Step 3: pg_cron 확장 활성화**

좌측 Database → Extensions → 검색 `pg_cron` → Enable

**완료 조건:** 위 3개 값(URL/anon/service_role)을 안전한 곳에 보관.

---

# Phase 1 — 기반 구축

## Task 3: 프로젝트 초기화

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `tailwind.config.js`, `postcss.config.js`, `src/index.css`, `.gitignore`, `.env.example`, `README.md`

- [ ] **Step 1: Vite + React + TS 프로젝트 생성**

PowerShell에서 작업 디렉토리 안에서:
```powershell
npm create vite@latest . -- --template react-ts
```
질문에 `y` 누름.

- [ ] **Step 2: 의존성 설치**

```powershell
npm install
npm install @supabase/supabase-js react-router-dom date-fns
npm install -D tailwindcss postcss autoprefixer @types/node vitest @vitest/ui playwright @playwright/test vite-plugin-pwa
npx tailwindcss init -p
```

- [ ] **Step 3: Tailwind 설정**

`tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

`src/index.css` (기존 내용 모두 삭제 후):
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
```

- [ ] **Step 4: `.gitignore`에 환경파일 추가**

`.gitignore` 끝에 다음 줄 추가:
```
.env.local
.env*.local
playwright-report/
test-results/
```

- [ ] **Step 5: `.env.example` 작성**

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Backend tests only (NEVER commit real value)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [ ] **Step 6: 사용자가 `.env.local` 작성**

`.env.example`을 복사해 `.env.local`로 만들고, Task 2에서 받은 실제 값으로 채움. **이 파일은 절대 깃 커밋 안 됨.**

- [ ] **Step 7: vite.config.ts에 PWA 플러그인 추가 자리만 잡기**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // PWA plugin은 Phase 5에서 추가
});
```

- [ ] **Step 8: package.json scripts 추가**

`scripts` 섹션을 다음으로 교체:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 9: 빌드 확인**

```powershell
npm run dev
```
브라우저에서 `http://localhost:5173` 열어 Vite 기본 화면 보이면 OK. Ctrl+C로 종료.

- [ ] **Step 10: Git 초기 커밋**

```powershell
git init
git add .
git commit -m "chore: bootstrap vite+react+ts+tailwind project"
```

---

## Task 4: DB 스키마 마이그레이션

**Files:**
- Create: `supabase/migrations/0001_init.sql`

- [ ] **Step 1: 스키마 SQL 작성**

`supabase/migrations/0001_init.sql`:
```sql
-- 회원 (관리자 포함)
create table members (
  id              uuid primary key default gen_random_uuid(),
  phone           text unique not null,
  password_hash   text,                                            -- Auth가 관리, 여기는 미사용(레퍼런스용 컬럼만 남김)
  name            text not null,
  role            text not null check (role in ('member','admin')) default 'member',
  status          text not null check (status in ('pending','active','inactive')) default 'pending',
  created_at      timestamptz not null default now(),
  approved_at     timestamptz,
  -- Supabase Auth user id와 1:1 매핑
  auth_user_id    uuid unique
);

create index members_phone_idx on members (phone);
create index members_status_idx on members (status);
create index members_role_idx on members (role);

-- 회원권
create table vouchers (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references members(id) on delete cascade,
  total_count     int not null check (total_count > 0),
  remaining_count int not null check (remaining_count >= 0),
  purchase_date   date not null,
  expiry_date     date not null,
  status          text not null check (status in ('active','expired','used_up')) default 'active',
  created_at      timestamptz not null default now()
);

create index vouchers_member_idx on vouchers (member_id);
create index vouchers_status_expiry_idx on vouchers (status, expiry_date);

-- 출석 이력 (reverted_at으로 소프트 삭제)
create table attendance (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references members(id) on delete cascade,
  voucher_id      uuid not null references vouchers(id),
  checked_at      timestamptz not null default now(),
  checked_by      uuid not null references members(id),
  reverted_at     timestamptz
);

create index attendance_member_idx on attendance (member_id, checked_at desc);
create index attendance_checked_at_idx on attendance (checked_at desc);
```

- [ ] **Step 2: Supabase Dashboard에서 마이그레이션 실행**

[app.supabase.com](https://app.supabase.com) → 프로젝트 → SQL Editor → New query → 위 SQL 붙여넣기 → "Run"

- [ ] **Step 3: 테이블 생성 확인**

좌측 Database → Tables → `members`, `vouchers`, `attendance` 3개 보이면 OK

- [ ] **Step 4: 커밋**

```powershell
git add supabase/migrations/0001_init.sql
git commit -m "feat(db): initial schema (members, vouchers, attendance)"
```

---

## Task 5: 회원권 비즈니스 로직 (만료일 계산) — TDD

**Files:**
- Create: `src/lib/vouchers.ts`, `src/test/vouchers.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/test/vouchers.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { calculateExpiryDate } from '../lib/vouchers';

describe('calculateExpiryDate', () => {
  it('10회권은 구매일로부터 1개월 후 만료', () => {
    expect(calculateExpiryDate('2026-05-27', 10)).toBe('2026-06-27');
  });

  it('20회권은 구매일로부터 2개월 후 만료', () => {
    expect(calculateExpiryDate('2026-05-27', 20)).toBe('2026-07-27');
  });

  it('30회권은 구매일로부터 3개월 후 만료', () => {
    expect(calculateExpiryDate('2026-05-27', 30)).toBe('2026-08-27');
  });

  it('월말 처리 — 1월 31일 + 1개월은 2월 말일', () => {
    expect(calculateExpiryDate('2026-01-31', 10)).toBe('2026-02-28');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```powershell
npm test
```
Expected: FAIL — "calculateExpiryDate is not a function" 또는 모듈 없음

- [ ] **Step 3: 구현**

`src/lib/vouchers.ts`:
```ts
import { addMonths, format, lastDayOfMonth, parseISO } from 'date-fns';

export function calculateExpiryDate(purchaseDate: string, totalCount: number): string {
  const months = totalCount / 10;
  const start = parseISO(purchaseDate);
  const candidate = addMonths(start, months);
  // 1월 31일 → 2월 28/29일 같은 월말 처리는 date-fns의 addMonths가 알아서 함
  return format(candidate, 'yyyy-MM-dd');
}
```

- [ ] **Step 4: 테스트 통과 확인**

```powershell
npm test
```
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```powershell
git add src/lib/vouchers.ts src/test/vouchers.test.ts
git commit -m "feat(vouchers): expiry date calculation with TDD"
```

---

## Task 6: 인앱 알림 룰 — TDD

**Files:**
- Create: `src/lib/alerts.ts`, `src/test/alerts.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/test/alerts.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { computeAlerts, type AlertContext } from '../lib/alerts';

const today = '2026-05-27';

function ctx(overrides: Partial<AlertContext> = {}): AlertContext {
  return {
    today,
    activeVouchers: [],
    todayAttendance: null,
    ...overrides,
  };
}

describe('computeAlerts', () => {
  it('활성 회원권 없으면 재구매 안내', () => {
    const alerts = computeAlerts(ctx());
    expect(alerts).toEqual([{ kind: 'no_voucher' }]);
  });

  it('만료까지 3일 이하면 만료임박 알림', () => {
    const alerts = computeAlerts(ctx({
      activeVouchers: [{ id: 'v1', remaining_count: 5, expiry_date: '2026-05-30' }],
    }));
    expect(alerts).toContainEqual({ kind: 'expiring_soon', daysLeft: 3, expiry: '2026-05-30' });
  });

  it('만료 당일이면 today 표시', () => {
    const alerts = computeAlerts(ctx({
      activeVouchers: [{ id: 'v1', remaining_count: 5, expiry_date: '2026-05-27' }],
    }));
    expect(alerts).toContainEqual({ kind: 'expiring_soon', daysLeft: 0, expiry: '2026-05-27' });
  });

  it('잔여 2회 이하면 잔여 부족 알림', () => {
    const alerts = computeAlerts(ctx({
      activeVouchers: [{ id: 'v1', remaining_count: 2, expiry_date: '2026-07-01' }],
    }));
    expect(alerts).toContainEqual({ kind: 'low_count', remaining: 2 });
  });

  it('오늘 출석 기록이 있으면 출석완료 알림', () => {
    const alerts = computeAlerts(ctx({
      activeVouchers: [{ id: 'v1', remaining_count: 10, expiry_date: '2026-07-01' }],
      todayAttendance: { checked_at: '2026-05-27T10:00:00Z' },
    }));
    expect(alerts).toContainEqual({ kind: 'checked_today', at: '2026-05-27T10:00:00Z' });
  });

  it('여러 조건 동시 만족 — 모두 표시', () => {
    const alerts = computeAlerts(ctx({
      activeVouchers: [{ id: 'v1', remaining_count: 1, expiry_date: '2026-05-29' }],
      todayAttendance: { checked_at: '2026-05-27T10:00:00Z' },
    }));
    expect(alerts.map(a => a.kind).sort()).toEqual(
      ['checked_today', 'expiring_soon', 'low_count'].sort()
    );
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```powershell
npm test
```
Expected: FAIL

- [ ] **Step 3: 구현**

`src/lib/alerts.ts`:
```ts
import { differenceInCalendarDays, parseISO } from 'date-fns';

export type Alert =
  | { kind: 'no_voucher' }
  | { kind: 'expiring_soon'; daysLeft: number; expiry: string }
  | { kind: 'low_count'; remaining: number }
  | { kind: 'checked_today'; at: string };

export interface ActiveVoucher {
  id: string;
  remaining_count: number;
  expiry_date: string;
}

export interface AlertContext {
  today: string;
  activeVouchers: ActiveVoucher[];
  todayAttendance: { checked_at: string } | null;
}

const EXPIRY_WARN_DAYS = 3;
const LOW_COUNT_THRESHOLD = 2;

export function computeAlerts(ctx: AlertContext): Alert[] {
  const alerts: Alert[] = [];

  if (ctx.activeVouchers.length === 0) {
    alerts.push({ kind: 'no_voucher' });
    return ctx.todayAttendance
      ? [...alerts, { kind: 'checked_today', at: ctx.todayAttendance.checked_at }]
      : alerts;
  }

  const soonest = [...ctx.activeVouchers].sort(
    (a, b) => a.expiry_date.localeCompare(b.expiry_date)
  )[0];

  const daysLeft = differenceInCalendarDays(parseISO(soonest.expiry_date), parseISO(ctx.today));
  if (daysLeft <= EXPIRY_WARN_DAYS && daysLeft >= 0) {
    alerts.push({ kind: 'expiring_soon', daysLeft, expiry: soonest.expiry_date });
  }

  const totalRemaining = ctx.activeVouchers.reduce((sum, v) => sum + v.remaining_count, 0);
  if (totalRemaining <= LOW_COUNT_THRESHOLD) {
    alerts.push({ kind: 'low_count', remaining: totalRemaining });
  }

  if (ctx.todayAttendance) {
    alerts.push({ kind: 'checked_today', at: ctx.todayAttendance.checked_at });
  }

  return alerts;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```powershell
npm test
```
Expected: PASS (6 tests in alerts + 4 in vouchers)

- [ ] **Step 5: 커밋**

```powershell
git add src/lib/alerts.ts src/test/alerts.test.ts
git commit -m "feat(alerts): in-app alert rules with TDD"
```

---

## Task 7: Supabase 클라이언트 + 타입 + Auth 헬퍼

**Files:**
- Create: `src/lib/supabase.ts`, `src/lib/types.ts`, `src/lib/auth.ts`

- [ ] **Step 1: 타입 정의**

`src/lib/types.ts`:
```ts
export interface Member {
  id: string;
  phone: string;
  name: string;
  role: 'member' | 'admin';
  status: 'pending' | 'active' | 'inactive';
  created_at: string;
  approved_at: string | null;
  auth_user_id: string | null;
}

export interface Voucher {
  id: string;
  member_id: string;
  total_count: number;
  remaining_count: number;
  purchase_date: string;
  expiry_date: string;
  status: 'active' | 'expired' | 'used_up';
  created_at: string;
}

export interface AttendanceRow {
  id: string;
  member_id: string;
  voucher_id: string;
  checked_at: string;
  checked_by: string;
  reverted_at: string | null;
}
```

- [ ] **Step 2: Supabase 클라이언트**

`src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing in .env.local');
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});
```

- [ ] **Step 3: 전화번호 ↔ 가짜 이메일 변환 헬퍼**

`src/lib/auth.ts`:
```ts
import { supabase } from './supabase';
import type { Member } from './types';

// 010-1234-5678 → 01012345678
export function normalizePhone(input: string): string {
  return input.replace(/[^0-9]/g, '');
}

// 전화번호를 Supabase Auth의 이메일로 매핑 (외부 노출 X)
function phoneToEmail(phone: string): string {
  return `${normalizePhone(phone)}@ballet.local`;
}

export async function signUpWithPhone(args: {
  phone: string;
  password: string;
  name: string;
}): Promise<Member> {
  const phone = normalizePhone(args.phone);
  const { data, error } = await supabase.auth.signUp({
    email: phoneToEmail(phone),
    password: args.password,
  });
  if (error) throw error;
  if (!data.user) throw new Error('signup returned no user');

  const { data: member, error: insErr } = await supabase
    .from('members')
    .insert({
      phone,
      name: args.name,
      role: 'member',
      status: 'pending',
      auth_user_id: data.user.id,
    })
    .select()
    .single();
  if (insErr) throw insErr;
  return member as Member;
}

export async function signInWithPhone(phone: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: phoneToEmail(phone),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getCurrentMember(): Promise<Member | null> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return null;
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('auth_user_id', session.session.user.id)
    .single();
  if (error) return null;
  return data as Member;
}
```

- [ ] **Step 4: 타입체크 통과**

```powershell
npm run typecheck
```
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```powershell
git add src/lib/
git commit -m "feat(lib): supabase client, types, phone-based auth helpers"
```

---

# Phase 2 — 인증 흐름

## Task 8: Row Level Security 정책

**Files:**
- Create: `supabase/migrations/0002_rls.sql`

- [ ] **Step 1: RLS SQL 작성**

`supabase/migrations/0002_rls.sql`:
```sql
-- 모든 테이블 RLS on
alter table members    enable row level security;
alter table vouchers   enable row level security;
alter table attendance enable row level security;

-- 현재 로그인 사용자의 members row 조회 함수 (auth.uid()는 Supabase 내장)
create or replace function current_member()
returns members
language sql stable security definer
as $$
  select * from members where auth_user_id = auth.uid() limit 1;
$$;

create or replace function is_admin()
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from members
    where auth_user_id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$$;

-- members 정책
-- 가입 직후 자기 row 1개는 insert 가능 (auth_user_id가 자기 user id여야 함)
create policy members_insert_self on members
  for insert with check (auth_user_id = auth.uid());

-- 본인 row 조회
create policy members_select_self on members
  for select using (auth_user_id = auth.uid());

-- 관리자는 모두 조회
create policy members_select_admin on members
  for select using (is_admin());

-- 관리자는 모두 수정 (승인·역할변경·상태변경)
create policy members_update_admin on members
  for update using (is_admin());

-- 본인 비밀번호/이름 정도 본인이 update (status·role은 못 바꿈은 트리거로 보호 — Task 9에서)
create policy members_update_self on members
  for update using (auth_user_id = auth.uid());

-- vouchers 정책
create policy vouchers_select_self on vouchers
  for select using (
    member_id in (select id from members where auth_user_id = auth.uid())
  );

create policy vouchers_admin_all on vouchers
  for all using (is_admin()) with check (is_admin());

-- attendance 정책
create policy attendance_select_self on attendance
  for select using (
    member_id in (select id from members where auth_user_id = auth.uid())
  );

create policy attendance_admin_all on attendance
  for all using (is_admin()) with check (is_admin());
```

- [ ] **Step 2: Trigger — 일반 회원의 self-update 시 role/status 변경 방지**

같은 파일 끝에 추가:
```sql
create or replace function prevent_self_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  if is_admin() then
    return new;
  end if;
  if old.role is distinct from new.role then
    raise exception 'members.role can only be changed by admin';
  end if;
  if old.status is distinct from new.status then
    raise exception 'members.status can only be changed by admin';
  end if;
  if old.approved_at is distinct from new.approved_at then
    raise exception 'members.approved_at can only be changed by admin';
  end if;
  return new;
end;
$$;

create trigger members_no_self_escalation
  before update on members
  for each row execute function prevent_self_privilege_escalation();
```

- [ ] **Step 3: Supabase SQL Editor에서 실행**

전체 SQL 복사 → 실행. 에러 없으면 성공.

- [ ] **Step 4: 커밋**

```powershell
git add supabase/migrations/0002_rls.sql
git commit -m "feat(db): row-level security policies + privilege escalation guard"
```

---

## Task 9: 첫 관리자 계정 부트스트랩

**Files:** (외부)

- [ ] **Step 1: Auth Dashboard에서 관리자 가입**

Supabase Dashboard → Authentication → Users → "Add user" → "Create new user"
- Email: `01000000000@ballet.local` (원장님 본인 전화번호 사용 권장. 예: `01012345678@ballet.local`)
- Password: 강한 비밀번호
- Auto Confirm User: 체크

생성된 user의 `id` (UUID) 복사.

- [ ] **Step 2: members 테이블에 admin row 삽입**

SQL Editor에서 (위에서 복사한 UUID와 본인 정보로 치환):
```sql
insert into members (phone, name, role, status, approved_at, auth_user_id)
values (
  '01012345678',                       -- 원장님 전화번호 (하이픈 없이)
  '원장',                              -- 본인 이름
  'admin',
  'active',
  now(),
  '여기에-Auth-user-id-붙여넣기'::uuid  -- 위에서 복사한 id
);
```

- [ ] **Step 3: 확인**

```sql
select id, phone, name, role, status from members where role = 'admin';
```
관리자 1명 보이면 성공.

---

## Task 10: 로그인 페이지

**Files:**
- Create: `src/pages/Login.tsx`, `src/App.tsx` (라우터 셋업)

- [ ] **Step 1: 라우터 설치 (이미 설치됨) 및 App.tsx 셋업**

`src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Login 페이지**

`src/pages/Login.tsx`:
```tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithPhone } from '../lib/auth';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithPhone(phone, password);
      navigate('/me');
    } catch (err: any) {
      setError(err?.message ?? '로그인 실패');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-4 bg-gray-50">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white p-6 rounded-2xl shadow">
        <h1 className="text-2xl font-bold mb-6 text-center">🩰 발레학원 출석체크</h1>
        <label className="block text-sm font-medium mb-1">전화번호</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="010-1234-5678"
          required
          className="w-full border rounded-lg px-3 py-2 mb-4"
        />
        <label className="block text-sm font-medium mb-1">비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full border rounded-lg px-3 py-2 mb-4"
        />
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-pink-500 text-white rounded-lg py-2 font-semibold disabled:opacity-50"
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>
        <p className="text-center text-sm mt-4">
          처음이신가요? <Link to="/signup" className="text-pink-600 underline">가입 신청</Link>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: 수동 테스트**

```powershell
npm run dev
```
브라우저에서 `/login` 접속 → Task 9에서 만든 관리자 계정으로 로그인 시도. 에러 없이 `/me`로 이동하면 OK (아직 `/me`는 없으니 흰 화면이지만 URL이 바뀌면 됨).

- [ ] **Step 4: 커밋**

```powershell
git add src/App.tsx src/pages/Login.tsx
git commit -m "feat(auth): login page"
```

---

## Task 11: 회원가입 + 승인대기 페이지

**Files:**
- Create: `src/pages/Signup.tsx`, `src/pages/PendingApproval.tsx`, `src/App.tsx` (라우트 추가)

- [ ] **Step 1: Signup 페이지**

`src/pages/Signup.tsx`:
```tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signUpWithPhone } from '../lib/auth';

export default function Signup() {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signUpWithPhone({ phone, name, password });
      navigate('/pending');
    } catch (err: any) {
      setError(err?.message ?? '가입 실패');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-4 bg-gray-50">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white p-6 rounded-2xl shadow">
        <h1 className="text-2xl font-bold mb-6 text-center">가입 신청</h1>
        <label className="block text-sm font-medium mb-1">이름</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full border rounded-lg px-3 py-2 mb-4"
        />
        <label className="block text-sm font-medium mb-1">전화번호</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="010-1234-5678"
          required
          className="w-full border rounded-lg px-3 py-2 mb-4"
        />
        <label className="block text-sm font-medium mb-1">비밀번호 (6자 이상)</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full border rounded-lg px-3 py-2 mb-4"
        />
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-pink-500 text-white rounded-lg py-2 font-semibold disabled:opacity-50"
        >
          {loading ? '신청 중...' : '가입 신청'}
        </button>
        <p className="text-center text-sm mt-4">
          이미 가입했어요 <Link to="/login" className="text-pink-600 underline">로그인</Link>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: PendingApproval 페이지**

`src/pages/PendingApproval.tsx`:
```tsx
import { Link } from 'react-router-dom';

export default function PendingApproval() {
  return (
    <div className="min-h-full flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-sm bg-white p-6 rounded-2xl shadow text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h1 className="text-xl font-bold mb-2">가입 신청 완료</h1>
        <p className="text-gray-600 mb-6">
          원장님이 승인하면 로그인할 수 있어요.<br />
          잠시 후 다시 시도해주세요.
        </p>
        <Link to="/login" className="text-pink-600 underline text-sm">로그인 화면으로</Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 라우트 추가**

`src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import PendingApproval from './pages/PendingApproval';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/pending" element={<PendingApproval />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: 수동 테스트**

`npm run dev` → 가짜 회원 한 명 가입 신청 → Supabase Dashboard → Table Editor → members 테이블에 새 row가 `status='pending'`으로 들어왔는지 확인.

- [ ] **Step 5: 커밋**

```powershell
git add src/pages/Signup.tsx src/pages/PendingApproval.tsx src/App.tsx
git commit -m "feat(auth): signup + pending approval pages"
```

---

## Task 12: 보호 라우팅 + 역할 분기

**Files:**
- Create: `src/components/ProtectedRoute.tsx`, `src/lib/useCurrentMember.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: 현재 회원 정보 훅**

`src/lib/useCurrentMember.ts`:
```ts
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { getCurrentMember } from './auth';
import type { Member } from './types';

export function useCurrentMember() {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const m = await getCurrentMember();
      if (!cancelled) {
        setMember(m);
        setLoading(false);
      }
    }
    load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { member, loading };
}
```

- [ ] **Step 2: ProtectedRoute 컴포넌트**

`src/components/ProtectedRoute.tsx`:
```tsx
import { Navigate } from 'react-router-dom';
import { useCurrentMember } from '../lib/useCurrentMember';

interface Props {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin }: Props) {
  const { member, loading } = useCurrentMember();

  if (loading) {
    return <div className="min-h-full flex items-center justify-center">로딩 중...</div>;
  }
  if (!member) return <Navigate to="/login" replace />;
  if (member.status === 'pending') return <Navigate to="/pending" replace />;
  if (member.status === 'inactive') return <Navigate to="/login" replace />;
  if (requireAdmin && member.role !== 'admin') return <Navigate to="/me" replace />;
  return <>{children}</>;
}
```

- [ ] **Step 3: 임시 /me 페이지 (다음 Task에서 채움)**

`src/pages/Me.tsx`:
```tsx
import { signOut } from '../lib/auth';
import { useCurrentMember } from '../lib/useCurrentMember';
import { useNavigate } from 'react-router-dom';

export default function Me() {
  const { member } = useCurrentMember();
  const navigate = useNavigate();
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">{member?.name}님 안녕하세요</h1>
      <p className="text-sm text-gray-500 mt-1">{member?.phone}</p>
      <button
        onClick={async () => { await signOut(); navigate('/login'); }}
        className="mt-4 text-sm text-pink-600 underline"
      >로그아웃</button>
    </div>
  );
}
```

- [ ] **Step 4: App.tsx 업데이트**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import PendingApproval from './pages/PendingApproval';
import Me from './pages/Me';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/pending" element={<PendingApproval />} />
        <Route path="/me" element={<ProtectedRoute><Me /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 5: 수동 테스트**

`npm run dev`:
1. `/me` 로 바로 접속 → 로그인 안 됐으므로 `/login`으로 리다이렉트 OK
2. 관리자(Task 9)로 로그인 → `/me`에 "원장님 안녕하세요" 보임
3. 로그아웃 → `/login`으로

- [ ] **Step 6: 커밋**

```powershell
git add src/components/ProtectedRoute.tsx src/lib/useCurrentMember.ts src/pages/Me.tsx src/App.tsx
git commit -m "feat(auth): protected routing + role gates"
```

---

# Phase 3 — 회원 화면

## Task 13: check_attendance / expire_old_vouchers DB 함수

**Files:**
- Create: `supabase/migrations/0003_functions.sql`

- [ ] **Step 1: SQL 작성**

`supabase/migrations/0003_functions.sql`:
```sql
-- 출석체크: 가장 빨리 만료될 활성 회원권에서 1회 차감하고 attendance row 생성
-- security definer로 RLS 우회 (관리자 권한은 호출 직전에 확인)
create or replace function check_attendance(p_member_id uuid)
returns table (attendance_id uuid, voucher_id uuid, remaining_after int)
language plpgsql
security definer
as $$
declare
  v_voucher vouchers%rowtype;
  v_admin_id uuid;
  v_today date := current_date;
  v_attendance_id uuid;
begin
  -- 호출자가 관리자여야 함
  select id into v_admin_id
    from members
    where auth_user_id = auth.uid() and role='admin' and status='active';
  if v_admin_id is null then
    raise exception 'only admins can check attendance';
  end if;

  -- 활성 회원권 중 가장 빨리 만료될 것 잠금 잡고 선택
  select * into v_voucher
    from vouchers
    where member_id = p_member_id
      and status = 'active'
      and remaining_count > 0
      and expiry_date >= v_today
    order by expiry_date asc, created_at asc
    for update
    limit 1;

  if v_voucher.id is null then
    raise exception 'no active voucher for member %', p_member_id;
  end if;

  -- 차감
  update vouchers
    set remaining_count = remaining_count - 1,
        status = case when remaining_count - 1 = 0 then 'used_up' else status end
    where id = v_voucher.id
    returning remaining_count into v_voucher.remaining_count;

  -- attendance 기록
  insert into attendance (member_id, voucher_id, checked_by)
    values (p_member_id, v_voucher.id, v_admin_id)
    returning id into v_attendance_id;

  return query select v_attendance_id, v_voucher.id, v_voucher.remaining_count;
end;
$$;

-- 출석 되돌리기: attendance를 reverted로 표시하고 회원권 1회 복구
create or replace function revert_attendance(p_attendance_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_admin uuid;
  v_attendance attendance%rowtype;
begin
  select id into v_admin
    from members
    where auth_user_id = auth.uid() and role='admin' and status='active';
  if v_admin is null then raise exception 'only admins can revert'; end if;

  select * into v_attendance from attendance where id = p_attendance_id for update;
  if v_attendance.id is null then raise exception 'attendance not found'; end if;
  if v_attendance.reverted_at is not null then return; end if;

  update attendance set reverted_at = now() where id = p_attendance_id;

  update vouchers
    set remaining_count = remaining_count + 1,
        status = case when status = 'used_up' then 'active' else status end
    where id = v_attendance.voucher_id;
end;
$$;

-- 매일 자정: 만료된 active 회원권 expired로 전환
create or replace function expire_old_vouchers()
returns void
language sql
security definer
as $$
  update vouchers
    set status = 'expired'
    where status = 'active'
      and expiry_date < current_date;
$$;

-- anon/authenticated 둘 다 호출할 수 있게 함수 권한 (RLS는 함수 내부 체크가 막아줌)
grant execute on function check_attendance(uuid) to authenticated;
grant execute on function revert_attendance(uuid) to authenticated;
```

- [ ] **Step 2: Supabase SQL Editor에서 실행**

위 전체 SQL → Run.

- [ ] **Step 3: 수동 SQL 검증**

SQL Editor에서:
```sql
-- 검증용 데이터 만들기 (Task 9의 admin id 사용)
-- 1. 더미 회원 한 명 만들기
insert into members (phone, name, role, status, approved_at)
values ('01099998888', '테스트', 'member', 'active', now())
returning id;
-- → 이 id 복사 (M_ID)

-- 2. 회원권 추가
insert into vouchers (member_id, total_count, remaining_count, purchase_date, expiry_date)
values ('M_ID-여기-붙여넣기', 10, 10, current_date, current_date + interval '1 month');

-- 3. check_attendance 호출 — 단, 이건 admin auth context가 필요해서 SQL Editor에서는 직접 호출 X.
--    대신 다음 명령으로 차감 시뮬레이션:
update vouchers set remaining_count = remaining_count - 1 where member_id = 'M_ID';
-- 회원권이 9로 줄어들면 함수 로직과 동일

-- 4. 정리
delete from vouchers where member_id = 'M_ID';
delete from members where id = 'M_ID';
```

(실제 check_attendance 호출 검증은 Task 18의 출석체크 UI에서 통합 테스트로 함)

- [ ] **Step 4: 커밋**

```powershell
git add supabase/migrations/0003_functions.sql
git commit -m "feat(db): attendance check/revert + voucher expiry functions"
```

---

## Task 14: pg_cron — 매일 자정 만료 처리

**Files:**
- Create: `supabase/migrations/0004_cron.sql`

- [ ] **Step 1: SQL 작성**

`supabase/migrations/0004_cron.sql`:
```sql
-- KST 자정 = UTC 15:00 (전날)
select cron.schedule(
  'expire-old-vouchers-daily',
  '0 15 * * *',
  $$ select expire_old_vouchers(); $$
);
```

- [ ] **Step 2: Supabase에서 실행**

SQL Editor → Run.

- [ ] **Step 3: 등록 확인**

```sql
select jobid, jobname, schedule, command from cron.job;
```
`expire-old-vouchers-daily` 보이면 OK.

- [ ] **Step 4: 커밋**

```powershell
git add supabase/migrations/0004_cron.sql
git commit -m "feat(db): schedule daily voucher expiry"
```

---

## Task 15: 회원 메인 화면 — 회원권 카드 + 알림

**Files:**
- Create: `src/components/VoucherCard.tsx`, `src/components/AlertCard.tsx`
- Modify: `src/pages/Me.tsx`

- [ ] **Step 1: VoucherCard 컴포넌트**

`src/components/VoucherCard.tsx`:
```tsx
import type { Voucher } from '../lib/types';
import { differenceInCalendarDays, parseISO } from 'date-fns';

export default function VoucherCard({ voucher, today }: { voucher: Voucher; today: string }) {
  const daysLeft = differenceInCalendarDays(parseISO(voucher.expiry_date), parseISO(today));
  return (
    <div className="bg-gradient-to-br from-pink-100 to-pink-50 rounded-2xl p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-gray-600">남은 횟수</span>
        <span className="text-xs text-gray-500">총 {voucher.total_count}회</span>
      </div>
      <div className="text-4xl font-bold text-pink-700 my-2">{voucher.remaining_count}<span className="text-lg ml-1">회</span></div>
      <hr className="my-3 border-pink-200" />
      <div className="text-sm text-gray-700">
        <div>만료일 <span className="font-semibold">{voucher.expiry_date}</span> {daysLeft >= 0 ? `(D-${daysLeft})` : '(만료됨)'}</div>
        <div className="text-xs text-gray-500 mt-1">다음 결제 예정일: {voucher.expiry_date}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: AlertCard 컴포넌트**

`src/components/AlertCard.tsx`:
```tsx
import type { Alert } from '../lib/alerts';

function render(alert: Alert) {
  switch (alert.kind) {
    case 'no_voucher':
      return { icon: '🛍️', text: '활성 회원권이 없어요. 원장님께 결제 후 등록 부탁드려요.' };
    case 'expiring_soon':
      return alert.daysLeft === 0
        ? { icon: '⚠️', text: `회원권이 오늘 만료돼요 (${alert.expiry})` }
        : { icon: '⚠️', text: `회원권이 ${alert.daysLeft}일 후 만료돼요 (${alert.expiry})` };
    case 'low_count':
      return { icon: '⚠️', text: `남은 횟수가 ${alert.remaining}회 남았어요` };
    case 'checked_today':
      return { icon: '✅', text: '오늘 출석체크 됐어요' };
  }
}

export default function AlertCard({ alert }: { alert: Alert }) {
  const { icon, text } = render(alert);
  return (
    <div className="bg-white border border-pink-200 rounded-xl px-4 py-3 flex items-start gap-3 text-sm">
      <span className="text-lg">{icon}</span>
      <span className="text-gray-800">{text}</span>
    </div>
  );
}
```

- [ ] **Step 3: /me 페이지 채우기**

`src/pages/Me.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from '../lib/auth';
import { useCurrentMember } from '../lib/useCurrentMember';
import { supabase } from '../lib/supabase';
import type { Voucher, AttendanceRow } from '../lib/types';
import { computeAlerts } from '../lib/alerts';
import VoucherCard from '../components/VoucherCard';
import AlertCard from '../components/AlertCard';
import { format } from 'date-fns';

export default function Me() {
  const { member } = useCurrentMember();
  const navigate = useNavigate();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!member) return;
    async function load() {
      const [v, a] = await Promise.all([
        supabase.from('vouchers').select('*').eq('member_id', member!.id).order('expiry_date'),
        supabase.from('attendance').select('*').eq('member_id', member!.id).is('reverted_at', null).order('checked_at', { ascending: false }).limit(10),
      ]);
      setVouchers((v.data ?? []) as Voucher[]);
      setAttendance((a.data ?? []) as AttendanceRow[]);
      setLoading(false);
    }
    load();
  }, [member]);

  if (!member || loading) return <div className="p-4">로딩 중...</div>;

  const activeVouchers = vouchers.filter(v => v.status === 'active' && v.remaining_count > 0 && v.expiry_date >= today);
  const todayAttendance = attendance.find(a => a.checked_at.slice(0, 10) === today);
  const alerts = computeAlerts({
    today,
    activeVouchers: activeVouchers.map(v => ({ id: v.id, remaining_count: v.remaining_count, expiry_date: v.expiry_date })),
    todayAttendance: todayAttendance ? { checked_at: todayAttendance.checked_at } : null,
  });

  return (
    <div className="max-w-md mx-auto p-4 pb-20">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">🩰 {member.name}님</h1>
          <p className="text-xs text-gray-500">{member.phone}</p>
        </div>
        <button
          onClick={async () => { await signOut(); navigate('/login'); }}
          className="text-xs text-gray-500 underline"
        >로그아웃</button>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2 mb-6">
          {alerts.map((a, i) => <AlertCard key={i} alert={a} />)}
        </div>
      )}

      <h2 className="text-sm font-semibold text-gray-700 mb-2">내 회원권</h2>
      {activeVouchers.length === 0 && <p className="text-sm text-gray-500">활성 회원권이 없어요.</p>}
      <div className="space-y-3 mb-6">
        {activeVouchers.map(v => <VoucherCard key={v.id} voucher={v} today={today} />)}
      </div>

      <h2 className="text-sm font-semibold text-gray-700 mb-2">최근 출석</h2>
      {attendance.length === 0 && <p className="text-sm text-gray-500">출석 이력이 없어요.</p>}
      <ul className="space-y-1 text-sm">
        {attendance.map(a => (
          <li key={a.id} className="flex justify-between bg-white rounded-lg px-3 py-2 border">
            <span>{format(new Date(a.checked_at), 'yyyy-MM-dd HH:mm')}</span>
            <span className="text-pink-600">출석</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: 수동 테스트**

`npm run dev` → 관리자로 로그인 → 일단 본인 회원권 데이터가 없으니 "활성 회원권이 없어요" 알림. SQL Editor에서 관리자 본인에게 임시 회원권 INSERT 후 새로고침해서 카드 보이는지 확인. (관리자도 출석 가능하게 둘지는 운영 정책 — 현재 모델에서는 가능. Task 18에서 검증)

- [ ] **Step 5: 커밋**

```powershell
git add src/components/VoucherCard.tsx src/components/AlertCard.tsx src/pages/Me.tsx
git commit -m "feat(member): voucher card + alerts + attendance history"
```

---

## Task 16: 비밀번호 변경 페이지

**Files:**
- Create: `src/pages/Settings.tsx`
- Modify: `src/App.tsx`, `src/pages/Me.tsx`

- [ ] **Step 1: Settings 페이지**

`src/pages/Settings.tsx`:
```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Settings() {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) { setMsg({ kind: 'err', text: '비밀번호가 일치하지 않아요' }); return; }
    if (pw.length < 6) { setMsg({ kind: 'err', text: '6자 이상이어야 해요' }); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) setMsg({ kind: 'err', text: error.message });
    else { setMsg({ kind: 'ok', text: '변경 완료!' }); setPw(''); setPw2(''); }
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <Link to="/me" className="text-sm text-gray-500">← 돌아가기</Link>
      <h1 className="text-xl font-bold my-4">비밀번호 변경</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="새 비밀번호" className="w-full border rounded-lg px-3 py-2" />
        <input type="password" value={pw2} onChange={e=>setPw2(e.target.value)} placeholder="새 비밀번호 확인" className="w-full border rounded-lg px-3 py-2" />
        {msg && <p className={msg.kind === 'ok' ? 'text-green-600 text-sm' : 'text-red-600 text-sm'}>{msg.text}</p>}
        <button disabled={loading} className="w-full bg-pink-500 text-white py-2 rounded-lg font-semibold disabled:opacity-50">{loading ? '저장 중...' : '변경하기'}</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: 라우트 추가**

`src/App.tsx`의 Routes 안에 추가:
```tsx
<Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
```
import 도 추가.

- [ ] **Step 3: /me에 설정 링크**

`src/pages/Me.tsx`의 로그아웃 버튼 옆에:
```tsx
<Link to="/settings" className="text-xs text-gray-500 underline mr-3">설정</Link>
```
(import `Link from 'react-router-dom'` 추가)

- [ ] **Step 4: 수동 테스트**

`/settings` 접속 → 비밀번호 변경 → 로그아웃 후 새 비밀번호로 로그인 확인.

- [ ] **Step 5: 커밋**

```powershell
git add src/pages/Settings.tsx src/pages/Me.tsx src/App.tsx
git commit -m "feat(member): password change"
```

---

## Task 17: Phase 3 스모크 테스트

수동 점검 (커밋 없음):

- [ ] 가짜 회원 가입 → `pending`으로 들어감 → `/pending` 페이지 정상
- [ ] 관리자로 로그인 → `/me` 잘 보임
- [ ] 관리자가 직접 SQL로 가짜 회원 `status='active'`로 바꾸고 회원권 INSERT
- [ ] 가짜 회원 로그인 → 회원권 카드·알림 정상 표시
- [ ] 비밀번호 변경 → 새 비번 로그인 OK

문제 없으면 Phase 4로.

---

# Phase 4 — 관리자 화면

## Task 18: 관리자 레이아웃 + 출석체크 메인

**Files:**
- Create: `src/pages/admin/AdminLayout.tsx`, `src/pages/admin/AttendanceCheck.tsx`, `src/components/MemberSearchBox.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: AdminLayout**

`src/pages/admin/AdminLayout.tsx`:
```tsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useCurrentMember } from '../../lib/useCurrentMember';
import { signOut } from '../../lib/auth';

export default function AdminLayout() {
  const { member } = useCurrentMember();
  const navigate = useNavigate();
  return (
    <div className="min-h-full">
      <header className="bg-pink-600 text-white px-4 py-3 flex justify-between items-center">
        <div>
          <div className="font-bold">🩰 관리자</div>
          <div className="text-xs opacity-80">{member?.name}</div>
        </div>
        <button onClick={async()=>{await signOut(); navigate('/login');}} className="text-xs underline">로그아웃</button>
      </header>
      <nav className="flex border-b bg-white sticky top-0">
        {[
          { to: '/admin', label: '출석체크' },
          { to: '/admin/pending', label: '가입승인' },
          { to: '/admin/members', label: '회원관리' },
        ].map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/admin'}
            className={({isActive}) => `flex-1 text-center py-3 text-sm ${isActive ? 'text-pink-600 border-b-2 border-pink-600 font-semibold' : 'text-gray-600'}`}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className="p-4 max-w-2xl mx-auto"><Outlet /></main>
    </div>
  );
}
```

- [ ] **Step 2: MemberSearchBox**

`src/components/MemberSearchBox.tsx`:
```tsx
interface Props {
  value: string;
  onChange: (s: string) => void;
}
export default function MemberSearchBox({ value, onChange }: Props) {
  return (
    <input
      autoFocus
      type="search"
      value={value}
      onChange={e=>onChange(e.target.value)}
      placeholder="이름 또는 전화번호 뒷자리 검색"
      className="w-full border rounded-lg px-3 py-2 mb-3"
    />
  );
}
```

- [ ] **Step 3: AttendanceCheck 페이지 (탭1번 출석 + 5초 되돌리기)**

`src/pages/admin/AttendanceCheck.tsx`:
```tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Member, Voucher, AttendanceRow } from '../../lib/types';
import MemberSearchBox from '../../components/MemberSearchBox';
import { format } from 'date-fns';

interface Row { member: Member; remaining: number; expiry: string | null; }
interface RecentAttendance { id: string; member_name: string; remaining_after: number; at: number }

export default function AttendanceCheck() {
  const [members, setMembers] = useState<Member[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRow[]>([]);
  const [search, setSearch] = useState('');
  const [recent, setRecent] = useState<RecentAttendance[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const today = format(new Date(), 'yyyy-MM-dd');

  async function reload() {
    const [m, v, a] = await Promise.all([
      supabase.from('members').select('*').eq('status', 'active').eq('role', 'member').order('name'),
      supabase.from('vouchers').select('*').eq('status', 'active').gte('expiry_date', today),
      supabase.from('attendance').select('*').gte('checked_at', today + 'T00:00:00').is('reverted_at', null),
    ]);
    setMembers((m.data ?? []) as Member[]);
    setVouchers((v.data ?? []) as Voucher[]);
    setTodayAttendance((a.data ?? []) as AttendanceRow[]);
  }
  useEffect(() => { reload(); }, []);

  const rows = useMemo<Row[]>(() => members.map(m => {
    const vs = vouchers.filter(v => v.member_id === m.id && v.remaining_count > 0).sort((a,b)=>a.expiry_date.localeCompare(b.expiry_date));
    const remaining = vs.reduce((s, x) => s + x.remaining_count, 0);
    return { member: m, remaining, expiry: vs[0]?.expiry_date ?? null };
  }), [members, vouchers]);

  const filtered = rows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.member.name.toLowerCase().includes(q) || r.member.phone.includes(q);
  });

  async function onCheck(row: Row) {
    if (row.remaining === 0) { alert('활성 회원권이 없어요. 회원권 등록 후 다시 시도해주세요.'); return; }
    const checkedToday = todayAttendance.some(a => a.member_id === row.member.id);
    if (checkedToday && !confirm(`${row.member.name}님은 오늘 이미 출석했어요. 그래도 차감할까요?`)) return;

    setBusy(row.member.id);
    const { data, error } = await supabase.rpc('check_attendance', { p_member_id: row.member.id });
    setBusy(null);
    if (error) { alert('실패: ' + error.message); return; }
    const result = (data as Array<{ attendance_id: string; voucher_id: string; remaining_after: number }>)[0];
    setRecent(prev => [{ id: result.attendance_id, member_name: row.member.name, remaining_after: result.remaining_after, at: Date.now() }, ...prev.slice(0, 4)]);
    reload();
  }

  async function onRevert(id: string) {
    if (!confirm('출석을 되돌릴까요? 회원권 1회가 복구돼요.')) return;
    const { error } = await supabase.rpc('revert_attendance', { p_attendance_id: id });
    if (error) { alert('실패: ' + error.message); return; }
    setRecent(prev => prev.filter(r => r.id !== id));
    reload();
  }

  return (
    <div>
      <MemberSearchBox value={search} onChange={setSearch} />
      <ul className="space-y-2 mb-6">
        {filtered.map(r => {
          const checkedToday = todayAttendance.some(a => a.member_id === r.member.id);
          return (
            <li key={r.member.id} className="flex items-center justify-between bg-white border rounded-xl px-3 py-2">
              <div>
                <div className="font-medium">{r.member.name} {checkedToday && <span className="text-xs text-green-600 ml-1">✓오늘출석</span>}</div>
                <div className="text-xs text-gray-500">남은 {r.remaining}회 · 만료 {r.expiry ?? '—'}</div>
              </div>
              <button
                disabled={busy === r.member.id}
                onClick={() => onCheck(r)}
                className="bg-pink-500 text-white text-sm rounded-lg px-3 py-2 font-semibold disabled:opacity-50"
              >+ 출석</button>
            </li>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-gray-500 text-center py-6">회원이 없어요</p>}
      </ul>

      {recent.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">방금 처리한 출석 (5초 내 되돌리기)</h2>
          <ul className="space-y-1">
            {recent.map(r => (
              <li key={r.id} className="flex items-center justify-between text-sm bg-green-50 rounded-lg px-3 py-2">
                <span>✅ {r.member_name} · 남은 {r.remaining_after}회</span>
                {Date.now() - r.at < 5000 && (
                  <button onClick={() => onRevert(r.id)} className="text-xs text-red-600 underline">되돌리기</button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 라우트 등록**

`src/App.tsx`:
```tsx
import AdminLayout from './pages/admin/AdminLayout';
import AttendanceCheck from './pages/admin/AttendanceCheck';

// Routes 안에 추가:
<Route path="/admin" element={<ProtectedRoute requireAdmin><AdminLayout /></ProtectedRoute>}>
  <Route index element={<AttendanceCheck />} />
</Route>
```

- [ ] **Step 5: 수동 테스트**

관리자로 로그인 → `/admin` → 테스트 회원에게 출석체크 → 회원권 -1 차감 확인 → 같은 회원 한 번 더 누르면 경고 → 되돌리기 5초 안에 클릭하면 회원권 +1 복구.

- [ ] **Step 6: 커밋**

```powershell
git add src/pages/admin/ src/components/MemberSearchBox.tsx src/App.tsx
git commit -m "feat(admin): attendance check + undo"
```

---

## Task 19: 가입 승인 + 회원권 등록 모달

**Files:**
- Create: `src/pages/admin/Pending.tsx`, `src/components/VoucherCreateModal.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: VoucherCreateModal**

`src/components/VoucherCreateModal.tsx`:
```tsx
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { calculateExpiryDate } from '../lib/vouchers';
import { format } from 'date-fns';

interface Props {
  memberId: string;
  memberName: string;
  onClose: () => void;
  onCreated: () => void;
}

const PRESETS = [10, 20, 30];

export default function VoucherCreateModal({ memberId, memberName, onClose, onCreated }: Props) {
  const [total, setTotal] = useState(20);
  const [purchaseDate, setPurchaseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expiry, setExpiry] = useState(calculateExpiryDate(format(new Date(), 'yyyy-MM-dd'), 20));
  const [saving, setSaving] = useState(false);

  function updateTotal(n: number) {
    setTotal(n);
    setExpiry(calculateExpiryDate(purchaseDate, n));
  }
  function updatePurchaseDate(d: string) {
    setPurchaseDate(d);
    setExpiry(calculateExpiryDate(d, total));
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase.from('vouchers').insert({
      member_id: memberId,
      total_count: total,
      remaining_count: total,
      purchase_date: purchaseDate,
      expiry_date: expiry,
      status: 'active',
    });
    setSaving(false);
    if (error) { alert('실패: ' + error.message); return; }
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5">
        <h2 className="font-bold mb-3">{memberName}님 회원권 등록</h2>
        <label className="text-sm">총 횟수</label>
        <div className="flex gap-2 mt-1 mb-3">
          {PRESETS.map(n => (
            <button key={n} type="button" onClick={()=>updateTotal(n)}
              className={`flex-1 py-2 rounded-lg border ${total===n?'bg-pink-500 text-white border-pink-500':'border-gray-300'}`}>{n}회</button>
          ))}
        </div>
        <label className="text-sm">구매일</label>
        <input type="date" value={purchaseDate} onChange={e=>updatePurchaseDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 mb-3" />
        <label className="text-sm">만료일 (자동계산, 필요시 조정 가능)</label>
        <input type="date" value={expiry} onChange={e=>setExpiry(e.target.value)} className="w-full border rounded-lg px-3 py-2 mb-4" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border py-2 rounded-lg">취소</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-pink-500 text-white py-2 rounded-lg font-semibold disabled:opacity-50">{saving?'저장 중...':'등록'}</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Pending 페이지**

`src/pages/admin/Pending.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Member } from '../../lib/types';
import VoucherCreateModal from '../../components/VoucherCreateModal';

export default function Pending() {
  const [pending, setPending] = useState<Member[]>([]);
  const [voucherFor, setVoucherFor] = useState<Member | null>(null);

  async function reload() {
    const { data } = await supabase.from('members').select('*').eq('status', 'pending').order('created_at');
    setPending((data ?? []) as Member[]);
  }
  useEffect(() => { reload(); }, []);

  async function approve(m: Member) {
    const { error } = await supabase.from('members')
      .update({ status: 'active', approved_at: new Date().toISOString() })
      .eq('id', m.id);
    if (error) { alert(error.message); return; }
    setVoucherFor(m); // 승인 직후 회원권 등록 모달
    reload();
  }
  async function reject(m: Member) {
    if (!confirm(`${m.name}님 가입을 거절할까요?`)) return;
    const { error } = await supabase.from('members').update({ status: 'inactive' }).eq('id', m.id);
    if (error) { alert(error.message); return; }
    reload();
  }

  return (
    <div>
      <h2 className="text-sm text-gray-600 mb-2">{pending.length}명 대기 중</h2>
      <ul className="space-y-2">
        {pending.map(m => (
          <li key={m.id} className="bg-white border rounded-xl p-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">{m.name}</div>
                <div className="text-xs text-gray-500">{m.phone}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>reject(m)} className="text-sm px-3 py-1 border rounded">거절</button>
                <button onClick={()=>approve(m)} className="text-sm px-3 py-1 bg-pink-500 text-white rounded">승인</button>
              </div>
            </div>
          </li>
        ))}
        {pending.length === 0 && <p className="text-sm text-gray-500 text-center py-6">대기 중인 신청이 없어요</p>}
      </ul>
      {voucherFor && (
        <VoucherCreateModal
          memberId={voucherFor.id}
          memberName={voucherFor.name}
          onClose={() => setVoucherFor(null)}
          onCreated={() => {}}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: 라우트 등록**

`src/App.tsx`의 admin 중첩 라우트에 추가:
```tsx
import Pending from './pages/admin/Pending';
// ...
<Route path="/admin" element={<ProtectedRoute requireAdmin><AdminLayout /></ProtectedRoute>}>
  <Route index element={<AttendanceCheck />} />
  <Route path="pending" element={<Pending />} />
</Route>
```

- [ ] **Step 4: 수동 테스트**

브라우저 시크릿 창에서 새 회원 가입 신청 → 관리자 창에서 `/admin/pending` → 승인 → 모달에서 회원권 등록 → DB에 voucher 생성 확인 → 시크릿 창에서 가입한 회원 로그인 → 회원권 카드 정상 표시.

- [ ] **Step 5: 커밋**

```powershell
git add src/pages/admin/Pending.tsx src/components/VoucherCreateModal.tsx src/App.tsx
git commit -m "feat(admin): pending approvals + voucher creation modal"
```

---

## Task 20: 회원 목록 + 필터

**Files:**
- Create: `src/pages/admin/Members.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Members 페이지**

`src/pages/admin/Members.tsx`:
```tsx
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Member, Voucher } from '../../lib/types';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import MemberSearchBox from '../../components/MemberSearchBox';

type Filter = 'all' | 'expiring' | 'expired' | 'inactive';

export default function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    Promise.all([
      supabase.from('members').select('*').neq('role', 'admin').order('name'),
      supabase.from('vouchers').select('*'),
    ]).then(([m, v]) => {
      setMembers((m.data ?? []) as Member[]);
      setVouchers((v.data ?? []) as Voucher[]);
    });
  }, []);

  const enriched = useMemo(() => members.map(m => {
    const active = vouchers.filter(v => v.member_id === m.id && v.status === 'active' && v.remaining_count > 0 && v.expiry_date >= today)
      .sort((a,b)=>a.expiry_date.localeCompare(b.expiry_date));
    const soonest = active[0];
    const daysLeft = soonest ? differenceInCalendarDays(parseISO(soonest.expiry_date), parseISO(today)) : null;
    const remaining = active.reduce((s, x) => s + x.remaining_count, 0);
    return { ...m, soonest, daysLeft, remaining };
  }), [members, vouchers, today]);

  const filtered = enriched.filter(m => {
    if (search) {
      const q = search.toLowerCase();
      if (!m.name.toLowerCase().includes(q) && !m.phone.includes(q)) return false;
    }
    switch (filter) {
      case 'all': return m.status === 'active';
      case 'expiring': return m.status === 'active' && m.daysLeft !== null && m.daysLeft <= 7 && m.daysLeft >= 0;
      case 'expired': return m.status === 'active' && (m.daysLeft === null || m.daysLeft < 0 || m.remaining === 0);
      case 'inactive': return m.status === 'inactive';
    }
  });

  return (
    <div>
      <MemberSearchBox value={search} onChange={setSearch} />
      <div className="flex gap-1 mb-3 text-xs">
        {([['all','전체활성'],['expiring','만료임박'],['expired','만료/소진'],['inactive','비활성']] as [Filter,string][]).map(([k, l]) => (
          <button key={k} onClick={()=>setFilter(k)}
            className={`flex-1 py-2 rounded-full ${filter===k?'bg-pink-500 text-white':'bg-gray-100 text-gray-600'}`}>{l}</button>
        ))}
      </div>
      <ul className="space-y-2">
        {filtered.map(m => (
          <li key={m.id}>
            <Link to={`/admin/members/${m.id}`} className="block bg-white border rounded-xl p-3 hover:bg-gray-50">
              <div className="flex justify-between">
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-gray-500">{m.phone}</div>
                </div>
                <div className="text-right text-xs text-gray-600">
                  {m.soonest ? `남 ${m.remaining}회 · D-${m.daysLeft}` : '회원권 없음'}
                </div>
              </div>
            </Link>
          </li>
        ))}
        {filtered.length === 0 && <p className="text-sm text-gray-500 text-center py-6">없어요</p>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: 라우트 등록**

`src/App.tsx`:
```tsx
import Members from './pages/admin/Members';
// admin 라우트 안에:
<Route path="members" element={<Members />} />
```

- [ ] **Step 3: 수동 테스트**

`/admin/members` → 필터/검색 동작 확인.

- [ ] **Step 4: 커밋**

```powershell
git add src/pages/admin/Members.tsx src/App.tsx
git commit -m "feat(admin): members list with filters & search"
```

---

## Task 21: 회원 상세 (회원권 추가 + 출석 이력 + 되돌리기)

**Files:**
- Create: `src/pages/admin/MemberDetail.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: MemberDetail 페이지**

`src/pages/admin/MemberDetail.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Member, Voucher, AttendanceRow } from '../../lib/types';
import VoucherCreateModal from '../../components/VoucherCreateModal';
import { format } from 'date-fns';

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const [member, setMember] = useState<Member | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [tempPw, setTempPw] = useState<string | null>(null);

  async function reload() {
    if (!id) return;
    const [m, v, a] = await Promise.all([
      supabase.from('members').select('*').eq('id', id).single(),
      supabase.from('vouchers').select('*').eq('member_id', id).order('expiry_date', { ascending: false }),
      supabase.from('attendance').select('*').eq('member_id', id).order('checked_at', { ascending: false }).limit(50),
    ]);
    if (m.data) setMember(m.data as Member);
    setVouchers((v.data ?? []) as Voucher[]);
    setAttendance((a.data ?? []) as AttendanceRow[]);
  }
  useEffect(() => { reload(); }, [id]);

  if (!member) return <div>로딩 중...</div>;

  const active = vouchers.filter(v => v.status === 'active');
  const inactive = vouchers.filter(v => v.status !== 'active');

  async function revertAttendance(aid: string) {
    if (!confirm('출석을 되돌릴까요? 회원권 1회가 복구돼요.')) return;
    const { error } = await supabase.rpc('revert_attendance', { p_attendance_id: aid });
    if (error) { alert(error.message); return; }
    reload();
  }

  async function setInactive() {
    if (!confirm(`${member!.name}님을 비활성화할까요? (다시 활성화 가능)`)) return;
    await supabase.from('members').update({ status: 'inactive' }).eq('id', member!.id);
    reload();
  }
  async function reactivate() {
    await supabase.from('members').update({ status: 'active' }).eq('id', member!.id);
    reload();
  }

  async function issueTempPassword() {
    const generated = Math.random().toString(36).slice(2, 10);
    // service_role 없이는 다른 사용자 비밀번호 변경 불가. 안내만 표시하고 admin이 발레학원에서 직접 회원에게 전달
    setTempPw(generated);
    alert('이 임시 비밀번호는 Supabase Auth Dashboard에서 해당 사용자에게 직접 설정해야 합니다.\n\n개발 편의를 위해 표시되는 값이며, 실제 변경은 Auth 대시보드를 이용해주세요.');
  }

  return (
    <div>
      <Link to="/admin/members" className="text-sm text-gray-500">← 회원목록</Link>
      <h1 className="text-xl font-bold mt-2">{member.name}</h1>
      <p className="text-xs text-gray-500">{member.phone}</p>
      <p className="text-xs mt-1">
        상태: <span className={member.status==='active'?'text-green-600':'text-gray-500'}>{member.status}</span>
        {member.status === 'active' && <button onClick={setInactive} className="ml-2 text-red-600 underline">비활성화</button>}
        {member.status === 'inactive' && <button onClick={reactivate} className="ml-2 text-pink-600 underline">다시 활성화</button>}
      </p>
      <button onClick={issueTempPassword} className="mt-2 text-xs text-gray-500 underline">임시 비밀번호 발급</button>
      {tempPw && <p className="mt-2 text-sm bg-yellow-50 p-2 rounded">임시 비밀번호: <code className="font-mono">{tempPw}</code></p>}

      <div className="flex justify-between items-center mt-6 mb-2">
        <h2 className="font-semibold">활성 회원권 ({active.length})</h2>
        <button onClick={()=>setShowModal(true)} className="text-sm bg-pink-500 text-white px-3 py-1 rounded-lg">+ 회원권</button>
      </div>
      <ul className="space-y-2 mb-4">
        {active.map(v => (
          <li key={v.id} className="bg-pink-50 rounded-lg p-3 text-sm">
            {v.total_count}회권 · 남은 {v.remaining_count}회 · 만료 {v.expiry_date}
          </li>
        ))}
        {active.length === 0 && <p className="text-sm text-gray-500">활성 회원권 없음</p>}
      </ul>

      <h2 className="font-semibold mt-4 mb-2">이력 회원권 ({inactive.length})</h2>
      <ul className="space-y-1 text-xs mb-4">
        {inactive.map(v => (
          <li key={v.id} className="bg-gray-50 rounded px-3 py-2">
            {v.total_count}회권 · 구매 {v.purchase_date} · 만료 {v.expiry_date} · {v.status==='used_up'?'소진':'만료'}
          </li>
        ))}
      </ul>

      <h2 className="font-semibold mt-4 mb-2">출석 이력</h2>
      <ul className="space-y-1 text-sm">
        {attendance.map(a => (
          <li key={a.id} className={`flex justify-between rounded px-3 py-2 ${a.reverted_at?'bg-gray-50 text-gray-400 line-through':'bg-white border'}`}>
            <span>{format(new Date(a.checked_at), 'yyyy-MM-dd HH:mm')}</span>
            {!a.reverted_at && <button onClick={()=>revertAttendance(a.id)} className="text-xs text-red-600 underline">되돌리기</button>}
            {a.reverted_at && <span className="text-xs">취소됨</span>}
          </li>
        ))}
      </ul>

      {showModal && (
        <VoucherCreateModal
          memberId={member.id}
          memberName={member.name}
          onClose={()=>setShowModal(false)}
          onCreated={reload}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 라우트 등록**

`src/App.tsx`:
```tsx
import MemberDetail from './pages/admin/MemberDetail';
// admin 라우트 안:
<Route path="members/:id" element={<MemberDetail />} />
```

- [ ] **Step 3: 관리자가 회원 메인 페이지 갈 때 자동 /admin으로 리다이렉트**

`src/pages/Me.tsx`의 상단(member 로드 직후)에 추가:
```tsx
useEffect(() => {
  if (member?.role === 'admin') navigate('/admin', { replace: true });
}, [member]);
```

- [ ] **Step 4: 수동 테스트**

회원 상세 진입 → 회원권 추가 → 출석체크 후 되돌리기 → 회원 비활성화/재활성화.

- [ ] **Step 5: 커밋**

```powershell
git add src/pages/admin/MemberDetail.tsx src/pages/Me.tsx src/App.tsx
git commit -m "feat(admin): member detail + voucher creation + attendance revert"
```

---

## Task 22: Phase 4 통합 스모크 테스트

수동 (커밋 없음):

- [ ] 새 회원 가입 → 승인 → 회원권 등록 → 회원 로그인 → 카드 표시
- [ ] 출석체크 → 회원권 -1 → 회원 화면 "오늘 출석됨" 알림
- [ ] 출석 되돌리기 → 회원권 +1
- [ ] 만료 임박 회원이 "만료임박" 필터에 잡힘
- [ ] 회원권 다 쓰면 status=used_up 자동
- [ ] 만료일 지난 회원권은 SQL Editor에서 수동으로 `select expire_old_vouchers();` 호출 → 'expired'로 변경 확인

다 OK면 Phase 5로.

---

# Phase 5 — PWA 마감 & 배포

## Task 23: PWA manifest + 서비스 워커

**Files:**
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png` (임시 로고 이미지)
- Modify: `vite.config.ts`, `index.html`

- [ ] **Step 1: 임시 아이콘 생성**

원장님이 발레학원 로고 PNG가 있으면 그대로 192x192 / 512x512 두 사이즈로 저장. 없으면 [favicon.io/emoji-favicons](https://favicon.io/emoji-favicons/) 에서 🩰 토우슈즈 이모지 다운로드해서 두 사이즈로 저장. 파일을 `public/icons/`에 둠.

- [ ] **Step 2: vite.config.ts에 PWA 플러그인**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: '발레학원 출석체크',
        short_name: '발레출석',
        description: '발레학원 회원권 및 출석 관리',
        theme_color: '#ec4899',
        background_color: '#fdf2f8',
        display: 'standalone',
        start_url: '/me',
        lang: 'ko',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // API는 항상 네트워크, 정적 자산만 캐시
        navigateFallbackDenylist: [/^\/api/, /^https:\/\/.*\.supabase\.co/],
      },
    }),
  ],
});
```

- [ ] **Step 3: index.html에 메타태그**

`index.html` `<head>` 안에 추가:
```html
<meta name="theme-color" content="#ec4899" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="발레출석" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
<title>발레학원 출석체크</title>
```

- [ ] **Step 4: 빌드 확인**

```powershell
npm run build
npm run preview
```
브라우저 DevTools → Application → Manifest 탭에 manifest 정보 보이는지, Service Worker가 등록되는지 확인.

- [ ] **Step 5: 커밋**

```powershell
git add vite.config.ts index.html public/icons/
git commit -m "feat(pwa): manifest, service worker, app icons"
```

---

## Task 24: 설치 안내 배너

**Files:**
- Create: `src/components/InstallPrompt.tsx`
- Modify: `src/pages/Me.tsx`

- [ ] **Step 1: InstallPrompt 컴포넌트**

`src/components/InstallPrompt.tsx`:
```tsx
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(localStorage.getItem('installDismissed') === '1');

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    if (!standalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
      setShowIosHint(true);
    }
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  function dismiss() {
    setDismissed(true);
    localStorage.setItem('installDismissed', '1');
  }

  if (dismissed) return null;

  if (deferred) {
    return (
      <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 mb-4 flex items-center justify-between gap-2">
        <span className="text-sm">📱 홈 화면에 추가하면 앱처럼 쓸 수 있어요</span>
        <div className="flex gap-2">
          <button onClick={async()=>{await deferred.prompt(); setDeferred(null);}} className="text-xs bg-pink-500 text-white px-3 py-1 rounded">설치</button>
          <button onClick={dismiss} className="text-xs text-gray-500">닫기</button>
        </div>
      </div>
    );
  }

  if (showIosHint) {
    return (
      <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 mb-4 text-sm">
        📱 <strong>홈 화면 추가:</strong> 사파리 하단 공유 버튼 <span className="font-mono">⬆️</span> → "홈 화면에 추가"
        <button onClick={dismiss} className="ml-2 text-xs text-gray-500 underline">안 보기</button>
      </div>
    );
  }
  return null;
}
```

- [ ] **Step 2: /me 상단에 추가**

`src/pages/Me.tsx`의 헤더 바로 아래(알림 위에):
```tsx
import InstallPrompt from '../components/InstallPrompt';
// ...
<InstallPrompt />
```

- [ ] **Step 3: 수동 테스트**

`npm run build && npm run preview` → 안드로이드 크롬에서 IP 주소로 접속 (`ipconfig`로 PC IP 확인 후 `http://192.168.x.x:4173`) → 설치 배너 뜨는지 확인.

- [ ] **Step 4: 커밋**

```powershell
git add src/components/InstallPrompt.tsx src/pages/Me.tsx
git commit -m "feat(pwa): install prompt for Android + iOS hint"
```

---

## Task 25: 개인정보처리방침 페이지

**Files:**
- Create: `src/pages/PrivacyPolicy.tsx`
- Modify: `src/App.tsx`, `src/pages/Signup.tsx`, `src/pages/Login.tsx`

- [ ] **Step 1: PrivacyPolicy 페이지**

`src/pages/PrivacyPolicy.tsx`:
```tsx
import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="max-w-2xl mx-auto p-4 prose prose-sm">
      <Link to="/login" className="text-sm text-gray-500">← 돌아가기</Link>
      <h1 className="text-xl font-bold mt-4 mb-2">개인정보처리방침</h1>
      <p className="text-xs text-gray-500">시행일: 2026-05-27</p>

      <h2 className="font-semibold mt-4">1. 수집 항목</h2>
      <ul className="list-disc pl-5 text-sm">
        <li>이름, 전화번호 (가입 시)</li>
        <li>비밀번호 (암호화 저장, 평문 보관하지 않음)</li>
        <li>회원권 정보, 출석 이력 (수업 운영 목적)</li>
      </ul>

      <h2 className="font-semibold mt-4">2. 이용 목적</h2>
      <ul className="list-disc pl-5 text-sm">
        <li>회원 식별 및 인증</li>
        <li>회원권 잔여 횟수 관리, 만료일 안내</li>
        <li>출석체크 및 수업 운영</li>
      </ul>

      <h2 className="font-semibold mt-4">3. 보유 기간</h2>
      <p className="text-sm">회원 자격 종료(탈퇴/비활성화) 시 즉시 식별 정보 접근을 차단합니다. 회계 및 분쟁 대응을 위해 출석/회원권 이력은 최대 5년간 보관 후 파기합니다.</p>

      <h2 className="font-semibold mt-4">4. 제3자 제공</h2>
      <p className="text-sm">수집된 정보는 제3자에게 제공하지 않습니다. 단, 시스템 운영을 위해 Supabase(미국, AWS Seoul region) 및 Vercel 클라우드를 통해 처리됩니다.</p>

      <h2 className="font-semibold mt-4">5. 이용자 권리</h2>
      <p className="text-sm">본인 정보 조회·수정·삭제를 원하시면 학원에 직접 문의해주세요.</p>

      <h2 className="font-semibold mt-4">6. 문의처</h2>
      <p className="text-sm">○○발레학원 (전화번호·이메일을 원장님이 직접 채워주세요)</p>
    </div>
  );
}
```

(원장님이 학원명/연락처를 실제 정보로 수정해야 함 — 코드 코멘트로 표시)

- [ ] **Step 2: 라우트 등록 + 로그인/가입 화면에 링크**

`src/App.tsx`:
```tsx
import PrivacyPolicy from './pages/PrivacyPolicy';
<Route path="/privacy" element={<PrivacyPolicy />} />
```

`src/pages/Signup.tsx` 가입 버튼 아래:
```tsx
<p className="text-xs text-gray-500 text-center mt-2">
  가입 시 <Link to="/privacy" className="underline">개인정보처리방침</Link>에 동의한 것으로 간주합니다.
</p>
```

- [ ] **Step 3: 커밋**

```powershell
git add src/pages/PrivacyPolicy.tsx src/App.tsx src/pages/Signup.tsx
git commit -m "feat: privacy policy page"
```

---

## Task 26: Vercel 배포 (사용자 직접 수행)

**Files:** (외부)

- [ ] **Step 1: GitHub 저장소 생성 및 푸시**

[github.com/new](https://github.com/new) → 이름 `ballet-attendance` → Private → Create.

로컬에서:
```powershell
git remote add origin https://github.com/<원장님username>/ballet-attendance.git
git branch -M main
git push -u origin main
```

- [ ] **Step 2: Vercel에서 import**

[vercel.com/new](https://vercel.com/new) → 방금 푸시한 레포 선택 → Import

- [ ] **Step 3: 환경 변수 설정**

Vercel 프로젝트 설정 → Environment Variables:
- `VITE_SUPABASE_URL` = (Task 2의 Project URL)
- `VITE_SUPABASE_ANON_KEY` = (Task 2의 anon key)

- [ ] **Step 4: Deploy 클릭**

빌드 완료되면 `https://ballet-attendance-xxx.vercel.app` 같은 주소 나옴.

- [ ] **Step 5: Supabase에 배포 도메인 추가**

Supabase Dashboard → Authentication → URL Configuration → Site URL에 위 도메인 추가.

- [ ] **Step 6: PWA 설치 테스트**

배포된 주소를 안드로이드 폰 크롬으로 접속 → "홈 화면에 추가" 배너 뜨는지 → 아이콘이 생기고, 풀스크린으로 열리는지 확인. iOS는 사파리 → 공유 → 홈 화면에 추가.

- [ ] **Step 7: 회원들에게 안내 카톡 초안**

```
[발레학원 출석 앱 안내]

이제부터 회원권/출석 확인을 앱으로 하실 수 있어요.

1. 아래 주소를 폰 브라우저로 열어주세요:
   https://ballet-attendance-xxx.vercel.app

2. "가입 신청"을 누르고 이름·전화번호·비밀번호를 입력해주세요.
   (원장님이 승인 후 사용 가능합니다)

3. 폰 홈 화면에 추가하면 앱처럼 쓸 수 있어요:
   - 안드로이드: 화면 위 "설치" 배너 누르기
   - 아이폰: 사파리 공유 버튼 → "홈 화면에 추가"
```

---

## Task 27: README + 운영 가이드

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README 작성**

`README.md`:
```markdown
# 발레학원 출석체크 PWA

발레학원 회원권/출석 관리를 위한 PWA.

## 개발

```bash
npm install
cp .env.example .env.local   # 실제 값 채우기
npm run dev                  # http://localhost:5173
```

## 테스트

```bash
npm test           # 단위 테스트
npm run typecheck  # 타입 체크
```

## 배포

`main` 브랜치 푸시 → Vercel 자동 배포.

## 운영 매뉴얼

### 새 회원 받기
1. 회원이 PWA에서 가입 신청
2. 관리자 `/admin/pending`에서 승인
3. 승인 모달에서 회원권(10/20/30회) + 구매일 입력 → 자동 저장

### 회원 비밀번호 분실
1. Supabase Dashboard → Authentication → Users → 해당 회원 검색
2. "Send password recovery email" 또는 "Update password"로 직접 설정
3. 회원에게 새 비밀번호 구두/카톡 전달
4. 회원 로그인 후 본인이 다시 변경

### 회원권 만료 자동 처리
매일 KST 자정에 pg_cron이 만료된 회원권을 자동으로 'expired' 처리.
```

- [ ] **Step 2: 커밋**

```powershell
git add README.md
git commit -m "docs: readme and operations guide"
git push
```

---

## Task 28: E2E 해피패스 (Playwright)

**Files:**
- Create: `e2e/happy-path.spec.ts`, `playwright.config.ts`

- [ ] **Step 1: Playwright 설정**

```powershell
npx playwright install chromium
```

`playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
  },
  webServer: {
    command: 'npm run build && npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

- [ ] **Step 2: 해피패스 테스트**

`e2e/happy-path.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('login as admin and see admin dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('010-1234-5678').fill(process.env.E2E_ADMIN_PHONE!);
  await page.getByPlaceholder('비밀번호').first().fill(process.env.E2E_ADMIN_PW!);
  await page.getByRole('button', { name: /로그인/ }).click();
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByText('출석체크')).toBeVisible();
});
```

`.env.local`에 추가:
```
E2E_ADMIN_PHONE=01012345678
E2E_ADMIN_PW=관리자비밀번호
```

- [ ] **Step 3: 실행**

```powershell
npm run test:e2e
```
Expected: 1 passed.

- [ ] **Step 4: 커밋**

```powershell
git add e2e/ playwright.config.ts
git commit -m "test(e2e): admin login happy path"
git push
```

---

## 완료 체크리스트

- [ ] 회원이 가입 → 관리자 승인 → 로그인 가능
- [ ] 관리자가 출석체크 시 회원권 1회 차감 (가장 빨리 만료될 것 우선)
- [ ] 출석 5초 내 되돌리기 동작
- [ ] 회원이 본인 화면에서 잔여횟수·만료일·다음결제일 확인
- [ ] 만료 임박/잔여 부족/오늘 출석 인앱 알림 표시
- [ ] 비밀번호 변경 동작
- [ ] 회원권 자동 만료(pg_cron) 동작
- [ ] PWA로 홈 화면 추가 가능
- [ ] Vercel 배포된 주소에서 정상 동작
- [ ] 개인정보처리방침 접근 가능

---

## 추후 작업 메모

- 회원 비밀번호 분실 시 관리자가 앱 안에서 임시 비번을 발급할 수 있도록 Edge Function 추가 (현재는 Supabase Dashboard에서 직접 처리)
- 출석 통계/매출 통계 대시보드
- 다강사·다지점 확장
- 네이티브 앱(React Native + Expo)으로 앱스토어 출시

