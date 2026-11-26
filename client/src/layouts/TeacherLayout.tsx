import { Outlet, useParams } from 'react-router-dom';
import {
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck,
  LayoutDashboard,
  Users,
} from 'lucide-react';
import { AppShell, type AppNavItem } from '../components/layout/AppShell';
import { useMe } from '../hooks/useAuth';

function formatTeacherName(value: string) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export default function TeacherLayout() {
  const { name } = useParams<{ name: string }>();
  const { data: user } = useMe({ enabled: true });
  const teacher = name ?? user?.username ?? '';
  const userFullName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  const teacherName = userFullName || formatTeacherName(teacher);

  const navItems: AppNavItem[] = [
    {
      icon: LayoutDashboard,
      label: 'Dashboard',
      to: `/teacher/${teacher}`,
      end: true,
    },
    {
      icon: BookOpen,
      label: 'My assignments',
      to: `/teacher/${teacher}/assignments`,
    },
    {
      icon: Calendar,
      label: 'My schedules',
      to: `/teacher/${teacher}/schedules`,
    },
    {
      icon: Building2,
      label: 'Rooms',
      to: `/teacher/${teacher}/rooms`,
    },
    {
      icon: Users,
      label: 'Department',
      to: `/teacher/${teacher}/department`,
    },
  ];

  return (
    <AppShell
      roleLabel='Teacher'
      logoIcon={CalendarCheck}
      logoShape='circle'
      navItems={navItems}
      userInitials={getInitials(teacherName)}
      userName={teacherName}
    >
      <Outlet />
    </AppShell>
  );
}
