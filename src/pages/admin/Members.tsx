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
