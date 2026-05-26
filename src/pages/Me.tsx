import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signOut } from '../lib/auth';
import { useCurrentMember } from '../lib/useCurrentMember';
import { supabase } from '../lib/supabase';
import type { Voucher, AttendanceRow } from '../lib/types';
import { computeAlerts } from '../lib/alerts';
import VoucherCard from '../components/VoucherCard';
import AlertCard from '../components/AlertCard';
import InstallPrompt from '../components/InstallPrompt';
import { format } from 'date-fns';

export default function Me() {
  const { member } = useCurrentMember();
  const navigate = useNavigate();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (member?.role === 'admin') navigate('/admin', { replace: true });
  }, [member, navigate]);

  useEffect(() => {
    if (!member) return;
    let cancelled = false;
    async function load() {
      if (!member) return;
      const [v, a] = await Promise.all([
        supabase.from('vouchers').select('*').eq('member_id', member.id).order('expiry_date'),
        supabase.from('attendance').select('*').eq('member_id', member.id).is('reverted_at', null).order('checked_at', { ascending: false }).limit(10),
      ]);
      if (cancelled) return;
      setVouchers((v.data ?? []) as Voucher[]);
      setAttendance((a.data ?? []) as AttendanceRow[]);
      setLoading(false);
    }
    load();

    // Realtime: 내 회원권/출석 변경 시 자동 새로고침
    const channel = supabase.channel(`me-${member.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'vouchers', filter: `member_id=eq.${member.id}` },
        () => load()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'attendance', filter: `member_id=eq.${member.id}` },
        () => load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
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
        <div className="flex gap-3 text-xs text-gray-500">
          <Link to="/settings" className="underline">설정</Link>
          <button onClick={async () => { await signOut(); window.location.href = '/login'; }} className="underline">로그아웃</button>
        </div>
      </div>

      <InstallPrompt />

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
