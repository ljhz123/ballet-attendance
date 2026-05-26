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
