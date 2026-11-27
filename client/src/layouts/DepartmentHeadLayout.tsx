import { Outlet } from 'react-router-dom';
import {
  BookOpen,
  ClipboardList,
  LayoutDashboard,
} from 'lucide-react';
import { AppShell, type AppNavItem } from '../components/layout/AppShell';
import { useMe } from '../hooks/useAuth';

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

const navItems: AppNavItem[] = [
  {
    icon: ClipboardList,
    label: 'Dashboard',
    to: '/department-head',
    end: true,
  },
  {
    icon: BookOpen,
    label: 'Assignments',
    to: '/department-head/assignments',
  },
];

export default function DepartmentHeadLayout() {
  const { data: user } = useMe({ enabled: true });
  const userFullName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  const userName =
    userFullName || user?.username || 'Department Head';
  const userInitials = getInitials(userName) || 'DH';

  return (
    <AppShell
      roleLabel='Department Head'
      logoIcon={LayoutDashboard}
      logoShape='circle'
      navItems={navItems}
      userInitials={userInitials}
      userName={userName}
    >
      <Outlet />
    </AppShell>
  );
}