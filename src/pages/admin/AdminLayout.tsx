import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useCurrentMember } from '../../lib/useCurrentMember';
import { signOut } from '../../lib/auth';

export default function AdminLayout() {
  const { member } = useCurrentMember();
  const navigate = useNavigate();
  return (
    <div className="min-h-full">
      <header className="bg-pink-600 text-white px-4 py-3 flex justify-between items-center">
        <div>
          <div className="font-bold">🩰 관리자</div>
          <div className="text-xs opacity-80">{member?.name}</div>
        </div>
        <button onClick={async()=>{await signOut(); navigate('/login');}} className="text-xs underline">로그아웃</button>
      </header>
      <nav className="flex border-b bg-white sticky top-0">
        {[
          { to: '/admin', label: '출석체크' },
          { to: '/admin/pending', label: '가입승인' },
          { to: '/admin/members', label: '회원관리' },
        ].map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/admin'}
            className={({isActive}) => `flex-1 text-center py-3 text-sm ${isActive ? 'text-pink-600 border-b-2 border-pink-600 font-semibold' : 'text-gray-600'}`}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className="p-4 max-w-2xl mx-auto"><Outlet /></main>
    </div>
  );
}
