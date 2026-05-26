import { Navigate } from 'react-router-dom';
import { useCurrentMember } from '../lib/useCurrentMember';

interface Props {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin }: Props) {
  const { member, loading } = useCurrentMember();

  if (loading) {
    return <div className="min-h-full flex items-center justify-center">로딩 중...</div>;
  }
  if (!member) return <Navigate to="/login" replace />;
  if (member.status === 'pending') return <Navigate to="/pending" replace />;
  if (member.status === 'inactive') return <Navigate to="/login" replace />;
  if (requireAdmin && member.role !== 'admin') return <Navigate to="/me" replace />;
  return <>{children}</>;
}
