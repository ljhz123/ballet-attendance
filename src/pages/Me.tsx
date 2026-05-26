import { signOut } from '../lib/auth';
import { useCurrentMember } from '../lib/useCurrentMember';
import { useNavigate } from 'react-router-dom';

export default function Me() {
  const { member } = useCurrentMember();
  const navigate = useNavigate();
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">{member?.name}님 안녕하세요</h1>
      <p className="text-sm text-gray-500 mt-1">{member?.phone}</p>
      <button
        onClick={async () => { await signOut(); navigate('/login'); }}
        className="mt-4 text-sm text-pink-600 underline"
      >로그아웃</button>
    </div>
  );
}
