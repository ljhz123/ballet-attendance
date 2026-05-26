-- QR 셀프 출석체크용 함수: 본인이 자기 회원권에서 차감
-- check_attendance와 다른 점: 관리자 권한 체크 X (대신 본인 인증만 확인)
create or replace function self_check_attendance()
returns table (attendance_id uuid, voucher_id uuid, remaining_after int, already_checked_today boolean)
language plpgsql
security definer
as $$
declare
  v_member members%rowtype;
  v_voucher vouchers%rowtype;
  v_today date := current_date;
  v_attendance_id uuid;
  v_existing_today int;
begin
  -- 로그인한 회원 조회
  select * into v_member
    from members
    where auth_user_id = auth.uid() and status='active';
  if v_member.id is null then
    raise exception 'not authenticated or inactive member';
  end if;

  -- 오늘 이미 출석했는지 확인 (중복 차감 방지)
  select count(*) into v_existing_today
    from attendance
    where member_id = v_member.id
      and checked_at >= v_today::timestamp
      and checked_at < (v_today + 1)::timestamp
      and reverted_at is null;
  if v_existing_today > 0 then
    -- 이미 오늘 출석 — 차감 안 하고 알림만
    select id, voucher_id into v_attendance_id, v_voucher.id
      from attendance
      where member_id = v_member.id
        and checked_at >= v_today::timestamp
        and reverted_at is null
      order by checked_at desc limit 1;
    select remaining_count into v_voucher.remaining_count from vouchers where id = v_voucher.id;
    return query select v_attendance_id, v_voucher.id, v_voucher.remaining_count, true;
    return;
  end if;

  -- 활성 회원권 중 가장 빨리 만료될 것 잠금 + 선택
  select * into v_voucher
    from vouchers
    where member_id = v_member.id
      and status = 'active'
      and remaining_count > 0
      and expiry_date >= v_today
    order by expiry_date asc, created_at asc
    for update
    limit 1;

  if v_voucher.id is null then
    raise exception 'no active voucher';
  end if;

  -- 차감
  update vouchers
    set remaining_count = remaining_count - 1,
        status = case when remaining_count - 1 = 0 then 'used_up' else status end
    where id = v_voucher.id
    returning remaining_count into v_voucher.remaining_count;

  -- attendance 기록 (checked_by는 본인)
  insert into attendance (member_id, voucher_id, checked_by)
    values (v_member.id, v_voucher.id, v_member.id)
    returning id into v_attendance_id;

  return query select v_attendance_id, v_voucher.id, v_voucher.remaining_count, false;
end;
$$;

grant execute on function self_check_attendance() to authenticated;

-- Realtime을 위해 회원 테이블들에 publication 등록
-- (Supabase는 'supabase_realtime' publication을 기본 제공)
alter publication supabase_realtime add table vouchers;
alter publication supabase_realtime add table attendance;
