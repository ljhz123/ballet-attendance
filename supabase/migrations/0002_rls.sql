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

-- 본인 비밀번호/이름 정도 본인이 update (status·role은 못 바꿈은 트리거로 보호)
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

-- Trigger — 일반 회원의 self-update 시 role/status 변경 방지
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
