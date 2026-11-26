import { Outlet } from 'react-router-dom';
import {
  ClipboardList,
  LayoutDashboard,
} from 'lucide-react';
import { AppShell, type AppNavItem } from '../components/layout/AppShell';

const navItems: AppNavItem[] = [
  {
    icon: LayoutDashboard,
    label: 'Dashboard',
    to: '/department-head',
    end: true,
  },
  {
    icon: ClipboardList,
    label: 'Submissions',
    to: '/department-head/submissions',
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