import { Link } from 'react-router-dom';

export default function PendingApproval() {
  return (
    <div className="min-h-full flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-sm bg-white p-6 rounded-2xl shadow text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h1 className="text-xl font-bold mb-2">가입 신청 완료</h1>
        <p className="text-gray-600 mb-6">
          원장님이 승인하면 로그인할 수 있어요.<br />
          잠시 후 다시 시도해주세요.
        </p>
        <Link to="/login" className="text-pink-600 underline text-sm">로그인 화면으로</Link>
      </div>
    </div>
  );
}
