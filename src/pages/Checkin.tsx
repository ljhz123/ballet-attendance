import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useCurrentMember } from '../lib/useCurrentMember';

type Result =
  | { status: 'loading' }
  | { status: 'success'; remaining: number; alreadyChecked: boolean }
  | { status: 'error'; message: string };

export default function Checkin() {
  const { member, loading } = useCurrentMember();
  const [result, setResult] = useState<Result>({ status: 'loading' });

  useEffect(() => {
    if (loading || !member) return;
    async function checkin() {
      const { data, error } = await supabase.rpc('self_check_attendance');
      if (error) {
        let msg = error.message;
        if (msg.includes('no active voucher')) msg = '활성 회원권이 없어요. 원장님께 문의해주세요.';
        else if (msg.includes('not authenticated')) msg = '로그인이 만료됐어요. 다시 로그인해주세요.';
        setResult({ status: 'error', message: msg });
        return;
      }
      const row = (data as Array<{ remaining_after: number; already_checked_today: boolean }>)[0];
      setResult({
        status: 'success',
        remaining: row.remaining_after,
        alreadyChecked: row.already_checked_today,
      });
    }
    checkin();
  }, [member, loading]);

  if (loading) return <div className="min-h-full flex items-center justify-center">로딩 중...</div>;

  return (
    <div className="min-h-full flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-sm bg-white p-6 rounded-2xl shadow text-center">
        {result.status === 'loading' && (
          <>
            <div className="text-5xl mb-4 animate-pulse">⏳</div>
            <p className="text-gray-600">출석 처리 중...</p>
          </>
        )}
        {result.status === 'success' && (
          <>
            <div className="text-6xl mb-4">{result.alreadyChecked ? '✓' : '✅'}</div>
            <h1 className="text-2xl font-bold mb-2">
              {result.alreadyChecked ? '이미 오늘 출석했어요' : '출석 완료!'}
            </h1>
            <p className="text-gray-600 mb-4">
              {member?.name}님, 남은 횟수 <span className="font-bold text-pink-600">{result.remaining}회</span>
            </p>
            <Link to="/me" className="inline-block bg-pink-500 text-white px-6 py-2 rounded-lg font-semibold">
              내 정보 보기
            </Link>
          </>
        )}
        {result.status === 'error' && (
          <>
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold mb-2">출석 실패</h1>
            <p className="text-red-600 mb-4 text-sm">{result.message}</p>
            <Link to="/me" className="inline-block bg-gray-200 text-gray-800 px-6 py-2 rounded-lg">
              내 정보로
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
