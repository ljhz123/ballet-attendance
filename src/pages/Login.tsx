import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithPhone } from '../lib/auth';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithPhone(phone, password);
      navigate('/me');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '로그인 실패');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-4 bg-gray-50">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white p-6 rounded-2xl shadow">
        <h1 className="text-2xl font-bold mb-6 text-center">🩰 발레학원 출석체크</h1>
        <label className="block text-sm font-medium mb-1">전화번호</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="010-1234-5678"
          required
          className="w-full border rounded-lg px-3 py-2 mb-4"
        />
        <label className="block text-sm font-medium mb-1">비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full border rounded-lg px-3 py-2 mb-4"
        />
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-pink-500 text-white rounded-lg py-2 font-semibold disabled:opacity-50"
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>
        <p className="text-center text-sm mt-4">
          처음이신가요? <Link to="/signup" className="text-pink-600 underline">가입 신청</Link>
        </p>
      </form>
    </div>
  );
}
