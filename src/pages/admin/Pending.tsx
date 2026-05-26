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
    setVoucherFor(m);
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
