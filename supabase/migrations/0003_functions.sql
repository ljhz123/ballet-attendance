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

-- authenticated 사용자에게 함수 실행 권한 (RLS는 함수 내부 체크가 막아줌)
grant execute on function check_attendance(uuid) to authenticated;
grant execute on function revert_attendance(uuid) to authenticated;
