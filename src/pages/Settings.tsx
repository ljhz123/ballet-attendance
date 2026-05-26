import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Settings() {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) { setMsg({ kind: 'err', text: '비밀번호가 일치하지 않아요' }); return; }
    if (pw.length < 6) { setMsg({ kind: 'err', text: '6자 이상이어야 해요' }); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) setMsg({ kind: 'err', text: error.message });
    else { setMsg({ kind: 'ok', text: '변경 완료!' }); setPw(''); setPw2(''); }
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <Link to="/me" className="text-sm text-gray-500">← 돌아가기</Link>
      <h1 className="text-xl font-bold my-4">비밀번호 변경</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="새 비밀번호" className="w-full border rounded-lg px-3 py-2" />
        <input type="password" value={pw2} onChange={e=>setPw2(e.target.value)} placeholder="새 비밀번호 확인" className="w-full border rounded-lg px-3 py-2" />
        {msg && <p className={msg.kind === 'ok' ? 'text-green-600 text-sm' : 'text-red-600 text-sm'}>{msg.text}</p>}
        <button disabled={loading} className="w-full bg-pink-500 text-white py-2 rounded-lg font-semibold disabled:opacity-50">{loading ? '저장 중...' : '변경하기'}</button>
      </form>
    </div>
  );
}
