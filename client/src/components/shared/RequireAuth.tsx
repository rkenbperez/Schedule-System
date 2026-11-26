// components/shared/RequireAuth.tsx
import { Navigate } from 'react-router-dom';
import { useMe } from '../../hooks/useAuth';
import { dashboardPathFor } from '../../utils/dashboardRoute';

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
    return <Navigate to={dashboardPathFor(user)} replace />;
  }

  return <>{children}</>;
}
