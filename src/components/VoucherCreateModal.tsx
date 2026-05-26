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
