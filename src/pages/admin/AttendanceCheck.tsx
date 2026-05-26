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
