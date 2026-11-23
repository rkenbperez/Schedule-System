import { Outlet, useParams } from 'react-router-dom';
import {
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck,
  LayoutDashboard,
} from 'lucide-react';
import { AppShell, type AppNavItem } from '../components/layout/AppShell';

function formatTeacherName(value: string) {
  if (value.toLowerCase() === 'juan') return 'Juan Dela Cruz';

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
  const teacher = name ?? 'juan';
  const teacherName = formatTeacherName(teacher);

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
