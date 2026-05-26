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
    if (!member) return;
    if (!confirm(`${member.name}님을 비활성화할까요? (다시 활성화 가능)`)) return;
    await supabase.from('members').update({ status: 'inactive' }).eq('id', member.id);
    reload();
  }
  async function reactivate() {
    if (!member) return;
    await supabase.from('members').update({ status: 'active' }).eq('id', member.id);
    reload();
  }

  async function issueTempPassword() {
    const generated = Math.random().toString(36).slice(2, 10);
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
