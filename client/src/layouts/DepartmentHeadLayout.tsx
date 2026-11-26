import { Outlet } from 'react-router-dom';
import {
  BookOpen,
  ClipboardList,
  LayoutDashboard,
} from 'lucide-react';
import { AppShell, type AppNavItem } from '../components/layout/AppShell';

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
  return (
    <AppShell
      roleLabel='Department Head'
      logoIcon={LayoutDashboard}
      logoShape='circle'
      navItems={navItems}
      userInitials='DH'
      userName='Department Head'
    >
      <Outlet />
    </AppShell>
  );
}