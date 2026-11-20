// components/shared/RequireAuth.tsx
import { Navigate } from 'react-router-dom';
import { useMe } from '../../hooks/useAuth';

export function RequireAuth({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: 'registrar' | 'professor' | 'student';
}) {
  const { data: user, isLoading } = useMe({ enabled: true });

  if (isLoading) {
    return null;
  }

  if (!user) {
    return <Navigate to='/' replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    if (user.role === 'registrar') {
      return <Navigate to='/registrar' replace />;
    }
    if (user.role === 'professor') {
      return <Navigate to='/teacher' replace />;
    }
    return <Navigate to='/student' replace />;
  }

  return <>{children}</>;
}
